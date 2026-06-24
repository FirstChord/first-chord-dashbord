import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPauseExpectationAutoSyncPlan, derivePauseExpectationDecision } from '../../lib/admin/pause-auto-sync-helpers.mjs';

test('buildPauseExpectationAutoSyncPlan syncs only high-confidence current subscription-id pauses', () => {
  const plan = buildPauseExpectationAutoSyncPlan([
    {
      mmsId: 'sdt_sync',
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_active_expected',
      pauseSummary: {
        hasPauseHistory: true,
        currentlyPaused: true,
        matchedBy: 'subscription_id',
        matchConfidence: 'high',
      },
      pauseCoverageContext: {
        status: 'covers_future_or_current_lesson',
        confidence: 'high',
        coveredLessonCount: 1,
        summary: 'This pause window appears to cover 1 usual lesson: Sat 6 Jun, 11:30.',
      },
    },
    {
      mmsId: 'sdt_email_only',
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_active_expected',
      pauseSummary: {
        hasPauseHistory: true,
        currentlyPaused: true,
        matchedBy: 'email_only',
        matchConfidence: 'low',
      },
    },
    {
      mmsId: 'sdt_manual',
      paymentMode: 'manual',
      paymentExpectation: 'stripe_active_expected',
      pauseSummary: {
        hasPauseHistory: true,
        currentlyPaused: true,
        matchedBy: 'subscription_id',
        matchConfidence: 'high',
      },
    },
  ]);

  assert.equal(plan.length, 1);
  assert.equal(plan[0].mmsId, 'sdt_sync');
  assert.equal(plan[0].nextPaymentExpectation, 'stripe_paused_expected');
  assert.match(plan[0].reason, /matched by Stripe subscription ID/i);
});

test('buildPauseExpectationAutoSyncPlan skips already paused, setup pending, and inactive students', () => {
  const base = {
    paymentMode: 'stripe',
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: true,
      matchedBy: 'subscription_id',
      matchConfidence: 'high',
    },
    pauseCoverageContext: {
      status: 'covers_future_or_current_lesson',
      confidence: 'high',
      coveredLessonCount: 1,
      summary: 'This pause window appears to cover 1 usual lesson.',
    },
  };

  const plan = buildPauseExpectationAutoSyncPlan([
    { ...base, mmsId: 'sdt_paused', paymentExpectation: 'stripe_paused_expected' },
    { ...base, mmsId: 'sdt_setup', paymentExpectation: 'setup_pending' },
    { ...base, mmsId: 'sdt_inactive', paymentExpectation: 'inactive_or_stopped' },
  ]);

  assert.deepEqual(plan, []);
});

test('buildPauseExpectationAutoSyncPlan reverts an ended pause back to active expected', () => {
  const plan = buildPauseExpectationAutoSyncPlan([
    {
      mmsId: 'sdt_resumed',
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_paused_expected',
      pauseSummary: {
        hasPauseHistory: true,
        currentlyPaused: false,
        upcomingPause: false,
        matchedBy: 'subscription_id',
        matchConfidence: 'high',
      },
      pauseCoverageContext: {
        status: 'covered_lessons_passed',
        confidence: 'high',
        coveredLessonCount: 1,
        nextBillableLessonDate: '2026-06-01',
      },
    },
  ], { currentDate: '2026-06-02' });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].mmsId, 'sdt_resumed');
  assert.equal(plan[0].previousPaymentExpectation, 'stripe_paused_expected');
  assert.equal(plan[0].nextPaymentExpectation, 'stripe_active_expected');
  assert.match(plan[0].reason, /next billable lesson is due/i);
});

test('buildPauseExpectationAutoSyncPlan does not revert when a pause is upcoming, low-confidence, name-matched, or already active', () => {
  const endedPaused = {
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_paused_expected',
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: false,
      upcomingPause: false,
      matchedBy: 'subscription_id',
      matchConfidence: 'high',
    },
    pauseCoverageContext: {
      status: 'covered_lessons_passed',
      confidence: 'high',
      coveredLessonCount: 1,
      nextBillableLessonDate: '2026-06-01',
    },
  };

  const plan = buildPauseExpectationAutoSyncPlan([
    // Another pause is upcoming — leave the expectation as paused.
    {
      ...endedPaused,
      mmsId: 'sdt_upcoming',
      pauseSummary: { ...endedPaused.pauseSummary, upcomingPause: true },
    },
    // Email-only / low-confidence match — left for human review.
    {
      ...endedPaused,
      mmsId: 'sdt_low_conf',
      pauseSummary: { ...endedPaused.pauseSummary, matchedBy: 'email_only', matchConfidence: 'low' },
    },
    // Already active — nothing to do.
    {
      ...endedPaused,
      mmsId: 'sdt_already_active',
      paymentExpectation: 'stripe_active_expected',
    },
    // Explicitly inactive/stopped — never auto-reactivate.
    {
      ...endedPaused,
      mmsId: 'sdt_inactive',
      paymentExpectation: 'inactive_or_stopped',
    },
  ]);

  assert.deepEqual(plan, []);
});

test('derivePauseExpectationDecision keeps paused expectation during the bridge before the next billable lesson', () => {
  const decision = derivePauseExpectationDecision({
    mmsId: 'sdt_bridge',
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_paused_expected',
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: false,
      upcomingPause: false,
      matchedBy: 'subscription_id',
      matchConfidence: 'high',
    },
    pauseCoverageContext: {
      status: 'covered_lessons_passed',
      confidence: 'high',
      coveredLessonCount: 1,
      summary: 'This pause window appears to cover 1 usual lesson: Wed 10 Jun, 18:00.',
      nextBillableLessonDate: '2026-06-17',
      nextBillableLessonLabel: 'Wed 17 Jun, 18:00',
    },
  }, { currentDate: '2026-06-14' });

  assert.equal(decision.expectedPaymentExpectation, 'stripe_paused_expected');
  assert.equal(decision.shouldAutoSync, false);
  assert.equal(decision.shouldCreateIssue, false);
  assert.equal(decision.allowsActiveBillingBeforeNextLesson, true);
  assert.match(decision.reason, /next usual billable lesson has not arrived/i);
});

test('buildPauseExpectationAutoSyncPlan waits until the next billable lesson before reverting', () => {
  const student = {
    mmsId: 'sdt_bridge',
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_paused_expected',
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: false,
      upcomingPause: false,
      matchedBy: 'subscription_id',
      matchConfidence: 'high',
    },
    pauseCoverageContext: {
      status: 'covered_lessons_passed',
      confidence: 'high',
      coveredLessonCount: 1,
      nextBillableLessonDate: '2026-06-17',
    },
  };

  assert.deepEqual(buildPauseExpectationAutoSyncPlan([student], { currentDate: '2026-06-14' }), []);
  const plan = buildPauseExpectationAutoSyncPlan([student], { currentDate: '2026-06-17' });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].nextPaymentExpectation, 'stripe_active_expected');
});

test('buildPauseExpectationAutoSyncPlan does not auto-sync when the pause window misses the usual lesson', () => {
  const plan = buildPauseExpectationAutoSyncPlan([
    {
      mmsId: 'sdt_no_coverage',
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_active_expected',
      pauseSummary: {
        hasPauseHistory: true,
        currentlyPaused: true,
        matchedBy: 'subscription_id',
        matchConfidence: 'high',
      },
      pauseCoverageContext: {
        status: 'no_usual_lesson_covered',
        confidence: 'high',
        coveredLessonCount: 0,
        summary: 'This pause window does not appear to include the usual lesson.',
      },
    },
  ]);

  assert.deepEqual(plan, []);
});
