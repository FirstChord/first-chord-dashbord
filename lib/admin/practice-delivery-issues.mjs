import { classifyIssue } from './issues-helpers.mjs';
import { buildIssueId } from './issue-queue-helpers.mjs';

export const PRACTICE_DELIVERY_ISSUE_TYPE = 'PRACTICE NOTE DELIVERY FAILED';
export const PRACTICE_DELIVERY_ISSUE_SOURCE = 'practice_delivery';

export function buildPracticeDeliveryIssueDetail(row = {}) {
  const lesson = `${row.lessonDate || ''}`.trim();
  const recipient = `${row.recipientName || row.recipientEmail || ''}`.trim();
  const error = `${row.emailError || ''}`.trim();

  const parts = [
    lesson ? `Lesson ${lesson}` : 'Lesson note',
    recipient ? `parent note email to ${recipient} needs manual follow-up` : 'parent note email needs manual follow-up',
  ];
  const base = parts.join(': ');
  return error ? `${base} — ${error}` : base;
}

// Practice Chat Level 2 marks a delivery row manual_follow_up_needed when a
// parent lesson-note email fails. Until now that flag was only visible on the
// student detail page; surfacing it as an issue puts it in the daily loop.
// Clearing the flag (follow-up handled) makes the source disappear, so these
// rows ride the existing system-cleared resolution path.
export function buildPracticeDeliveryIssues(practiceNoteRows = [], {
  testStudentIds = new Set(),
  sheetByMmsId = new Map(),
  registryByMmsId = new Map(),
} = {}) {
  const seen = new Set();
  const issues = [];

  for (const row of practiceNoteRows || []) {
    if (row?.manualFollowUpNeeded !== true) continue;
    const mmsId = `${row.studentMmsId || ''}`.trim();
    if (!mmsId || testStudentIds.has(mmsId)) continue;

    const type = PRACTICE_DELIVERY_ISSUE_TYPE;
    const source = PRACTICE_DELIVERY_ISSUE_SOURCE;
    const contextKey = `${row.deliveryKey || row.noteId || ''}`.trim().toLowerCase();
    const issueId = buildIssueId({ source, issueType: type, mmsId, contextKey });
    if (seen.has(issueId)) continue;
    seen.add(issueId);

    const classification = classifyIssue(type);
    const sheetStudent = sheetByMmsId.get(mmsId) || null;
    const registryEntry = registryByMmsId.get(mmsId) || null;

    issues.push({
      id: issueId,
      issueId,
      source,
      contextKey,
      type,
      mmsId,
      studentName: `${row.studentName || ''}`.trim() || sheetStudent?.fullName || mmsId,
      detail: buildPracticeDeliveryIssueDetail(row),
      generatedDate: row.emailSentAt || row.createdAt || row.lessonDate || '',
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
      instrument: sheetStudent?.instrument || registryEntry?.instrument || '',
      email: sheetStudent?.email || '',
      practiceNote: {
        deliveryKey: `${row.deliveryKey || ''}`.trim(),
        noteId: `${row.noteId || ''}`.trim(),
        lessonDate: `${row.lessonDate || ''}`.trim(),
        recipientName: `${row.recipientName || ''}`.trim(),
        recipientEmail: `${row.recipientEmail || ''}`.trim(),
        emailSendStatus: `${row.emailSendStatus || ''}`.trim(),
        emailError: `${row.emailError || ''}`.trim(),
      },
      active: true,
      adminStudentPath: sheetStudent ? `/admin/students/${mmsId}` : '',
    });
  }

  return issues;
}
