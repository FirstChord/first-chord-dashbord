import test from 'node:test';
import assert from 'node:assert/strict';

import { buildIssueExplanation } from '../../lib/admin/issue-explanation-helpers.mjs';

const GENERATED_AT = '2026-07-15T10:30:00.000Z';

function context(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'issue_context',
    subject: 'selected_issue',
    generatedAt: GENERATED_AT,
    issue: {
      type: 'STRIPE SETUP INCOMPLETE',
      source: 'payment_static',
      severity: 'Warning',
      systemsAffected: ['Sheets', 'Stripe'],
      summary: 'Student is expected to use Stripe but is missing both customer and subscription linkage',
      recommendedAction: 'Check whether Stripe linkage should already exist, then correct the recorded setup.',
      actionCode: 'review_payment_state',
    },
    detector: { evaluated: true, currentPresent: true },
    queue: {
      recorded: true,
      status: 'acknowledged',
      recordedSourcePresent: true,
      lastSeenAt: '2026-07-15T09:00:00.000Z',
      updatedAt: '2026-07-15T09:00:00.000Z',
    },
    evidence: {
      recordPresence: { studentsSheet: true, studentRegistry: true },
      lifecycle: { status: 'active', confidence: 'high' },
      payment: {
        mode: 'stripe',
        expectation: 'stripe_active_expected',
        customerLinkRecorded: false,
        subscriptionLinkRecorded: false,
      },
      pause: {
        hasHistory: false,
        currentlyPaused: false,
        upcomingPause: false,
        matchConfidence: '',
        coverageStatus: '',
        coverageConfidence: '',
      },
      schedule: { status: 'found', confidence: 'high', freshness: 'fresh', checkedAt: '2026-07-15' },
      identity: { possibleIdentityCollision: false, sourceConflict: false },
      practiceDelivery: { present: false, lessonDate: '', deliveryStatus: '', manualFollowUpNeeded: false },
      financeCoverage: { present: false, flags: [], lessonKind: '', confidence: '' },
      stripeLive: { recordedEvidence: false },
    },
    ambiguityCodes: [],
    student: { deliberatelyIgnoredIdentifier: 'sdt_PRIVATE', parentEmail: 'private@example.com' },
    ...overrides,
  };
}

test('explains a freshly re-evaluated static issue with bounded deterministic evidence', () => {
  const explanation = buildIssueExplanation(context());

  assert.equal(explanation.kind, 'issue_explanation');
  assert.equal(explanation.status.code, 'currently_detected');
  assert.equal(explanation.rule.name, 'Stripe linkage check');
  assert.match(explanation.rule.statement, /neither a Stripe customer link nor a subscription link/i);
  assert.equal(explanation.source.detectorRechecked, true);
  assert.equal(explanation.queue.label, 'Acknowledged');
  assert.deepEqual(
    explanation.evidence.map((item) => [item.label, item.value]),
    [
      ['Payment mode', 'Stripe'],
      ['Payment expectation', 'Stripe Active Expected'],
      ['Stripe customer link recorded', 'No'],
      ['Stripe subscription link recorded', 'No'],
      ['Issue Queue source state', 'Recorded as present'],
    ],
  );
  assert.deepEqual(explanation.notChecked, [
    'Live Stripe was not checked. This rule only compares the payment, linkage and pause facts already recorded by the dashboard.',
  ]);
  assert.equal(explanation.nextStep.approvalRequired, true);
  assert.doesNotMatch(JSON.stringify(explanation), /sdt_PRIVATE|private@example\.com/);
});

test('never presents a recorded Stripe issue as a fresh provider check', () => {
  const explanation = buildIssueExplanation(context({
    issue: {
      type: 'PAYMENT_FAILED',
      source: 'stripe_live',
      summary: 'Stripe shows a real payment problem on the current subscription',
      recommendedAction: 'Refresh Stripe, then review the current payment state.',
      actionCode: 'review_payment_state',
    },
    detector: { evaluated: false, currentPresent: null },
    queue: { recorded: true, status: 'open', recordedSourcePresent: true },
    ambiguityCodes: ['stripe_live_not_refreshed'],
  }));

  assert.equal(explanation.status.code, 'recorded_not_rechecked');
  assert.equal(explanation.source.detectorRechecked, false);
  assert.match(explanation.notChecked[0], /Stripe was not refreshed/i);
  assert.match(explanation.ambiguity[0].explanation, /may have changed/i);
  assert.doesNotMatch(JSON.stringify(explanation), /Stripe was refreshed|fresh live Stripe evidence/i);
});

test('makes detector and queue disagreement visible instead of choosing a winner', () => {
  const explanation = buildIssueExplanation(context({
    detector: { evaluated: true, currentPresent: false },
    queue: { recorded: true, status: 'open', recordedSourcePresent: true },
    ambiguityCodes: ['queue_presence_disagrees_with_detector'],
  }));

  assert.equal(explanation.status.code, 'not_currently_detected');
  assert.match(explanation.status.detail, /queue state has not caught up/i);
  assert.match(explanation.ambiguity[0].explanation, /disagree/i);
});

test('uses specific rules but recorded-only status for Practice Chat and finance issues', () => {
  for (const [source, type, expectedRule] of [
    ['practice_delivery', 'PRACTICE NOTE DELIVERY FAILED', 'Practice note delivery check'],
    ['finance_coverage', 'FINANCE DATA GAP', 'Finance coverage check'],
  ]) {
    const explanation = buildIssueExplanation(context({
      issue: {
        type,
        source,
        summary: 'Recorded deterministic result',
        recommendedAction: 'Review in the existing workflow.',
        actionCode: 'manual_review',
      },
      detector: { evaluated: false, currentPresent: null },
      queue: { recorded: true, status: 'open', recordedSourcePresent: true },
      ambiguityCodes: ['detector_not_evaluated'],
    }));

    assert.equal(explanation.rule.name, expectedRule);
    assert.equal(explanation.status.code, 'recorded_not_rechecked');
    assert.ok(explanation.notChecked.length > 0);
  }
});

test('reports unavailable queue context and rejects non-redacted input shapes', () => {
  const explanation = buildIssueExplanation(context(), {
    availability: { issueQueue: { available: false, reason: 'missing_tab' } },
  });
  assert.ok(explanation.notChecked.some((item) => item.includes('Issue Queue state was unavailable')));
  assert.throws(() => buildIssueExplanation({ kind: 'raw_issue' }), /redacted issue context/i);
});
