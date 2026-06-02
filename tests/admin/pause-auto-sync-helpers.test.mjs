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
