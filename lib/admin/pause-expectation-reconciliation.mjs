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

export function buildPauseExpectationReconciliationPlan(students = [], options = {}) {
  const rawPlan = buildPauseExpectationAutoSyncPlan(students, options);
  const byMmsId = new Map();

  for (const sync of rawPlan) {
    const existing = byMmsId.get(sync.mmsId);
    if (!existing) {
      byMmsId.set(sync.mmsId, {
        ...sync,
        sourceRecordCount: 1,
      });
      continue;
    }

    if (existing.nextPaymentExpectation !== sync.nextPaymentExpectation) {
      throw new Error(`Conflicting pause expectation changes were derived for ${sync.mmsId}`);
    }

    existing.sourceRecordCount += 1;
  }

  return [...byMmsId.values()];
}

export async function applyPauseExpectationReconciliation(
  students = [],
  {
    actorEmail = '',
    currentDate = new Date(),
    updateStudentPaymentExpectations,
    appendEvents,
  } = {},
) {
  const syncPlan = buildPauseExpectationReconciliationPlan(students, { currentDate });
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

  if (typeof updateStudentPaymentExpectations !== 'function' || typeof appendEvents !== 'function') {
    throw new Error('Pause expectation reconciliation requires explicit write adapters');
  }

  const studentByMmsId = new Map(students.map((student) => [student.mmsId, student]));
  const plannedEntries = syncPlan
    .map((sync) => ({
      sync,
      student: studentByMmsId.get(sync.mmsId),
    }))
    .filter(({ student }) => Boolean(student));

  function failWithPartialResult(error, stage, synced = []) {
    const outcome = stage === 'student_batch_write'
      ? 'unknown'
      : stage === 'completion_log'
        ? 'changes_applied_audit_unknown'
        : 'not_applied';
    const failure = new Error(error?.message || 'Pause expectation reconciliation failed');
    failure.cause = error;
    failure.partialResult = {
      checkedCount: students.length,
      plannedChangeCount: syncPlan.length,
      changeCount: synced.length,
      reconciledAt,
      synced,
      failed: {
        mmsIds: plannedEntries.map(({ sync }) => sync.mmsId),
        stage,
        outcome,
      },
    };
    return failure;
  }

  const attemptEvents = plannedEntries.map(({ student, sync }) => (
    buildPauseExpectationReconciliationAttemptEvent({
      student,
      previousValue: sync.previousPaymentExpectation,
      nextValue: sync.nextPaymentExpectation,
      actorEmail,
      occurredAt: reconciledAt,
      reason: sync.reason,
    })
  ));

  try {
    await appendEvents(attemptEvents);
  } catch (error) {
    throw failWithPartialResult(error, 'attempt_log');
  }

  try {
    await updateStudentPaymentExpectations(plannedEntries.map(({ sync }) => ({
      mmsId: sync.mmsId,
      nextPaymentExpectation: sync.nextPaymentExpectation,
    })));
  } catch (error) {
    throw failWithPartialResult(error, 'student_batch_write');
  }

  const synced = plannedEntries.map(({ student, sync }) => ({
    ...sync,
    studentName: student.fullName || sync.mmsId,
  }));
  const completionEvents = plannedEntries.map(({ student, sync }) => {
    const nextStudent = {
      ...student,
      paymentExpectation: sync.nextPaymentExpectation,
    };
    return buildPauseExpectationReconciliationEvent({
      student: nextStudent,
      previousValue: sync.previousPaymentExpectation,
      nextValue: sync.nextPaymentExpectation,
      actorEmail,
      occurredAt: reconciledAt,
      reason: sync.reason,
    });
  });

  try {
    await appendEvents(completionEvents);
  } catch (error) {
    throw failWithPartialResult(
      error,
      'completion_log',
      synced.map((entry) => ({ ...entry, completionLogMissing: true })),
    );
  }

  return {
    checkedCount: students.length,
    plannedChangeCount: syncPlan.length,
    changeCount: synced.length,
    reconciledAt,
    synced,
  };
}
