import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScheduledLessonMirrorWindow,
  createLessonMirrorPostHandler,
} from '../../lib/admin/lesson-mirror-endpoint.mjs';

function request(secret = '') {
  return new Request('https://example.test/api/cron/lesson-mirror', {
    method: 'POST',
    headers: secret ? { 'x-firstchord-schedule-secret': secret } : {},
  });
}

test('scheduled lesson mirror window uses the London calendar day across summer time', () => {
  const window = buildScheduledLessonMirrorWindow({ at: new Date('2026-08-10T23:30:00Z') });
  assert.deepEqual(window, {
    today: '2026-08-11',
    startDate: '2026-07-28',
    endDateExclusive: '2026-09-23',
    lookbackDays: 14,
    futureDays: 42,
  });
});

test('scheduled lesson mirror endpoint fails closed when its secret is missing or wrong', async () => {
  const unconfigured = createLessonMirrorPostHandler({ env: {}, sync: async () => assert.fail('must not sync') });
  const missingResponse = await unconfigured(request());
  assert.equal(missingResponse.status, 503);

  const configured = createLessonMirrorPostHandler({
    env: { SCHEDULE_REFRESH_SECRET: 'correct-secret' },
    sync: async () => assert.fail('must not sync'),
  });
  const wrongResponse = await configured(request('wrong-secret'));
  assert.equal(wrongResponse.status, 401);
});

test('scheduled lesson mirror endpoint runs one bounded scheduled sync and returns counts only', async () => {
  const calls = [];
  const handler = createLessonMirrorPostHandler({
    env: { SCHEDULE_REFRESH_SECRET: 'correct-secret' },
    now: () => new Date('2026-08-10T09:00:00Z'),
    sync: async (input) => {
      calls.push(input);
      return {
        syncRunId: '00000000-0000-4000-8000-000000000009',
        status: 'succeeded',
        seriesCount: 220,
        eventCount: 1540,
        participationCount: 1535,
      };
    },
  });
  const response = await handler(request('correct-secret'));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{
    startDate: '2026-07-27',
    endDateExclusive: '2026-09-22',
    triggerKind: 'scheduled',
  }]);
  assert.equal(payload.success, true);
  assert.equal(payload.eventCount, 1540);
  assert.deepEqual(Object.keys(payload).sort(), [
    'eventCount',
    'participationCount',
    'seriesCount',
    'status',
    'success',
    'syncRunId',
    'window',
  ]);
});

test('scheduled lesson mirror endpoint returns a bounded failure without provider text', async () => {
  const handler = createLessonMirrorPostHandler({
    env: { SCHEDULE_REFRESH_SECRET: 'correct-secret' },
    now: () => new Date('2026-08-10T09:00:00Z'),
    sync: async () => { throw new Error('MMS calendar reported 50 rows but included parent text: private'); },
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await handler(request('correct-secret'));
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.match(body, /provider_result_incomplete/u);
    assert.doesNotMatch(body, /parent text|private/u);
  } finally {
    console.error = originalError;
  }
});
