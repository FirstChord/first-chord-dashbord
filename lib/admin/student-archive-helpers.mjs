import { randomUUID } from 'node:crypto';

function text(value = '') {
  return `${value || ''}`.trim();
}

export function normaliseStudentArchiveNote(value = '') {
  return text(value);
}

export function buildStudentArchiveEvent({
  previousStudent = {},
  student = {},
  actorEmail = '',
  occurredAt,
  note = '',
}) {
  const previousPaymentExpectation = previousStudent.paymentExpectation || '';
  const nextPaymentExpectation = student.paymentExpectation || '';

  return {
    eventId: randomUUID(),
    occurredAt,
    actorEmail,
    entityType: 'student',
    entityId: student.mmsId || previousStudent.mmsId || '',
    eventType: 'student_archive_marked',
    mmsId: student.mmsId || previousStudent.mmsId || '',
    studentName: student.fullName || previousStudent.fullName || student.mmsId || previousStudent.mmsId || '',
    issueId: '',
    payloadJson: JSON.stringify({
      source: 'admin_student_archive_workflow',
      action_label: 'Mark inactive / stopped',
      note: normaliseStudentArchiveNote(note),
      previous_payment_expectation: previousPaymentExpectation,
      next_payment_expectation: nextPaymentExpectation,
      registry_present: Boolean(student.registry || previousStudent.registry),
      stripe_customer_id_present: Boolean(student.stripeCustomerId || previousStudent.stripeCustomerId),
      stripe_subscription_id_present: Boolean(student.stripeSubscriptionId || previousStudent.stripeSubscriptionId),
      mms_changed: false,
      registry_deleted: false,
      stripe_changed: false,
    }),
  };
}

export function buildStudentExitStepEvent({
  student = {},
  actorEmail = '',
  occurredAt,
  eventType,
  actionLabel = '',
  note = '',
  payload = {},
}) {
  return {
    eventId: randomUUID(),
    occurredAt,
    actorEmail,
    entityType: 'student',
    entityId: student.mmsId || '',
    eventType,
    mmsId: student.mmsId || '',
    studentName: student.fullName || student.mmsId || '',
    issueId: '',
    payloadJson: JSON.stringify({
      source: 'admin_student_exit_workflow',
      action_label: actionLabel,
      note: normaliseStudentArchiveNote(note),
      ...payload,
    }),
  };
}
