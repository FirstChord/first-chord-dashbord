import { randomUUID } from 'node:crypto';

const FLAGS_PAYMENT_ACTION_SOURCE = 'admin_flags_payment_action';

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function normaliseText(value) {
  return `${value || ''}`.trim();
}

export function normaliseAuditContext(auditContext = {}) {
  if (!auditContext || typeof auditContext !== 'object') {
    return {};
  }

  return {
    source: normaliseText(auditContext.source),
    issueId: normaliseText(auditContext.issueId),
    issueType: normaliseText(auditContext.issueType),
    actionLabel: normaliseText(auditContext.actionLabel),
    note: normaliseText(auditContext.note),
  };
}

export function validatePaymentAuditContext(payload = {}) {
  const auditContext = normaliseAuditContext(payload.auditContext);
  const changesPaymentField = hasOwn(payload, 'paymentMode') || hasOwn(payload, 'paymentExpectation');

  if (
    changesPaymentField &&
    auditContext.source === FLAGS_PAYMENT_ACTION_SOURCE &&
    !auditContext.note
  ) {
    return 'A short note is required for payment actions from the issues page.';
  }

  return '';
}

function buildAuditPayload({
  auditContext = {},
  source = 'admin_student_update',
  previousValue = '',
  nextValue = '',
  fieldName = '',
}) {
  return JSON.stringify({
    previous_value: previousValue || '',
    next_value: nextValue || '',
    source,
    issue_id: auditContext.issueId || '',
    issue_type: auditContext.issueType || '',
    action_label: auditContext.actionLabel || '',
    note: auditContext.note || '',
    field_name: fieldName || '',
  });
}

export function buildPaymentFieldChangeEvent({
  student,
  previousValue = '',
  nextValue = '',
  fieldName,
  eventType,
  actorEmail = '',
  occurredAt,
  auditContext = {},
}) {
  const source = auditContext.source || 'admin_student_update';

  return {
    eventId: randomUUID(),
    occurredAt,
    actorEmail,
    entityType: 'student',
    entityId: student.mmsId,
    eventType,
    mmsId: student.mmsId,
    studentName: student.fullName || student.mmsId,
    issueId: auditContext.issueId || '',
    payloadJson: buildAuditPayload({
      auditContext,
      source,
      previousValue,
      nextValue,
      fieldName,
    }),
  };
}

export function buildPaymentIssueActionEvent({
  student,
  actorEmail = '',
  occurredAt,
  auditContext = {},
  changedFields = [],
}) {
  return {
    eventId: randomUUID(),
    occurredAt,
    actorEmail,
    entityType: 'issue',
    entityId: auditContext.issueId || '',
    eventType: 'payment_issue_action_taken',
    mmsId: student.mmsId,
    studentName: student.fullName || student.mmsId,
    issueId: auditContext.issueId || '',
    payloadJson: JSON.stringify({
      source: auditContext.source || '',
      issue_id: auditContext.issueId || '',
      issue_type: auditContext.issueType || '',
      action_label: auditContext.actionLabel || '',
      note: auditContext.note || '',
      changed_fields: changedFields,
    }),
  };
}

export function shouldLogPaymentIssueAction(auditContext = {}, changedFields = []) {
  return auditContext.source === FLAGS_PAYMENT_ACTION_SOURCE && changedFields.length > 0;
}
