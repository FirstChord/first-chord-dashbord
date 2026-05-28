import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildParentUnderstandingSummary,
  calculateUnderstandingScore,
  deriveParentUnderstandingRiskSignals,
  normaliseParentUnderstandingLoopStatus,
  normaliseParentUnderstandingStatus,
} from '../../lib/admin/parent-understanding-helpers.mjs';

test('calculateUnderstandingScore scores four core understanding areas', () => {
  const score = calculateUnderstandingScore({
    understanding: {
      cancellations: { understands: 'yes' },
      dashboardSoundslice: { understands: 'partial' },
      practiceNotes: { understands: 'no' },
      showcases: { understands: 'yes' },
    },
  });

  assert.equal(score.total, 5);
  assert.equal(score.max, 8);
  assert.equal(score.label, 'mostly_clear');
  assert.deepEqual(score.breakdown, {
    cancellations: 2,
    dashboardSoundslice: 1,
    practiceNotes: 0,
    showcases: 2,
  });
});

test('deriveParentUnderstandingRiskSignals flags practical follow-up gaps', () => {
  const signals = deriveParentUnderstandingRiskSignals({
    understanding: {
      cancellations: { understands: 'yes' },
      dashboardSoundslice: { understands: 'no', needsAccessHelp: true },
      practiceNotes: { understands: 'partial', isReceiving: 'no' },
      showcases: { understands: 'unsure' },
    },
    feedback: {
      practiceAtHome: 'sometimes',
      tutorRelevance: 'needs_admin_review',
    },
    communication: {
      whatsappUnderstanding: 'unsure',
      communityGroupStatus: 'not_in_group',
    },
  });

  assert(signals.includes('Dashboard or Soundslice access gap'));
  assert(signals.includes('Practice notes delivery gap'));
  assert(signals.includes('Showcase understanding gap'));
  assert(signals.includes('WhatsApp group communication needs explaining'));
  assert(signals.includes('Community group status needs checking'));
  assert(signals.includes('Practice engagement needs review'));
  assert(signals.includes('Tutor-related feedback needs admin review'));
});

test('buildParentUnderstandingSummary includes score, student, and follow-up signals', () => {
  const summary = buildParentUnderstandingSummary(
    {
      understanding: {
        cancellations: { understands: 'yes' },
        dashboardSoundslice: { understands: 'no' },
        practiceNotes: { understands: 'no' },
        showcases: { understands: 'yes' },
      },
      communication: { whatsappUnderstanding: 'partial', bestContactTime: 'Evening' },
    },
    {
      parentName: 'Rachel',
      studentName: 'Tabitha',
    },
  );

  assert.match(summary, /Rachel check-in for Tabitha: 4\/8/);
  assert.match(summary, /Dashboard\/Soundslice should be followed up/);
  assert.match(summary, /WhatsApp understanding: partial/);
  assert.match(summary, /Best contact time: Evening/);
});

test('normalisers fall back to safe open states', () => {
  assert.equal(normaliseParentUnderstandingStatus('bad'), 'not_started');
  assert.equal(normaliseParentUnderstandingStatus('COMPLETED'), 'completed');
  assert.equal(normaliseParentUnderstandingLoopStatus('bad'), 'open_admin_follow_up_needed');
  assert.equal(normaliseParentUnderstandingLoopStatus('closed'), 'closed');
});
