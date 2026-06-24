import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLiveStripeIssues,
  buildStripeSnapshot,
  deriveStripeInvoiceSummary,
  deriveStripePauseState,
} from '../../lib/admin/stripe-snapshot-helpers.mjs';

test('deriveStripePauseState detects pause_collection and zero-quantity scheduled pauses', () => {
  assert.equal(deriveStripePauseState({ pause_collection: { behavior: 'void' } }), 'paused');
  assert.equal(
    deriveStripePauseState({
      items: {
        data: [{ quantity: 0 }],
      },
    }),
    'paused',
  );
  assert.equal(
    deriveStripePauseState({
      items: {
        data: [{ quantity: 1 }],
      },
    }),
    'active',
  );
});

test('deriveStripeInvoiceSummary marks payment problems from invoice or payment intent state', () => {
  const invoice = deriveStripeInvoiceSummary({
    id: 'in_123',
    status: 'past_due',
    paid: false,
    attempt_count: 2,
    created: 1777000000,
    payment_intent: {
      status: 'requires_payment_method',
    },
  });

  assert.equal(invoice.hasPaymentProblem, true);
  assert.equal(invoice.latestInvoiceStatus, 'past_due');
  assert.equal(invoice.latestPaymentIntentStatus, 'requires_payment_method');
});

test('deriveStripeInvoiceSummary marks void invoices with a remaining balance for review', () => {
  const invoice = deriveStripeInvoiceSummary({
    id: 'in_void',
    status: 'void',
    paid: false,
    amount_due: 2500,
    amount_remaining: 2500,
    billing_reason: 'subscription_cycle',
    status_transitions: {
      voided_at: 1780444877,
    },
  });

  assert.equal(invoice.hasPaymentProblem, true);
  assert.equal(invoice.latestInvoiceStatus, 'void');
  assert.equal(invoice.latestInvoiceAmountRemaining, 2500);
  assert.equal(invoice.latestInvoiceBillingReason, 'subscription_cycle');
  assert.equal(invoice.latestInvoiceVoidWithBalance, true);
});

test('buildStripeSnapshot derives actively billing only for non-paused billable statuses', () => {
  const activeSnapshot = buildStripeSnapshot({
    customer: { id: 'cus_123' },
    subscription: {
      id: 'sub_123',
      status: 'active',
      items: { data: [{ quantity: 1 }] },
    },
  });

  const pausedSnapshot = buildStripeSnapshot({
    customer: { id: 'cus_123' },
    subscription: {
      id: 'sub_123',
      status: 'active',
      pause_collection: { behavior: 'void' },
      items: { data: [{ quantity: 1 }] },
    },
  });

  assert.equal(activeSnapshot.activelyBilling, true);
  assert.equal(pausedSnapshot.activelyBilling, false);
});

test('buildLiveStripeIssues flags paused-expected students who are still actively billing', () => {
  const issues = buildLiveStripeIssues({
    student: {
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_paused_expected',
    },
    snapshot: {
      subscriptionFound: true,
      subscriptionStatus: 'active',
      pauseState: 'active',
      activelyBilling: true,
      hasPaymentProblem: false,
    },
  });

  assert.deepEqual(issues, ['SUBSCRIPTION_STATE_MISMATCH']);
});

test('buildLiveStripeIssues suppresses active Stripe during an allowed pause bridge before the next lesson', () => {
  const issues = buildLiveStripeIssues({
    student: {
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_paused_expected',
      pauseExpectationDecision: {
        allowsActiveBillingBeforeNextLesson: true,
      },
    },
    snapshot: {
      subscriptionFound: true,
      subscriptionStatus: 'active',
      pauseState: 'active',
      activelyBilling: true,
      hasPaymentProblem: false,
    },
  });

  assert.deepEqual(issues, []);
});


test('buildLiveStripeIssues flags active students with payment failures and missing subscriptions', () => {
  const issues = buildLiveStripeIssues({
    student: {
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_active_expected',
    },
    snapshot: {
      subscriptionFound: false,
      subscriptionStatus: '',
      pauseState: 'not_found',
      activelyBilling: false,
      hasPaymentProblem: true,
    },
  });

  assert.deepEqual(issues, ['ACTIVE_WITHOUT_SUBSCRIPTION', 'PAYMENT_FAILED']);
});

test('buildLiveStripeIssues flags paused-expected void invoices when the subscription is past due', () => {
  const issues = buildLiveStripeIssues({
    student: {
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_paused_expected',
    },
    snapshot: {
      subscriptionFound: true,
      subscriptionStatus: 'past_due',
      pauseState: 'paused',
      activelyBilling: false,
      hasPaymentProblem: true,
      latestInvoiceStatus: 'void',
      latestInvoiceVoidWithBalance: true,
    },
  });

  assert.deepEqual(issues, ['PAYMENT_FAILED']);
});

test('buildLiveStripeIssues does not flag paused-expected void invoices when the subscription is otherwise healthy', () => {
  const issues = buildLiveStripeIssues({
    student: {
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_paused_expected',
    },
    snapshot: {
      subscriptionFound: true,
      subscriptionStatus: 'active',
      pauseState: 'paused',
      activelyBilling: false,
      hasPaymentProblem: true,
      latestInvoiceStatus: 'void',
      latestInvoiceVoidWithBalance: true,
    },
  });

  assert.deepEqual(issues, []);
});
