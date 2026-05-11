import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPaymentFieldChangeEvent,
  buildPaymentIssueActionEvent,
  normaliseAuditContext,
  shouldLogPaymentIssueAction,
  validatePaymentAuditContext,
} from '../../lib/admin/payment-audit-helpers.mjs';

test('validatePaymentAuditContext requires a note for flags payment actions', () => {
  assert.equal(
    validatePaymentAuditContext({
      paymentExpectation: 'setup_pending',
      auditContext: {
        source: 'admin_flags_payment_action',
        issueId: 'payment_static:STRIPE_SUBSCRIPTION_MISSING:sdt_123',
        issueType: 'STRIPE SUBSCRIPTION MISSING',
        actionLabel: 'Set setup pending',
        note: '',
      },
    }),
    'A short note is required for payment actions from the issues page.',
  );
});

test('validatePaymentAuditContext keeps direct student-detail payment edits lightweight', () => {
  assert.equal(validatePaymentAuditContext({ paymentExpectation: 'setup_pending' }), '');
  assert.equal(
    validatePaymentAuditContext({
      paymentExpectation: 'setup_pending',
      auditContext: {
        source: 'admin_student_update',
      },
    }),
    '',
  );
});

test('normaliseAuditContext trims issue payment action context', () => {
  assert.deepEqual(
    normaliseAuditContext({
      source: ' admin_flags_payment_action ',
      issueId: ' payment_static:STRIPE_SUBSCRIPTION_MISSING:sdt_123 ',
      issueType: ' STRIPE SUBSCRIPTION MISSING ',
      actionLabel: ' Set setup pending ',
      note: ' Checked with Finn ',
    }),
    {
      source: 'admin_flags_payment_action',
      issueId: 'payment_static:STRIPE_SUBSCRIPTION_MISSING:sdt_123',
      issueType: 'STRIPE SUBSCRIPTION MISSING',
      actionLabel: 'Set setup pending',
      note: 'Checked with Finn',
    },
  );
});

test('buildPaymentFieldChangeEvent includes issue context in payload_json', () => {
  const event = buildPaymentFieldChangeEvent({
    student: {
      mmsId: 'sdt_123',
      fullName: 'Owen Example',
    },
    previousValue: 'stripe_active_expected',
    nextValue: 'setup_pending',
    fieldName: 'payment_expectation',
    eventType: 'payment_expectation_changed',
    actorEmail: 'admin@example.com',
    occurredAt: '2026-05-11T12:00:00.000Z',
    auditContext: {
      source: 'admin_flags_payment_action',
      issueId: 'payment_static:STRIPE_SUBSCRIPTION_MISSING:sdt_123',
      issueType: 'STRIPE SUBSCRIPTION MISSING',
      actionLabel: 'Set setup pending',
      note: 'Family has not completed setup yet.',
    },
  });

  const payload = JSON.parse(event.payloadJson);

  assert.equal(event.eventType, 'payment_expectation_changed');
  assert.equal(event.entityType, 'student');
  assert.equal(event.issueId, 'payment_static:STRIPE_SUBSCRIPTION_MISSING:sdt_123');
  assert.equal(payload.source, 'admin_flags_payment_action');
  assert.equal(payload.previous_value, 'stripe_active_expected');
  assert.equal(payload.next_value, 'setup_pending');
  assert.equal(payload.issue_type, 'STRIPE SUBSCRIPTION MISSING');
  assert.equal(payload.action_label, 'Set setup pending');
  assert.equal(payload.note, 'Family has not completed setup yet.');
});

test('buildPaymentIssueActionEvent records the issue-level payment outcome', () => {
  const event = buildPaymentIssueActionEvent({
    student: {
      mmsId: 'sdt_123',
      fullName: 'Owen Example',
    },
    actorEmail: 'admin@example.com',
    occurredAt: '2026-05-11T12:00:00.000Z',
    auditContext: {
      source: 'admin_flags_payment_action',
      issueId: 'payment_static:STRIPE_SUBSCRIPTION_MISSING:sdt_123',
      issueType: 'STRIPE SUBSCRIPTION MISSING',
      actionLabel: 'Set setup pending',
      note: 'Family has not completed setup yet.',
    },
    changedFields: ['payment_expectation'],
  });

  const payload = JSON.parse(event.payloadJson);

  assert.equal(event.eventType, 'payment_issue_action_taken');
  assert.equal(event.entityType, 'issue');
  assert.equal(event.entityId, 'payment_static:STRIPE_SUBSCRIPTION_MISSING:sdt_123');
  assert.deepEqual(payload.changed_fields, ['payment_expectation']);
  assert.equal(payload.note, 'Family has not completed setup yet.');
});

test('shouldLogPaymentIssueAction only logs changed issue-originated payment actions', () => {
  assert.equal(
    shouldLogPaymentIssueAction({ source: 'admin_flags_payment_action' }, ['payment_mode']),
    true,
  );
  assert.equal(
    shouldLogPaymentIssueAction({ source: 'admin_flags_payment_action' }, []),
    false,
  );
  assert.equal(
    shouldLogPaymentIssueAction({ source: 'admin_student_update' }, ['payment_mode']),
    false,
  );
});
