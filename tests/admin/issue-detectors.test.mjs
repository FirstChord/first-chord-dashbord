import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPaymentIssues, buildPauseIssues } from '../../lib/admin/issue-detectors.mjs';

function student(overrides = {}) {
  return {
    mmsId: 'sdt_issue',
    fullName: 'Issue Example',
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_active_expected',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    ...overrides,
  };
}

test('static payment detector preserves setup and missing-linkage branches', () => {
  const types = buildPaymentIssues([
    student({ mmsId: 'both_missing', stripeCustomerId: '', stripeSubscriptionId: '' }),
    student({ mmsId: 'customer_missing', stripeCustomerId: '' }),
    student({ mmsId: 'subscription_missing', stripeSubscriptionId: '' }),
    student({ mmsId: 'setup_linked', paymentExpectation: 'setup_pending' }),
    student({ mmsId: 'setup_unlinked', paymentExpectation: 'setup_pending', stripeCustomerId: '', stripeSubscriptionId: '' }),
  ]).map((issue) => issue.type);

  assert.deepEqual(types, [
    'STRIPE SETUP INCOMPLETE',
    'STRIPE CUSTOMER MISSING',
    'STRIPE SUBSCRIPTION MISSING',
    'SETUP PENDING STRIPE LINKED',
  ]);
});

test('pause detector ignores low-confidence and upcoming pauses', () => {
  const issues = buildPauseIssues([
    student({
      mmsId: 'low',
      pauseSummary: { hasPauseHistory: true, currentlyPaused: true, matchConfidence: 'low' },
    }),
    student({
      mmsId: 'upcoming',
      paymentExpectation: 'stripe_paused_expected',
      pauseSummary: { hasPauseHistory: true, upcomingPause: true, matchConfidence: 'high' },
    }),
  ]);
  assert.deepEqual(issues, []);
});

test('pause detector emits only when the deterministic decision requires review', () => {
  const [issue] = buildPauseIssues([student({
    pauseSummary: { hasPauseHistory: true, currentlyPaused: true, matchConfidence: 'high' },
    pauseExpectationDecision: {
      shouldCreateIssue: true,
      expectedPaymentExpectation: 'stripe_paused_expected',
    },
  })]);
  assert.equal(issue.type, 'PAUSE EXPECTATION MISMATCH');
});
