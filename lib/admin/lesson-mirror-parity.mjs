/** @fileoverview Pure health presentation for the read-only lesson-mirror parity loop. */
import { assessLessonMirrorStatus } from './lesson-mirror-store.mjs';

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parityMatches(status = {}) {
  return count(status.calendar_expected_count) === count(status.calendar_received_count)
    && count(status.attendance_expected_count) === count(status.attendance_received_count);
}

function parityDetail(status = {}) {
  return `Calendar ${count(status.calendar_received_count)}/${count(status.calendar_expected_count)} · Attendance ${count(status.attendance_received_count)}/${count(status.attendance_expected_count)} · ${count(status.event_count)} events`;
}

export function buildLessonMirrorHealth(status, { now = new Date() } = {}) {
  const assessment = assessLessonMirrorStatus(status, { now });
  const updatedAt = status?.completed_at || status?.started_at || null;
  if (!status) {
    return {
      status: 'Unknown',
      detail: 'No lesson-mirror run has been recorded.',
      updatedAt,
      assessment,
    };
  }
  if (assessment.state === 'failed' || assessment.state === 'stuck') {
    return {
      status: 'Failing',
      detail: assessment.state === 'stuck'
        ? 'The latest lesson-mirror run has not completed.'
        : `The latest lesson-mirror run failed (${assessment.failureCode || 'unclassified'}).`,
      updatedAt,
      assessment,
    };
  }
  if (assessment.state === 'running') {
    return {
      status: 'Running',
      detail: 'A bounded lesson-mirror reconciliation is running.',
      updatedAt,
      assessment,
    };
  }
  if (status.status === 'succeeded' && !parityMatches(status)) {
    return {
      status: 'Failing',
      detail: `Stored success has mismatched provider totals. ${parityDetail(status)}`,
      updatedAt,
      assessment,
    };
  }
  if (assessment.state === 'fresh') {
    return {
      status: 'Healthy',
      detail: parityDetail(status),
      updatedAt,
      assessment,
    };
  }
  if (assessment.state === 'stale') {
    return {
      status: 'Stale',
      detail: `Latest verified mirror is older than 36 hours. ${parityDetail(status)}`,
      updatedAt,
      assessment,
    };
  }
  return {
    status: 'Unknown',
    detail: 'Lesson-mirror freshness could not be classified.',
    updatedAt,
    assessment,
  };
}
