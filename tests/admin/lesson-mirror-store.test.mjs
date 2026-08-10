import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assessLessonMirrorStatus,
  getLessonMirrorStatus,
  lessonMirrorFailureCode,
  persistLessonMirrorSnapshot,
} from '../../lib/admin/lesson-mirror-store.mjs';
import { normaliseMmsLessonMirror } from '../../lib/admin/lesson-mirror-helpers.mjs';

function fakeDatabase({ failPattern = null } = {}) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, params = []) {
      const text = `${sql}`;
      calls.push({ sql: text, params });
      const placeholders = [...text.matchAll(/\$(\d+)/gu)].map((match) => Number(match[1]));
      assert.equal(params.length, placeholders.length ? Math.max(...placeholders) : 0,
        'every PostgreSQL bind parameter must be used and typed by the statement');
      if (failPattern && text.includes(failPattern)) throw new Error('injected database failure');
      if (text.includes('SELECT i."provider"')) return { rows: [] };
      if (text.includes("SET status = 'succeeded'")) return { rows: [{ sync_run_id: params[0], status: 'succeeded' }] };
      return { rows: [], rowCount: 0 };
    },
    release() { released = true; },
  };
  return {
    calls,
    get released() { return released; },
    connect: async () => client,
  };
}

function snapshot() {
  return normaliseMmsLessonMirror({
    calendarRows: [{
      ID: 'evt_1',
      SeriesID: 'ser_1',
      StartDate: '2026-08-10T16:00:00',
      Duration: 30,
      Attendances: [{ ID: 'att_1', StudentID: 'sdt_1', AttendanceStatus: 'Present' }],
    }],
  });
}

test('lesson mirror persistence locks and commits all current rows, revisions, refs, and run outcome together', async () => {
  const database = fakeDatabase();
  const result = await persistLessonMirrorSnapshot({
    syncRunId: '00000000-0000-4000-8000-000000000003',
    observedAt: '2026-08-10T09:00:02Z',
    calendarExpectedCount: 1,
    calendarReceivedCount: 1,
    attendanceExpectedCount: 1,
    attendanceReceivedCount: 1,
    snapshot: snapshot(),
    database,
  });

  assert.equal(result.status, 'succeeded');
  assert.equal(database.calls[0].sql, 'BEGIN');
  assert.match(database.calls[1].sql, /pg_advisory_xact_lock/u);
  assert.ok(database.calls.some((call) => call.sql.includes('INSERT INTO fc_lesson_series')));
  assert.ok(database.calls.some((call) => call.sql.includes('INSERT INTO fc_lesson_events')));
  assert.ok(database.calls.some((call) => call.sql.includes('INSERT INTO fc_lesson_participations')));
  assert.ok(database.calls.some((call) => call.sql.includes('INSERT INTO fc_lesson_external_refs')));
  assert.ok(database.calls.some((call) => call.sql.includes('INSERT INTO fc_lesson_revisions')));
  assert.equal(database.calls.at(-1).sql, 'COMMIT');
  assert.equal(database.released, true);

  const revisionQueries = database.calls.filter((call) => call.sql.includes('INSERT INTO fc_lesson_revisions'));
  assert.ok(revisionQueries.every((call) => call.sql.includes('IS DISTINCT FROM')),
    'repeated identical observations must not append revisions');
});

test('lesson mirror persistence rolls back the whole snapshot on any row failure', async () => {
  const database = fakeDatabase({ failPattern: 'INSERT INTO fc_lesson_participations' });
  await assert.rejects(
    persistLessonMirrorSnapshot({
      syncRunId: '00000000-0000-4000-8000-000000000004',
      observedAt: '2026-08-10T09:00:02Z',
      calendarExpectedCount: 1,
      calendarReceivedCount: 1,
      attendanceExpectedCount: 1,
      attendanceReceivedCount: 1,
      snapshot: snapshot(),
      database,
    }),
    /injected database failure/u,
  );
  assert.equal(database.calls.at(-1).sql, 'ROLLBACK');
  assert.equal(database.calls.some((call) => call.sql === 'COMMIT'), false);
  assert.equal(database.released, true);
});

test('lesson mirror failures are stored as bounded categories rather than raw provider text', () => {
  assert.equal(lessonMirrorFailureCode(new Error('endpoint total changed from 10 to 11')), 'provider_snapshot_changed');
  assert.equal(lessonMirrorFailureCode(new Error('MMS did not report a valid total')), 'provider_result_incomplete');
  assert.equal(lessonMirrorFailureCode(new Error('MMS event has no wall-clock')), 'provider_row_invalid');
  assert.equal(lessonMirrorFailureCode(new Error('surprise')), 'sync_failed');
});

test('status keeps DATE values as written and chooses a deterministic latest run', async () => {
  const calls = [];
  const database = {
    async query(sql) {
      calls.push(`${sql}`);
      return { rows: [{ window_start: '2026-08-01', window_end_exclusive: '2026-08-29' }] };
    },
  };
  const status = await getLessonMirrorStatus({ database });
  assert.equal(status.window_start, '2026-08-01');
  assert.match(calls[0], /window_start::text AS window_start/u);
  assert.match(calls[0], /ORDER BY latest\.started_at DESC, latest\.sync_run_id DESC/u);
});

test('status assessment distinguishes never-run, failed, running, stuck, fresh, and stale', () => {
  const now = new Date('2026-08-10T12:00:00Z');
  assert.equal(assessLessonMirrorStatus(null, { now }).state, 'never_run');
  assert.deepEqual(
    assessLessonMirrorStatus({ status: 'failed', completed_at: '2026-08-10T11:00:00Z', failure_code: 'provider_read_failed' }, { now }),
    { state: 'failed', ageMinutes: 60, failureCode: 'provider_read_failed' },
  );
  assert.equal(assessLessonMirrorStatus({ status: 'running', started_at: '2026-08-10T11:45:00Z' }, { now }).state, 'running');
  assert.equal(assessLessonMirrorStatus({ status: 'running', started_at: '2026-08-10T10:00:00Z' }, { now }).state, 'stuck');
  assert.equal(assessLessonMirrorStatus({ status: 'succeeded', completed_at: '2026-08-10T10:00:00Z' }, { now }).state, 'fresh');
  assert.equal(assessLessonMirrorStatus({ status: 'succeeded', completed_at: '2026-08-08T10:00:00Z' }, { now }).state, 'stale');
});
