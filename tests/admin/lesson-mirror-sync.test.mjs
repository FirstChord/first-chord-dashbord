import test from 'node:test';
import assert from 'node:assert/strict';

import { syncMmsLessonMirror } from '../../lib/admin/lesson-mirror-sync.mjs';

function fixedClock(values) {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]);
}

test('lesson mirror sync fetches sequential verified sources and persists their exact counts', async () => {
  const calls = [];
  const store = {
    begin: async (input) => calls.push(['begin', input]),
    persist: async (input) => {
      calls.push(['persist', input]);
      return { syncRunId: input.syncRunId, status: 'succeeded' };
    },
    fail: async (input) => calls.push(['fail', input]),
  };
  const result = await syncMmsLessonMirror({
    startDate: '2026-08-01',
    endDateExclusive: '2026-08-29',
    syncRunId: '00000000-0000-4000-8000-000000000001',
    now: fixedClock(['2026-08-10T09:00:00Z', '2026-08-10T09:00:02Z']),
    store,
    fetchCalendar: async () => {
      calls.push(['calendar']);
      return {
        reportedTotal: 1,
        rows: [{ ID: 'evt_1', StartDate: '2026-08-10T16:00:00', Attendances: [{ StudentID: 'sdt_1' }] }],
      };
    },
    fetchAttendance: async () => {
      calls.push(['attendance']);
      return {
        reportedTotal: 1,
        rows: [{ ID: 'att_1', EventID: 'evt_1', StudentID: 'sdt_1', EventStartDate: '2026-08-10T16:00:00' }],
      };
    },
  });

  assert.equal(result.status, 'succeeded');
  assert.deepEqual(calls.map(([kind]) => kind), ['begin', 'calendar', 'attendance', 'persist']);
  const persisted = calls.find(([kind]) => kind === 'persist')[1];
  assert.equal(persisted.calendarExpectedCount, 1);
  assert.equal(persisted.calendarReceivedCount, 1);
  assert.equal(persisted.attendanceExpectedCount, 1);
  assert.equal(persisted.attendanceReceivedCount, 1);
  assert.equal(persisted.snapshot.events.length, 1);
  assert.equal(persisted.snapshot.participations.length, 1);
});

test('lesson mirror sync records a failed run and does not persist after provider failure', async () => {
  const calls = [];
  const providerError = new Error('MMS calendar reported 10 rows but returned 9');
  await assert.rejects(
    syncMmsLessonMirror({
      startDate: '2026-08-01',
      endDateExclusive: '2026-08-29',
      syncRunId: '00000000-0000-4000-8000-000000000002',
      now: fixedClock(['2026-08-10T09:00:00Z', '2026-08-10T09:00:02Z']),
      store: {
        begin: async () => calls.push('begin'),
        persist: async () => calls.push('persist'),
        fail: async ({ error }) => calls.push(error === providerError ? 'fail' : 'wrong-error'),
      },
      fetchCalendar: async () => {
        calls.push('calendar');
        throw providerError;
      },
      fetchAttendance: async () => calls.push('attendance'),
    }),
    providerError,
  );
  assert.deepEqual(calls, ['begin', 'calendar', 'fail']);
});

test('a failure to update run tracking never hides the original sync failure', async () => {
  const providerError = new Error('MMS unavailable');
  await assert.rejects(
    syncMmsLessonMirror({
      startDate: '2026-08-01',
      endDateExclusive: '2026-08-29',
      store: {
        begin: async () => {},
        fail: async () => { throw new Error('database unavailable'); },
      },
      fetchCalendar: async () => { throw providerError; },
    }),
    (error) => {
      assert.equal(error, providerError);
      assert.equal(error.lessonMirrorTrackingError.message, 'database unavailable');
      return true;
    },
  );
});
