import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPayrollWorkflowState,
  isPayrollRunReadyForPayment,
  normalisePayrollPaymentRoute,
} from '../../lib/admin/payroll-workflow-helpers.mjs';

test('normal payment remains the safe transitional default', () => {
  assert.equal(normalisePayrollPaymentRoute(''), 'normal');
  assert.equal(isPayrollRunReadyForPayment({ status: 'reviewed' }), true);
  assert.equal(getPayrollWorkflowState({ status: 'reviewed' }).key, 'ready');
});

test('confirmation route waits for a tutor response before payment', () => {
  const reviewed = { status: 'reviewed', paymentRoute: 'confirmation' };
  assert.equal(getPayrollWorkflowState(reviewed).key, 'send');
  assert.equal(getPayrollWorkflowState({ ...reviewed, statementSentAt: '2026-07-12T10:00:00Z' }).key, 'awaiting');
  assert.equal(isPayrollRunReadyForPayment({ ...reviewed, tutorResponse: '' }), false);
  assert.equal(isPayrollRunReadyForPayment({ ...reviewed, tutorResponse: 'confirmed' }), true);
});

test('disputes and attendance exceptions take precedence over payment readiness', () => {
  assert.equal(isPayrollRunReadyForPayment({ status: 'reviewed', tutorResponse: 'disputed' }), false);
  assert.equal(getPayrollWorkflowState({ status: 'reviewed', paymentRoute: 'normal', tutorResponse: 'disputed' }).key, 'disputed');
  assert.equal(getPayrollWorkflowState({ status: 'draft', reviewPastCount: 1 }).key, 'attendance');
  assert.equal(getPayrollWorkflowState({ status: 'paid' }).key, 'paid');
});
