import assert from 'node:assert/strict';
import test from 'node:test';
import { searchAttendanceForPayroll, clearPayrollAttendanceCacheForTests } from '../../lib/admin/mms.js';

// Two contracts live here:
//
// 1. MMS compares EndDate against EventStartDate at midnight, so it excludes the
//    end day. Payroll windows are inclusive of periodEnd (a Wednesday run covers
//    through the Tuesday), so searchAttendanceForPayroll must widen the bound by
//    one day. Regression: a Tuesday EndDate silently dropped every Tuesday lesson.
//
// 2. The attendance cache is TTL + stale-while-revalidate + in-flight coalescing
//    (mirroring lib/admin/sheets/core.mjs), so a "Mark reviewed" save never blocks
//    on a ~950-row MMS fetch.

const TTL_MS = 10 * 60 * 1000;
const HARD_MAX_AGE_MS = TTL_MS + 20 * 60 * 1000;

// Each call resolves on a deferred promise so tests can control fetch timing.
async function withMockedFetch(fn) {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const originalBearer = process.env.MMS_BEARER_TOKEN;
  const originalWarn = console.warn;

  const calls = [];
  let clock = 1_000_000;
  let nextRows = [{ ID: 'atn_1' }];
  let failNext = false;

  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    if (failNext) throw new Error('MMS is down');
    const rows = nextRows;
    return { ok: true, status: 200, text: async () => JSON.stringify({ ItemSubset: rows }) };
  };
  Date.now = () => clock;
  process.env.MMS_BEARER_TOKEN = 'test-token';
  console.warn = () => {};
  clearPayrollAttendanceCacheForTests();

  const ctl = {
    calls,
    advance: (ms) => { clock += ms; },
    setRows: (rows) => { nextRows = rows; },
    setFailNext: (v) => { failNext = v; },
    // Let queued microtasks (a background refresh) settle.
    settle: () => new Promise((resolve) => setImmediate(resolve)),
  };

  try {
    await fn(ctl);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    console.warn = originalWarn;
    clearPayrollAttendanceCacheForTests();
    if (originalBearer === undefined) delete process.env.MMS_BEARER_TOKEN;
    else process.env.MMS_BEARER_TOKEN = originalBearer;
  }
}

const BASE = { startDate: '2026-06-03', endDate: '2026-07-07', teacherIds: ['tch_a'] };

test('sends an end-exclusive EndDate one day past the inclusive end', async () => {
  await withMockedFetch(async ({ calls }) => {
    await searchAttendanceForPayroll(BASE);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].StartDate, '2026-06-03');
    assert.equal(calls[0].EndDate, '2026-07-08', 'EndDate must be periodEnd + 1 so periodEnd lessons are included');
    assert.deepEqual(calls[0].TeacherIDs, ['tch_a']);
  });
});

test('rolls the end date across a month boundary', async () => {
  await withMockedFetch(async ({ calls }) => {
    await searchAttendanceForPayroll({ ...BASE, endDate: '2026-06-30' });
    assert.equal(calls[0].EndDate, '2026-07-01');
  });
});

test('requires both dates', async () => {
  await assert.rejects(
    () => searchAttendanceForPayroll({ startDate: '2026-06-01' }),
    /startDate and endDate are required/,
  );
});

test('serves a fresh cache hit without refetching', async () => {
  await withMockedFetch(async ({ calls, advance }) => {
    await searchAttendanceForPayroll(BASE);
    advance(TTL_MS - 1);
    const rows = await searchAttendanceForPayroll(BASE);
    assert.equal(calls.length, 1, 'within TTL must not refetch');
    assert.deepEqual(rows, [{ ID: 'atn_1' }]);
  });
});

test('keys the cache on the query, so a different window refetches', async () => {
  await withMockedFetch(async ({ calls }) => {
    await searchAttendanceForPayroll(BASE);
    await searchAttendanceForPayroll({ ...BASE, teacherIds: ['tch_b'] });
    assert.equal(calls.length, 2);
  });
});

test('stale cache is served immediately and refreshed in the background', async () => {
  await withMockedFetch(async ({ calls, advance, setRows, settle }) => {
    await searchAttendanceForPayroll(BASE);
    advance(TTL_MS + 1);
    setRows([{ ID: 'atn_2' }]);

    const rows = await searchAttendanceForPayroll(BASE);
    assert.deepEqual(rows, [{ ID: 'atn_1' }], 'stale rows are returned to the caller, not the fresh fetch');
    assert.equal(calls.length, 2, 'a background refresh was kicked off');

    await settle();
    const after = await searchAttendanceForPayroll(BASE);
    assert.deepEqual(after, [{ ID: 'atn_2' }], 'background refresh replaced the cached rows');
    assert.equal(calls.length, 2, 'and did not fetch again');
  });
});

test('a failed background refresh does not reject into the caller', async () => {
  await withMockedFetch(async ({ advance, setFailNext, settle }) => {
    await searchAttendanceForPayroll(BASE);
    advance(TTL_MS + 1);
    setFailNext(true);

    const rows = await searchAttendanceForPayroll(BASE);
    assert.deepEqual(rows, [{ ID: 'atn_1' }], 'stale rows still stand when the refresh fails');
    await settle();
  });
});

test('past the hard max age the caller waits for fresh rows', async () => {
  await withMockedFetch(async ({ calls, advance, setRows }) => {
    await searchAttendanceForPayroll(BASE);
    advance(HARD_MAX_AGE_MS + 1);
    setRows([{ ID: 'atn_3' }]);

    const rows = await searchAttendanceForPayroll(BASE);
    assert.deepEqual(rows, [{ ID: 'atn_3' }], 'too-old rows must not be served');
    assert.equal(calls.length, 2);
  });
});

test('forceRefresh bypasses a fresh cache and awaits the fetch', async () => {
  await withMockedFetch(async ({ calls, setRows }) => {
    await searchAttendanceForPayroll(BASE);
    setRows([{ ID: 'atn_4' }]);

    const rows = await searchAttendanceForPayroll({ ...BASE, forceRefresh: true });
    assert.deepEqual(rows, [{ ID: 'atn_4' }]);
    assert.equal(calls.length, 2);
  });
});

test('concurrent callers coalesce onto a single MMS fetch', async () => {
  await withMockedFetch(async ({ calls }) => {
    const [a, b, c] = await Promise.all([
      searchAttendanceForPayroll(BASE),
      searchAttendanceForPayroll(BASE),
      searchAttendanceForPayroll(BASE),
    ]);
    assert.equal(calls.length, 1, 'three concurrent renders must share one fetch');
    assert.deepEqual(a, b);
    assert.deepEqual(b, c);
  });
});
