import assert from 'node:assert/strict';
import test from 'node:test';
import { searchAttendanceForPayroll } from '../../lib/admin/mms.js';

// MMS compares EndDate against EventStartDate at midnight, so it excludes the end
// day. Payroll windows are inclusive of periodEnd (a Wednesday run covers through
// the Tuesday), so searchAttendanceForPayroll must widen the bound by one day.
// Regression: a Tuesday EndDate silently dropped every Tuesday lesson from payroll.

function withMockedFetch(fn) {
  const originalFetch = globalThis.fetch;
  const originalBearer = process.env.MMS_BEARER_TOKEN;
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, status: 200, text: async () => JSON.stringify({ ItemSubset: [] }) };
  };
  process.env.MMS_BEARER_TOKEN = 'test-token';
  try {
    return fn(calls);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBearer === undefined) delete process.env.MMS_BEARER_TOKEN;
    else process.env.MMS_BEARER_TOKEN = originalBearer;
  }
}

test('searchAttendanceForPayroll sends an end-exclusive EndDate one day past the inclusive end', async () => {
  await withMockedFetch(async (calls) => {
    await searchAttendanceForPayroll({
      startDate: '2026-06-03',
      endDate: '2026-07-07',
      teacherIds: ['tch_test1'],
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].StartDate, '2026-06-03');
    assert.equal(calls[0].EndDate, '2026-07-08', 'EndDate must be periodEnd + 1 so periodEnd lessons are included');
    assert.deepEqual(calls[0].TeacherIDs, ['tch_test1']);
  });
});

test('searchAttendanceForPayroll rolls the end date across a month boundary', async () => {
  await withMockedFetch(async (calls) => {
    await searchAttendanceForPayroll({
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      teacherIds: ['tch_test2'],
    });
    assert.equal(calls[0].EndDate, '2026-07-01');
  });
});

test('searchAttendanceForPayroll requires both dates', async () => {
  await assert.rejects(
    () => searchAttendanceForPayroll({ startDate: '2026-06-01' }),
    /startDate and endDate are required/,
  );
});
