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
