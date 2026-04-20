import { getTutorFullNameByShortName } from './tutors.js';

export function classifyIssue(flagType) {
  const type = (flagType || '').trim().toUpperCase();

  if (type === 'TUTOR CONFLICT') {
    return {
      severity: 'Needs action',
      systemsAffected: ['Sheets', 'Registry'],
      summary: 'Tutor mismatch between canonical views',
      recommendedAction: 'Open the student record, decide which tutor assignment is authoritative, and then update the wrong side.',
      actionLabel: 'Resolve tutor mismatch',
      messageable: false,
    };
  }

  if (type === 'SHEETS ONLY') {
    return {
      severity: 'Warning',
      systemsAffected: ['Sheets'],
      summary: 'Student exists in Sheets but not in the registry',
      recommendedAction: 'Check whether this is a valid active student that needs a portal/config entry, or a known admin-only row.',
      actionLabel: 'Review missing registry entry',
      messageable: false,
    };
  }

  if (type === 'REGISTRY ONLY') {
    return {
      severity: 'Warning',
      systemsAffected: ['Registry'],
      summary: 'Student exists in the registry but not in Sheets',
      recommendedAction: 'Check whether this is an orphaned portal entry or a missing Sheets row that should be recreated.',
      actionLabel: 'Review missing Sheets row',
      messageable: false,
    };
  }

  return {
    severity: 'Info',
    systemsAffected: [],
    summary: 'Unclassified issue',
    recommendedAction: 'Review manually.',
    actionLabel: 'Review issue',
    messageable: false,
  };
}

function normaliseName(value) {
  return (value || '').trim().toLowerCase();
}

export function isIssueActive({ flagType, sheetStudent = null, registryEntry = null }) {
  const type = (flagType || '').trim().toUpperCase();

  if (type === 'SHEETS ONLY') {
    return Boolean(sheetStudent) && !registryEntry;
  }

  if (type === 'REGISTRY ONLY') {
    return !sheetStudent && Boolean(registryEntry);
  }

  if (type === 'TUTOR CONFLICT') {
    if (!sheetStudent || !registryEntry) {
      return false;
    }

    const registryTutorFullName = getTutorFullNameByShortName(registryEntry.tutor);
    return normaliseName(sheetStudent.tutor) !== normaliseName(registryTutorFullName);
  }

  return true;
}

export function buildIssueRecord({ flag, sheetStudent = null, registryEntry = null }) {
  const type = flag.flag_type || flag.category || '';
  const classification = classifyIssue(type);

  return {
    id: `${type}:${flag.mms_id || ''}:${flag.student_name || ''}`,
    type,
    mmsId: flag.mms_id || '',
    studentName: flag.student_name || '',
    detail: flag.detail || '',
    generatedDate: flag.generated_date || '',
    severity: classification.severity,
    systemsAffected: classification.systemsAffected,
    summary: classification.summary,
    recommendedAction: classification.recommendedAction,
    actionLabel: classification.actionLabel,
    messageable: classification.messageable,
    hasSheetRow: Boolean(sheetStudent),
    hasRegistryEntry: Boolean(registryEntry),
    sheetTutor: sheetStudent?.tutor || '',
    registryTutor: registryEntry?.tutor || '',
    active: isIssueActive({ flagType: type, sheetStudent, registryEntry }),
    adminStudentPath: sheetStudent ? `/admin/students/${flag.mms_id}` : '',
  };
}
