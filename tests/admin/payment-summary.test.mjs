import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPaymentOperationsSummary } from '../../lib/admin/payment-summary.mjs';

test('buildPaymentOperationsSummary counts payment modes and expectations', () => {
  const summary = buildPaymentOperationsSummary([
    {
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_active_expected',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
    },
    {
      paymentMode: 'stripe',
      paymentExpectation: 'setup_pending',
      stripeCustomerId: 'cus_2',
      stripeSubscriptionId: '',
    },
    {
      paymentMode: 'manual',
      paymentExpectation: '',
      stripeCustomerId: '',
      stripeSubscriptionId: '',
    },
    {
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_paused_expected',
      stripeCustomerId: '',
      stripeSubscriptionId: '',
    },
    {
      paymentMode: 'unknown',
      paymentExpectation: 'inactive_or_stopped',
      stripeCustomerId: '',
      stripeSubscriptionId: '',
    },
  ]);

  assert.equal(summary.totalStudents, 5);
  assert.equal(summary.stripeManaged, 3);
  assert.equal(summary.manualPayers, 1);
  assert.equal(summary.unknownPaymentMode, 1);
  assert.equal(summary.setupPending, 1);
  assert.equal(summary.pausedExpected, 1);
  assert.equal(summary.inactiveOrStopped, 1);
  assert.equal(summary.activeExpected, 1);
  assert.equal(summary.linkedStripeCustomers, 2);
  assert.equal(summary.linkedStripeSubscriptions, 1);
  assert.equal(summary.stripeLinkingGaps, 1);
});
