export const PAYROLL_PAYMENT_ROUTES = [
  { value: 'normal', label: 'Pay normally' },
  { value: 'confirmation', label: 'Tutor confirmation' },
];

export function normalisePayrollPaymentRoute(value) {
  return `${value || ''}`.trim().toLowerCase() === 'confirmation' ? 'confirmation' : 'normal';
}

export function isPayrollRunReadyForPayment(row = {}) {
  const status = `${row.status || row.Status || ''}`.trim().toLowerCase();
  const response = `${row.tutor_response ?? row.tutorResponse ?? ''}`.trim().toLowerCase();
  if (status !== 'reviewed' || response === 'disputed') return false;
  return normalisePayrollPaymentRoute(row.payment_route ?? row.paymentRoute) === 'normal'
    || response === 'confirmed';
}

export function getPayrollWorkflowState(row = {}) {
  const status = `${row.status || ''}`.trim().toLowerCase() || 'draft';
  const response = `${row.tutorResponse ?? row.tutor_response ?? ''}`.trim().toLowerCase();
  const route = normalisePayrollPaymentRoute(row.paymentRoute ?? row.payment_route);

  if (status === 'paid') {
    return { key: 'paid', label: 'Paid', tone: 'complete', nextAction: 'Complete', readyForPayment: false };
  }
  if (row.overlapsPaid) {
    return { key: 'window_conflict', label: 'Check period', tone: 'danger', nextAction: 'Correct the pay period', readyForPayment: false };
  }
  if (Number(row.reviewPastCount || 0) > 0) {
    return { key: 'attendance', label: 'Needs review', tone: 'warning', nextAction: 'Record attendance in MMS', readyForPayment: false };
  }
  if (status !== 'reviewed') {
    return { key: 'review', label: 'Needs review', tone: 'attention', nextAction: 'Review and generate statement', readyForPayment: false };
  }
  if (response === 'disputed') {
    return { key: 'disputed', label: 'Tutor query', tone: 'danger', nextAction: 'Resolve the tutor query', readyForPayment: false };
  }
  if (route === 'normal') {
    return { key: 'ready', label: 'Ready to pay', tone: 'ready', nextAction: 'Include in the next payment', readyForPayment: true };
  }
  if (response === 'confirmed') {
    return { key: 'ready', label: 'Ready to pay', tone: 'ready', nextAction: 'Include in the next payment', readyForPayment: true };
  }
  if (!row.statementSentAt && !row.statement_sent_at) {
    return { key: 'send', label: 'Ready to send', tone: 'attention', nextAction: 'Send the pay statement', readyForPayment: false };
  }
  return { key: 'awaiting', label: 'Awaiting tutor', tone: 'waiting', nextAction: 'Waiting for tutor confirmation', readyForPayment: false };
}
