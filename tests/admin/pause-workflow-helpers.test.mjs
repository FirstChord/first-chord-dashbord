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
  assert.equal(summary.state, 'Pause record alignment needed');
  assert.equal(summary.recordAligned, false);
  assert.match(summary.statusLine, /currently paused/i);
  assert.match(summary.nextAction, /payment expectation still needs confirming/i);
  assert.match(summary.closureCondition, /payment expectation says Stripe paused expected/i);
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
  assert.equal(summary.state, 'Stale pause expectation');
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
  assert.equal(summary.state, 'Stripe action needed');
  assert.equal(summary.isClosed, false);
  assert.match(summary.statusLine, /live Stripe/i);
});

test('buildPauseWorkflowSummary names records-aligned state before live Stripe is checked', () => {
  const summary = buildPauseWorkflowSummary({
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: true,
    },
    paymentExpectation: 'stripe_paused_expected',
  });

  assert.equal(summary.recordAligned, true);
  assert.equal(summary.liveStripeChecked, false);
  assert.equal(summary.state, 'Records aligned');
  assert.match(summary.nextAction, /Refresh live Stripe/i);
});

test('buildPauseWorkflowSummary closes the loop when records and live Stripe agree', () => {
  const summary = buildPauseWorkflowSummary({
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: false,
    },
    paymentExpectation: 'stripe_active_expected',
    stripeSnapshot: {
      activelyBilling: true,
      pauseState: 'active',
    },
  });

  assert.equal(summary.recordAligned, true);
  assert.equal(summary.liveStripeChecked, true);
  assert.equal(summary.liveStripeAligned, true);
  assert.equal(summary.isClosed, true);
  assert.equal(summary.state, 'Loop closed');
});

test('buildPauseWorkflowSummary treats future pause windows as scheduled, not active mismatches', () => {
  const summary = buildPauseWorkflowSummary({
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: false,
      upcomingPause: true,
      latestPause: {
        startDate: '2026-05-28',
        endDate: '2026-06-03',
      },
    },
    paymentExpectation: 'stripe_active_expected',
  });

  assert.equal(summary.upcomingPause, true);
  assert.equal(summary.needsPausedExpectation, false);
  assert.equal(summary.needsActiveExpectation, false);
  assert.equal(summary.recordAligned, false);
  assert.equal(summary.state, 'Upcoming pause scheduled');
  assert.match(summary.statusLine, /upcoming pause window/i);
});
