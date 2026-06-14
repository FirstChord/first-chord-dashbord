import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPauseExpectationAutoSyncPlan } from '../../lib/admin/pause-auto-sync-helpers.mjs';

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
    },
  ]);

  assert.equal(plan.length, 1);
  assert.equal(plan[0].mmsId, 'sdt_resumed');
  assert.equal(plan[0].previousPaymentExpectation, 'stripe_paused_expected');
  assert.equal(plan[0].nextPaymentExpectation, 'stripe_active_expected');
  assert.match(plan[0].reason, /ended.*matched by Stripe subscription ID/i);
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
