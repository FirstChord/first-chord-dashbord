import { buildPauseExpectationAutoSyncPlan } from './pause-auto-sync-helpers.mjs';
import {
  buildPauseExpectationReconciliationAttemptEvent,
  buildPauseExpectationReconciliationEvent,
} from './payment-audit-helpers.mjs';

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
      plannedChangeCount: 0,
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

  function failWithPartialResult(error, sync, stage) {
    const failure = new Error(error?.message || 'Pause expectation reconciliation failed');
    failure.cause = error;
    failure.partialResult = {
      checkedCount: students.length,
      plannedChangeCount: syncPlan.length,
      changeCount: synced.length,
      reconciledAt,
      synced,
      failed: {
        mmsId: sync.mmsId,
        nextPaymentExpectation: sync.nextPaymentExpectation,
        stage,
      },
    };
    return failure;
  }

  for (const sync of syncPlan) {
    const student = studentByMmsId.get(sync.mmsId);
    if (!student) continue;

    const attemptEvent = buildPauseExpectationReconciliationAttemptEvent({
      student,
      previousValue: sync.previousPaymentExpectation,
      nextValue: sync.nextPaymentExpectation,
      actorEmail,
      occurredAt: reconciledAt,
      reason: sync.reason,
    });
    try {
      await appendEvents([attemptEvent]);
    } catch (error) {
      throw failWithPartialResult(error, sync, 'attempt_log');
    }

    try {
      await updateStudentPaymentExpectation(sync.mmsId, sync.nextPaymentExpectation);
    } catch (error) {
      throw failWithPartialResult(error, sync, 'student_write');
    }

    const nextStudent = {
      ...student,
      paymentExpectation: sync.nextPaymentExpectation,
    };
    studentByMmsId.set(sync.mmsId, nextStudent);
    const syncedEntry = {
      ...sync,
      studentName: student.fullName || sync.mmsId,
    };
    const completionEvent = buildPauseExpectationReconciliationEvent({
      student: nextStudent,
      previousValue: sync.previousPaymentExpectation,
      nextValue: sync.nextPaymentExpectation,
      actorEmail,
      occurredAt: reconciledAt,
      reason: sync.reason,
    });
    try {
      await appendEvents([completionEvent]);
    } catch (error) {
      synced.push({ ...syncedEntry, completionLogMissing: true });
      throw failWithPartialResult(error, sync, 'completion_log');
    }
    synced.push(syncedEntry);
  }

  return {
    checkedCount: students.length,
    plannedChangeCount: syncPlan.length,
    changeCount: synced.length,
    reconciledAt,
    synced,
  };
}
