import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveStudentLifecycleStatus } from '../../lib/admin/lifecycle-helpers.mjs';

test('deriveStudentLifecycleStatus treats setup pending as expected setup work', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    mmsId: 'sdt_setup',
    paymentMode: 'stripe',
    paymentExpectation: 'setup_pending',
    stripeSubscriptionId: '',
  });

  assert.equal(lifecycle.lifecycleStatus, 'setup_pending');
  assert.equal(lifecycle.lifecycleConfidence, 'high');
  assert.match(lifecycle.lifecycleWarnings.join(' '), /may be expected/);
});

test('deriveStudentLifecycleStatus marks aligned current pauses as high-confidence paused', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    mmsId: 'sdt_paused',
    paymentExpectation: 'stripe_paused_expected',
    pauseSummary: {
      currentlyPaused: true,
      hasPauseHistory: true,
    },
  });

  assert.equal(lifecycle.lifecycleStatus, 'paused');
  assert.equal(lifecycle.lifecycleConfidence, 'high');
  assert.equal(lifecycle.lifecycleWarnings.length, 0);
});

test('deriveStudentLifecycleStatus warns when current pause and expectation disagree', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    mmsId: 'sdt_pause_mismatch',
    paymentExpectation: 'stripe_active_expected',
    pauseSummary: {
      currentlyPaused: true,
      hasPauseHistory: true,
    },
  });

  assert.equal(lifecycle.lifecycleStatus, 'paused');
  assert.equal(lifecycle.lifecycleConfidence, 'medium');
  assert.match(lifecycle.lifecycleWarnings.join(' '), /do not agree/);
});

test('deriveStudentLifecycleStatus flags paused expectation without current pause for review', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    mmsId: 'sdt_stale_pause',
    paymentExpectation: 'stripe_paused_expected',
    pauseSummary: {
      currentlyPaused: false,
      hasPauseHistory: true,
    },
  });

  assert.equal(lifecycle.lifecycleStatus, 'needs_review');
  assert.equal(lifecycle.lifecycleConfidence, 'medium');
});

test('deriveStudentLifecycleStatus marks inactive expectation as stopped', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    mmsId: 'sdt_stopped',
    paymentExpectation: 'inactive_or_stopped',
  });

  assert.equal(lifecycle.lifecycleStatus, 'stopped');
  assert.equal(lifecycle.lifecycleConfidence, 'high');
});

test('deriveStudentLifecycleStatus marks active expected with complete Stripe linkage as active', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    mmsId: 'sdt_active',
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_active_expected',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    registry: { mmsId: 'sdt_active' },
  });

  assert.equal(lifecycle.lifecycleStatus, 'active');
  assert.equal(lifecycle.lifecycleConfidence, 'high');
});

test('deriveStudentLifecycleStatus warns when active expected has incomplete Stripe linkage', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    mmsId: 'sdt_active_gap',
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_active_expected',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: '',
    registry: { mmsId: 'sdt_active_gap' },
  });

  assert.equal(lifecycle.lifecycleStatus, 'active');
  assert.equal(lifecycle.lifecycleConfidence, 'medium');
  assert.match(lifecycle.lifecycleWarnings.join(' '), /Stripe linkage is incomplete/);
});

test('deriveStudentLifecycleStatus maps waiting-list states', () => {
  assert.equal(deriveStudentLifecycleStatus({ mmsId: 'sdt_waiting', waitingStatus: 'contacted' }).lifecycleStatus, 'waiting');
  assert.equal(deriveStudentLifecycleStatus({ mmsId: 'sdt_onboarding', waitingStatus: 'onboarding_ready' }).lifecycleStatus, 'onboarding');
});

test('deriveStudentLifecycleStatus lets active payment expectation override stale waiting state', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    mmsId: 'sdt_active_waiting_state',
    waitingStatus: 'contacted',
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_active_expected',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    registry: { mmsId: 'sdt_active_waiting_state' },
  });

  assert.equal(lifecycle.lifecycleStatus, 'active');
  assert.equal(lifecycle.lifecycleConfidence, 'high');
});

test('deriveStudentLifecycleStatus treats manual payers as active without requiring Stripe linkage', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    mmsId: 'sdt_manual',
    fullName: 'Manual Payer',
    paymentMode: 'manual',
    paymentExpectation: '',
    waitingStatus: 'contacted',
    stripeCustomerId: '',
    stripeSubscriptionId: '',
  });

  assert.equal(lifecycle.lifecycleStatus, 'active');
  assert.equal(lifecycle.lifecycleConfidence, 'medium');
  assert.match(lifecycle.lifecycleReasons.join(' '), /manual/);
  assert.equal(lifecycle.lifecycleWarnings.length, 0);
});

test('deriveStudentLifecycleStatus flags missing core identity before treating manual mode as active', () => {
  const lifecycle = deriveStudentLifecycleStatus({
    hasSheetRow: false,
    paymentMode: 'manual',
    paymentExpectation: '',
  });

  assert.equal(lifecycle.lifecycleStatus, 'needs_review');
  assert.match(lifecycle.lifecycleWarnings.join(' '), /core student record/);
});
