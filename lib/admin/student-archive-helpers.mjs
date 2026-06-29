import { randomUUID } from 'node:crypto';

function text(value = '') {
  return `${value || ''}`.trim();
}

export function normaliseStudentArchiveNote(value = '') {
  return text(value);
}

// The deterministic leave date: a "YYYY-MM" month/year. Returns '' if not a valid month.
export function normaliseLeftMonth(value = '') {
  const match = /^(\d{4})-(\d{2})$/u.exec(text(value));
  if (!match) return '';
  const month = Number(match[2]);
  if (month < 1 || month > 12) return '';
  return `${match[1]}-${match[2]}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatLeftMonthLabel(value = '') {
  const left = normaliseLeftMonth(value);
  if (!left) return '';
  const [year, month] = left.split('-');
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

// One combined "student left" event — the leave month is the record, plus a summary of
// what the single action did (so the audit trail is complete without per-step prompts).
export function buildStudentLeftEvent({
  student = {},
  actorEmail = '',
  occurredAt,
  leftMonth = '',
  note = '',
  steps = {},
}) {
  const left = normaliseLeftMonth(leftMonth);
  return {
    eventId: randomUUID(),
    occurredAt,
    actorEmail,
    entityType: 'student',
    entityId: student.mmsId || '',
    eventType: 'student_left',
    mmsId: student.mmsId || '',
    studentName: student.fullName || student.mmsId || '',
    issueId: '',
    payloadJson: JSON.stringify({
      source: 'admin_student_exit_workflow',
      action_label: 'Mark student as left',
      left_month: left,
      left_month_label: formatLeftMonthLabel(left),
      note: normaliseStudentArchiveNote(note),
      inactive_marked: Boolean(steps.inactiveMarked),
      registry_deleted: Boolean(steps.registryDeleted),
      mms_inactive: Boolean(steps.mmsInactive),
      mms_already_inactive: Boolean(steps.mmsAlreadyInactive),
      sheet_archived: Boolean(steps.sheetArchived),
    }),
  };
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
