import test from 'node:test';
import assert from 'node:assert/strict';

import {
  searchMmsLessonAttendance,
  searchMmsLessonCalendar,
} from '../../lib/admin/mms.js';

async function withMmsFetch(rows, action, { includeTotal = true } = {}) {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.MMS_BEARER_TOKEN;
  const calls = [];
  process.env.MMS_BEARER_TOKEN = 'test-token-not-a-real-secret';
  globalThis.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    const offset = Number(parsed.searchParams.get('offset') || 0);
    const limit = Number(parsed.searchParams.get('limit') || 100);
    calls.push({ url: `${url}`, body: JSON.parse(init.body || '{}'), offset, limit });
    const response = { ItemSubset: rows.slice(offset, offset + limit) };
    if (includeTotal) response.TotalItemCount = rows.length;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(response),
    };
  };
  try {
    return await action(calls);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.MMS_BEARER_TOKEN;
    else process.env.MMS_BEARER_TOKEN = originalToken;
  }
}

test('whole-school calendar reads every page and returns the verified MMS total', async () => {
  const providerRows = Array.from({ length: 5 }, (_, index) => ({ ID: `evt_${index}` }));
  await withMmsFetch(providerRows, async (calls) => {
    const result = await searchMmsLessonCalendar({
      startDate: '2026-08-01',
      endDateExclusive: '2026-08-29',
      pageSize: 2,
      maxPages: 5,
    });
    assert.deepEqual(result.rows, providerRows);
    assert.equal(result.reportedTotal, 5);
    assert.deepEqual(calls.map((call) => call.offset), [0, 2, 4]);
    assert.ok(calls.every((call) => call.url.includes('/search/calendar/events')));
    assert.deepEqual(calls[0].body.StudentIDs, []);
    assert.deepEqual(calls[0].body.TeacherIDs, []);
    assert.equal(calls[0].body.StartDate, '2026-08-01');
    assert.equal(calls[0].body.EndDate, '2026-08-29');
  });
});

test('whole-school attendance uses an unfiltered bounded window', async () => {
  const providerRows = [
    { ID: 'att_1', EventID: 'evt_1', StudentID: 'sdt_1' },
    { ID: 'att_2', EventID: 'evt_2', StudentID: 'sdt_2' },
    { ID: 'att_3', EventID: 'evt_3', StudentID: 'sdt_3' },
  ];
  await withMmsFetch(providerRows, async (calls) => {
    const result = await searchMmsLessonAttendance({
      startDate: '2026-08-01',
      endDateExclusive: '2026-08-29',
      pageSize: 2,
      maxPages: 5,
    });
    assert.deepEqual(result.rows, providerRows);
    assert.equal(result.reportedTotal, 3);
    assert.deepEqual(calls.map((call) => call.offset), [0, 2]);
    assert.ok(calls.every((call) => call.url.includes('/search/attendance')));
    assert.ok(calls.every((call) => !call.url.includes('fields=Charge')),
      'the mirror must not request unused payment expansions');
    assert.deepEqual(calls[0].body.StudentIDs, []);
    assert.deepEqual(calls[0].body.TeacherIDs, []);
    assert.equal(calls[0].body.StartDate, '2026-08-01');
    assert.equal(calls[0].body.EndDate, '2026-08-29');
  });
});

test('lesson mirror reads reject an unverified provider result', async () => {
  await withMmsFetch([{ ID: 'evt_1' }], async () => {
    await assert.rejects(
      searchMmsLessonCalendar({ startDate: '2026-08-01', endDateExclusive: '2026-08-29' }),
      /did not report a valid total/u,
    );
  }, { includeTotal: false });
});

test('lesson mirror reads reject invalid or backwards windows before fetching', async () => {
  await assert.rejects(
    searchMmsLessonAttendance({ startDate: '10/08/2026', endDateExclusive: '2026-08-29' }),
    /YYYY-MM-DD/u,
  );
  await assert.rejects(
    searchMmsLessonCalendar({ startDate: '2026-08-29', endDateExclusive: '2026-08-01' }),
    /must be after/u,
  );
});
