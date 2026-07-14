import { buildPauseExpectationAutoSyncPlan } from './pause-auto-sync-helpers.mjs';
import { buildPauseExpectationReconciliationEvent } from './payment-audit-helpers.mjs';

function toIsoTimestamp(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

export async function applyPauseExpectationReconciliation(
  students = [],
  {
    actorEmail = '',
    currentDate = new Date(),
    updateStudentPaymentExpectation,
    appendEvents,
  } = {},
) {
  const syncPlan = buildPauseExpectationAutoSyncPlan(students, { currentDate });
  const reconciledAt = toIsoTimestamp(currentDate);

  if (!syncPlan.length) {
    return {
      checkedCount: students.length,
      changeCount: 0,
      reconciledAt,
      synced: [],
    };
  }

  if (typeof updateStudentPaymentExpectation !== 'function' || typeof appendEvents !== 'function') {
    throw new Error('Pause expectation reconciliation requires explicit write adapters');
  }

  const studentByMmsId = new Map(students.map((student) => [student.mmsId, student]));
  const synced = [];
  const eventRows = [];

  for (const sync of syncPlan) {
    const student = studentByMmsId.get(sync.mmsId);
    if (!student) continue;

    await updateStudentPaymentExpectation(sync.mmsId, sync.nextPaymentExpectation);

    const nextStudent = {
      ...student,
      paymentExpectation: sync.nextPaymentExpectation,
    };
    studentByMmsId.set(sync.mmsId, nextStudent);
    synced.push({
      ...sync,
      studentName: student.fullName || sync.mmsId,
    });
    eventRows.push(buildPauseExpectationReconciliationEvent({
      student: nextStudent,
      previousValue: sync.previousPaymentExpectation,
      nextValue: sync.nextPaymentExpectation,
      actorEmail,
      occurredAt: reconciledAt,
      reason: sync.reason,
    }));
  }

  if (eventRows.length) {
    await appendEvents(eventRows);
  }

  return {
    checkedCount: students.length,
    changeCount: synced.length,
    reconciledAt,
    synced,
  };
}
