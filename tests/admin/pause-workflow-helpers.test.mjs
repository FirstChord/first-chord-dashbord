import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPauseWorkflowSummary } from '../../lib/admin/pause-workflow-helpers.mjs';

test('buildPauseWorkflowSummary flags a missing paused expectation for an active pause window', () => {
  const summary = buildPauseWorkflowSummary({
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: true,
    },
    paymentExpectation: 'stripe_active_expected',
  });

  assert.equal(summary.needsPausedExpectation, true);
  assert.match(summary.statusLine, /currently paused/i);
});

test('buildPauseWorkflowSummary flags a stale paused expectation after a pause has ended', () => {
  const summary = buildPauseWorkflowSummary({
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: false,
    },
    paymentExpectation: 'stripe_paused_expected',
  });

  assert.equal(summary.needsActiveExpectation, true);
  assert.match(summary.statusLine, /appears to have ended/i);
});

test('buildPauseWorkflowSummary flags a live Stripe mismatch when paused expectation still bills', () => {
  const summary = buildPauseWorkflowSummary({
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: true,
    },
    paymentExpectation: 'stripe_paused_expected',
    stripeSnapshot: {
      activelyBilling: true,
      pauseState: 'active',
    },
  });

  assert.equal(summary.liveStripeMismatch, true);
  assert.match(summary.statusLine, /live Stripe/i);
});
