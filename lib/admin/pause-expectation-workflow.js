/** @fileoverview Loads student context and writes reconciled payment expectations with their event-log entries. */
import {
  appendEventLogRows,
  updateStudentPaymentExpectationRows,
} from '@/lib/admin/sheets';
import {
  applyPauseExpectationReconciliation,
  buildPauseExpectationReconciliationPlan,
} from './pause-expectation-reconciliation.mjs';
import { loadStudentContextCollection } from './student-context';

async function loadReconciliationContext() {
  const { students } = await loadStudentContextCollection({
    includeSchedule: true,
    excludeTestStudents: true,
  });
  return students;
}

export async function getPauseExpectationReconciliationPreview() {
  const students = await loadReconciliationContext();
  const studentByMmsId = new Map(students.map((student) => [student.mmsId, student]));
  const changes = buildPauseExpectationReconciliationPlan(students).map((change) => ({
    ...change,
    studentName: studentByMmsId.get(change.mmsId)?.fullName || change.mmsId,
  }));

  return {
    checkedCount: students.length,
    changeCount: changes.length,
    changes,
  };
}

export async function reconcilePauseExpectations({ actorEmail = '' } = {}) {
  const students = await loadReconciliationContext();
  return applyPauseExpectationReconciliation(students, {
    actorEmail,
    updateStudentPaymentExpectations: updateStudentPaymentExpectationRows,
    appendEvents: appendEventLogRows,
  });
}
