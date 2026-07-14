import { appendEventLogRows, updateStudentSheetRow } from '@/lib/admin/sheets';
import { buildPauseExpectationAutoSyncPlan } from './pause-auto-sync-helpers.mjs';
import { applyPauseExpectationReconciliation } from './pause-expectation-reconciliation.mjs';
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
  const changes = buildPauseExpectationAutoSyncPlan(students).map((change) => ({
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
    updateStudentPaymentExpectation: (mmsId, paymentExpectation) => updateStudentSheetRow(mmsId, {
      payment_expectation: paymentExpectation,
    }),
    appendEvents: appendEventLogRows,
  });
}
