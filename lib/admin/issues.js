import { getRegistryEntries } from '@/lib/admin/registry';
import { getReviewFlagsRows, getStudentsSheetRows } from '@/lib/admin/sheets';
import { buildIssueRecord } from './issues-helpers.mjs';

function pickFirst(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (`${value || ''}`.trim() !== '') {
      return `${value}`.trim();
    }
  }
  return '';
}

function normaliseSheetStudent(row) {
  return {
    mmsId: pickFirst(row, ['mms_id', 'MMS ID', 'MMS Id', 'Student ID']),
    tutor: pickFirst(row, ['Tutor']),
    fullName: [pickFirst(row, ['Student forename']), pickFirst(row, ['Student Surname'])].filter(Boolean).join(' ').trim(),
  };
}

export async function getAdminIssues() {
  const [flagRows, rawSheetRows, registryEntries] = await Promise.all([
    getReviewFlagsRows(),
    getStudentsSheetRows(),
    getRegistryEntries(),
  ]);

  const sheetByMmsId = new Map(
    rawSheetRows
      .map(normaliseSheetStudent)
      .filter((student) => student.mmsId)
      .map((student) => [student.mmsId, student]),
  );

  const registryByMmsId = new Map(registryEntries.map((entry) => [entry.mmsId, entry]));

  return flagRows
    .map((flag) =>
      buildIssueRecord({
        flag,
        sheetStudent: sheetByMmsId.get(flag.mms_id || '') || null,
        registryEntry: registryByMmsId.get(flag.mms_id || '') || null,
      }),
    )
    .filter((issue) => issue.active)
    .sort((a, b) => {
      const severityOrder = { 'Needs action': 0, Warning: 1, Info: 2 };
      const bySeverity = (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
      if (bySeverity !== 0) return bySeverity;
      return a.studentName.localeCompare(b.studentName);
    });
}
