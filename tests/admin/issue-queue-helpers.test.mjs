import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIssueContextKey,
  buildIssueId,
  normaliseIssueStatus,
  normaliseIssueTypeKey,
} from '../../lib/admin/issue-queue-helpers.mjs';

test('normaliseIssueTypeKey converts issue labels into stable key segments', () => {
  assert.equal(normaliseIssueTypeKey('Stripe Subscription Missing'), 'STRIPE_SUBSCRIPTION_MISSING');
  assert.equal(normaliseIssueTypeKey('  tutor conflict  '), 'TUTOR_CONFLICT');
});

test('buildIssueContextKey derives the expected queue context for known edge cases', () => {
  assert.equal(buildIssueContextKey({ type: 'TUTOR CONFLICT' }), 'registry_vs_sheets');
  assert.equal(buildIssueContextKey({ type: 'PAYMENT_FAILED', stripeSubscriptionId: 'sub_123' }), 'sub_123');
  assert.equal(buildIssueContextKey({ type: 'PAYMENT_RETRYING', stripeSubscriptionId: 'sub_retry' }), 'sub_retry');
  assert.equal(buildIssueContextKey({ type: 'SHEETS ONLY' }), '');
});

test('buildIssueId supports optional context keys', () => {
  assert.equal(
    buildIssueId({
      source: 'stripe_live',
      issueType: 'PAYMENT FAILED',
      mmsId: 'sdt_123',
      contextKey: 'sub_456',
    }),
    'stripe_live:PAYMENT_FAILED:sdt_123:sub_456',
  );

  assert.equal(
    buildIssueId({
      source: 'payment_static',
      issueType: 'STRIPE SUBSCRIPTION MISSING',
      mmsId: 'sdt_123',
    }),
    'payment_static:STRIPE_SUBSCRIPTION_MISSING:sdt_123',
  );
});

test('normaliseIssueStatus constrains queue statuses to the supported set', () => {
  assert.equal(normaliseIssueStatus('acknowledged'), 'acknowledged');
  assert.equal(normaliseIssueStatus('ignored'), 'ignored');
  assert.equal(normaliseIssueStatus('other'), 'open');
});
