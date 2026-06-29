import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStudentArchiveEvent,
  buildStudentExitStepEvent,
  buildStudentLeftEvent,
  formatLeftMonthLabel,
  normaliseLeftMonth,
  normaliseStudentArchiveNote,
} from '../../lib/admin/student-archive-helpers.mjs';

test('normaliseStudentArchiveNote trims notes', () => {
  assert.equal(normaliseStudentArchiveNote('  Left after summer term  '), 'Left after summer term');
});

test('buildStudentArchiveEvent records archive boundaries without external writes', () => {
  const event = buildStudentArchiveEvent({
    previousStudent: {
      mmsId: 'sdt_123',
      fullName: 'Ava Example',
      paymentExpectation: 'stripe_active_expected',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
    },
    student: {
      mmsId: 'sdt_123',
      fullName: 'Ava Example',
      paymentExpectation: 'inactive_or_stopped',
      registry: { mmsId: 'sdt_123' },
    },
    actorEmail: 'admin@example.com',
    occurredAt: '2026-06-04T12:00:00.000Z',
    note: 'Parent confirmed lessons have ended.',
  });
  const payload = JSON.parse(event.payloadJson);

  assert.equal(event.eventType, 'student_archive_marked');
  assert.equal(event.entityType, 'student');
  assert.equal(event.entityId, 'sdt_123');
  assert.equal(payload.source, 'admin_student_archive_workflow');
  assert.equal(payload.previous_payment_expectation, 'stripe_active_expected');
  assert.equal(payload.next_payment_expectation, 'inactive_or_stopped');
  assert.equal(payload.registry_present, true);
  assert.equal(payload.stripe_customer_id_present, true);
  assert.equal(payload.stripe_subscription_id_present, true);
  assert.equal(payload.mms_changed, false);
  assert.equal(payload.registry_deleted, false);
  assert.equal(payload.stripe_changed, false);
  assert.equal(payload.note, 'Parent confirmed lessons have ended.');
});

test('normaliseLeftMonth accepts valid YYYY-MM and rejects junk', () => {
  assert.equal(normaliseLeftMonth('2026-06'), '2026-06');
  assert.equal(normaliseLeftMonth('  2026-12 '), '2026-12');
  assert.equal(normaliseLeftMonth('2026-13'), '');
  assert.equal(normaliseLeftMonth('2026-00'), '');
  assert.equal(normaliseLeftMonth('2026-6'), '');
  assert.equal(normaliseLeftMonth(''), '');
  assert.equal(normaliseLeftMonth('June 2026'), '');
});

test('formatLeftMonthLabel renders a friendly month/year', () => {
  assert.equal(formatLeftMonthLabel('2026-06'), 'June 2026');
  assert.equal(formatLeftMonthLabel('2026-01'), 'January 2026');
  assert.equal(formatLeftMonthLabel('nonsense'), '');
});

test('buildStudentLeftEvent records the leave month and what the one-click did', () => {
  const event = buildStudentLeftEvent({
    student: { mmsId: 'sdt_123', fullName: 'Ava Example' },
    actorEmail: 'admin@example.com',
    occurredAt: '2026-06-04T12:00:00.000Z',
    leftMonth: '2026-06',
    note: 'Left June 2026',
    steps: { inactiveMarked: true, registryDeleted: true, mmsInactive: true, sheetArchived: true },
  });
  const payload = JSON.parse(event.payloadJson);

  assert.equal(event.eventType, 'student_left');
  assert.equal(event.entityId, 'sdt_123');
  assert.equal(payload.left_month, '2026-06');
  assert.equal(payload.left_month_label, 'June 2026');
  assert.equal(payload.inactive_marked, true);
  assert.equal(payload.registry_deleted, true);
  assert.equal(payload.mms_inactive, true);
  assert.equal(payload.sheet_archived, true);
});

test('buildStudentExitStepEvent records named exit workflow steps', () => {
  const event = buildStudentExitStepEvent({
    student: {
      mmsId: 'sdt_123',
      fullName: 'Ava Example',
    },
    actorEmail: 'admin@example.com',
    occurredAt: '2026-06-04T12:10:00.000Z',
    eventType: 'student_exit_registry_deleted',
    actionLabel: 'Delete registry entry',
    note: 'Student has left and portal access should close.',
    payload: {
      registry_deleted: true,
    },
  });
  const payload = JSON.parse(event.payloadJson);

  assert.equal(event.eventType, 'student_exit_registry_deleted');
  assert.equal(event.entityType, 'student');
  assert.equal(event.entityId, 'sdt_123');
  assert.equal(payload.source, 'admin_student_exit_workflow');
  assert.equal(payload.action_label, 'Delete registry entry');
  assert.equal(payload.registry_deleted, true);
  assert.equal(payload.note, 'Student has left and portal access should close.');
});
