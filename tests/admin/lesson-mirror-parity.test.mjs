import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLessonMirrorHealth } from '../../lib/admin/lesson-mirror-parity.mjs';

const now = new Date('2026-08-11T12:00:00Z');

test('lesson mirror health reports exact fresh parity', () => {
  const health = buildLessonMirrorHealth({
    status: 'succeeded',
    completed_at: '2026-08-11T06:00:00Z',
    calendar_expected_count: 1540,
    calendar_received_count: 1540,
    attendance_expected_count: 1535,
    attendance_received_count: 1535,
    event_count: 1540,
  }, { now });
  assert.equal(health.status, 'Healthy');
  assert.match(health.detail, /Calendar 1540\/1540/u);
  assert.match(health.detail, /Attendance 1535\/1535/u);
});

test('lesson mirror health fails defensive parity mismatches and stuck runs', () => {
  const mismatch = buildLessonMirrorHealth({
    status: 'succeeded',
    completed_at: '2026-08-11T06:00:00Z',
    calendar_expected_count: 1540,
    calendar_received_count: 1539,
  }, { now });
  assert.equal(mismatch.status, 'Failing');
  assert.match(mismatch.detail, /mismatched/u);

  const stuck = buildLessonMirrorHealth({
    status: 'running',
    started_at: '2026-08-11T10:00:00Z',
  }, { now });
  assert.equal(stuck.status, 'Failing');
  assert.equal(stuck.assessment.state, 'stuck');
});

test('lesson mirror health distinguishes failed, stale, and never-run state', () => {
  assert.equal(buildLessonMirrorHealth(null, { now }).status, 'Unknown');
  assert.equal(buildLessonMirrorHealth({
    status: 'failed',
    completed_at: '2026-08-11T11:00:00Z',
    failure_code: 'provider_read_failed',
  }, { now }).status, 'Failing');
  assert.equal(buildLessonMirrorHealth({
    status: 'succeeded',
    completed_at: '2026-08-09T00:00:00Z',
    calendar_expected_count: 1,
    calendar_received_count: 1,
    attendance_expected_count: 1,
    attendance_received_count: 1,
  }, { now }).status, 'Stale');
});
