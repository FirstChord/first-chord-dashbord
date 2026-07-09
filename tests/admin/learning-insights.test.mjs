import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLearningInsights } from '../../lib/admin/learning-insights.mjs';

test('buildLearningInsights separates confirmed delivery, unknown delivery, and attendance-only notes', () => {
  const insights = buildLearningInsights({
    now: new Date('2026-07-10T12:00:00Z'),
    practiceNotes: [
      { createdAt: '2026-07-09T12:00:00Z', emailSendStatus: 'sent', practiceGoals: 'Scales', progressChallenges: 'Timing' },
      { createdAt: '2026-07-09T12:00:00Z', mmsAttendanceSaved: true },
      { createdAt: '2026-07-09T12:00:00Z', emailSendStatus: 'not_sent_absent' },
      { createdAt: '2026-05-01T12:00:00Z', emailSendStatus: 'sent' },
    ],
  });

  assert.equal(insights.practice.total, 3);
  assert.equal(insights.practice.sent, 1);
  assert.equal(insights.practice.deliveryUntracked, 1);
  assert.equal(insights.practice.attendanceOnly, 1);
  assert.equal(insights.practice.withGoals, 1);
  assert.equal(insights.practice.withChallenges, 1);
});

test('buildLearningInsights excludes incomplete parent checklists from confirmed theme counts', () => {
  const insights = buildLearningInsights({
    parentRecords: [
      { state: { workflowStatus: 'completed', details: { understanding: {
        cancellations: { understands: 'yes' }, dashboardSoundslice: { understands: 'no' }, practiceNotes: { understands: 'yes' }, showcases: { understands: 'yes' },
      }, feedback: { practiceAtHome: 'regularly' } } } },
      { state: { workflowStatus: 'in_progress', details: { understanding: { cancellations: { understands: 'no' } }, feedback: {} } } },
    ],
  });

  assert.equal(insights.parents.fullyAssessed, 1);
  assert.equal(insights.parents.partiallyAssessed, 1);
  assert.deepEqual(insights.parents.topSignals, [{ label: 'Dashboard or Soundslice access gap', count: 1 }]);
});

test('buildLearningInsights reports inbox outcomes and review timing without claiming a parent response', () => {
  const insights = buildLearningInsights({
    now: new Date('2026-07-10T12:00:00Z'),
    incomingMessages: [
      { capturedAt: '2026-07-10T08:00:00Z', reviewedAt: '2026-07-10T10:00:00Z', status: 'converted', resolutionType: 'planning_task', suspectedCategory: 'schedule' },
      { capturedAt: '2026-07-10T09:00:00Z', reviewedAt: '2026-07-10T10:00:00Z', status: 'converted', resolutionType: 'handled_no_plan', suspectedCategory: 'general' },
      { capturedAt: '2026-07-10T11:00:00Z', status: 'inbox', suspectedCategory: 'payment' },
    ],
  });

  assert.equal(insights.inbox.total, 3);
  assert.equal(insights.inbox.planned, 1);
  assert.equal(insights.inbox.handledNoPlan, 1);
  assert.equal(insights.inbox.open, 1);
  assert.equal(insights.inbox.averageReviewHours, 1.5);
});
