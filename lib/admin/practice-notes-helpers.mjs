import crypto from 'node:crypto';

const MAX_FIELD_LENGTH = 5000;

function clean(value = '', maxLength = MAX_FIELD_LENGTH) {
  return `${value || ''}`.trim().slice(0, maxLength);
}

function boolString(value) {
  return value ? 'TRUE' : 'FALSE';
}

function dateTimeValue(value = '') {
  const cleaned = clean(value, 120);
  if (!cleaned) return '';
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? cleaned : parsed.toISOString();
}

export function buildPracticeNoteId({ studentMmsId = '', createdAt = '', rawNoteText = '' } = {}) {
  const seed = [studentMmsId, createdAt, rawNoteText].join('|');
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12);
  return `practice_note:${studentMmsId || 'unknown'}:${hash}`;
}

export function buildPracticeNoteDeliveryKey({
  studentMmsId = '',
  mmsAttendanceId = '',
  rawNoteText = '',
} = {}) {
  const cleanedStudentId = clean(studentMmsId, 120);
  const cleanedAttendanceId = clean(mmsAttendanceId, 120);
  const cleanedNoteText = clean(rawNoteText).replace(/\s+/g, ' ');
  if (!cleanedStudentId || !cleanedAttendanceId || !cleanedNoteText) return '';
  const hash = crypto.createHash('sha256').update(cleanedNoteText).digest('hex').slice(0, 16);
  return `practice_note_delivery:${cleanedStudentId}:${cleanedAttendanceId}:${hash}`;
}

export function normalisePracticeNotePayload(payload = {}, now = new Date()) {
  const createdAt = clean(payload.createdAt) || now.toISOString();
  const studentMmsId = clean(payload.studentMmsId || payload.studentId, 120);
  const studentName = clean(payload.studentName, 200);
  const tutorName = clean(payload.tutorName || payload.tutor, 200);
  const lessonDate = clean(payload.lessonDate, 120);
  const whatWeDid = clean(payload.whatWeDid);
  const progressChallenges = clean(payload.progressChallenges);
  const practiceGoals = clean(payload.practiceGoals);
  const rawNoteText = clean(payload.rawNoteText || payload.noteText);
  const emailSendStatus = clean(payload.emailSendStatus, 80);

  const errors = [];
  if (!studentMmsId) errors.push('studentMmsId is required');
  if (!rawNoteText && !whatWeDid && !progressChallenges && !practiceGoals) {
    errors.push('note text is required');
  }

  const noteId = clean(payload.noteId, 200) || buildPracticeNoteId({
    studentMmsId,
    createdAt,
    rawNoteText: rawNoteText || [whatWeDid, progressChallenges, practiceGoals].join('\n'),
  });

  return {
    errors,
    noteId,
    deliveryKey: clean(payload.deliveryKey || payload.delivery_key, 260),
    studentMmsId,
    studentName,
    tutorName,
    lessonDate,
    whatWeDid,
    progressChallenges,
    practiceGoals,
    rawNoteText,
    copiedToClipboard: Boolean(payload.copiedToClipboard),
    attendanceStepOpened: Boolean(payload.attendanceStepOpened),
    mmsEventId: clean(payload.mmsEventId, 120),
    mmsAttendanceId: clean(payload.mmsAttendanceId, 120),
    mmsAttendanceStatus: clean(payload.mmsAttendanceStatus, 120),
    mmsAttendanceSaved: Boolean(payload.mmsAttendanceSaved),
    targetSelectionReason: clean(payload.targetSelectionReason, 120),
    targetSelectionLabel: clean(payload.targetSelectionLabel, 500),
    recipientProfileId: clean(payload.recipientProfileId, 120),
    recipientName: clean(payload.recipientName, 200),
    recipientEmail: clean(payload.recipientEmail, 320),
    emailChannel: clean(payload.emailChannel, 80),
    emailSendStatus: emailSendStatus || '',
    emailSentAt: dateTimeValue(payload.emailSentAt),
    gmailMessageId: clean(payload.gmailMessageId, 200),
    gmailThreadId: clean(payload.gmailThreadId, 200),
    emailError: clean(payload.emailError, 1000),
    manualFollowUpNeeded: Boolean(payload.manualFollowUpNeeded),
    operationStatus: clean(payload.operationStatus || payload.operation_status, 120),
    completedAt: dateTimeValue(payload.completedAt || payload.completed_at),
    source: clean(payload.source || 'practice_chat_pwa', 120),
    createdAt,
    userAgent: clean(payload.userAgent, 500),
  };
}

export function buildPracticeNoteLogSheetRow(note = {}) {
  return {
    note_id: note.noteId || '',
    delivery_key: note.deliveryKey || '',
    student_mms_id: note.studentMmsId || '',
    student_name: note.studentName || '',
    tutor_name: note.tutorName || '',
    lesson_date: note.lessonDate || '',
    what_we_did: note.whatWeDid || '',
    progress_challenges: note.progressChallenges || '',
    practice_goals: note.practiceGoals || '',
    raw_note_text: note.rawNoteText || '',
    copied_to_clipboard: boolString(note.copiedToClipboard),
    attendance_step_opened: boolString(note.attendanceStepOpened),
    mms_event_id: note.mmsEventId || '',
    mms_attendance_id: note.mmsAttendanceId || '',
    mms_attendance_status: note.mmsAttendanceStatus || '',
    mms_attendance_saved: boolString(note.mmsAttendanceSaved),
    target_selection_reason: note.targetSelectionReason || '',
    target_selection_label: note.targetSelectionLabel || '',
    recipient_profile_id: note.recipientProfileId || '',
    recipient_name: note.recipientName || '',
    recipient_email: note.recipientEmail || '',
    email_channel: note.emailChannel || '',
    email_send_status: note.emailSendStatus || '',
    email_sent_at: note.emailSentAt || '',
    gmail_message_id: note.gmailMessageId || '',
    gmail_thread_id: note.gmailThreadId || '',
    email_error: note.emailError || '',
    manual_follow_up_needed: boolString(note.manualFollowUpNeeded),
    operation_status: note.operationStatus || '',
    completed_at: note.completedAt || '',
    source: note.source || '',
    created_at: note.createdAt || '',
    user_agent: note.userAgent || '',
  };
}

export function normalisePracticeNoteLogRow(row = {}) {
  return {
    noteId: row.note_id || '',
    deliveryKey: row.delivery_key || '',
    studentMmsId: row.student_mms_id || '',
    studentName: row.student_name || '',
    tutorName: row.tutor_name || '',
    lessonDate: row.lesson_date || '',
    whatWeDid: row.what_we_did || '',
    progressChallenges: row.progress_challenges || '',
    practiceGoals: row.practice_goals || '',
    rawNoteText: row.raw_note_text || '',
    mmsEventId: row.mms_event_id || '',
    mmsAttendanceId: row.mms_attendance_id || '',
    mmsAttendanceStatus: row.mms_attendance_status || '',
    mmsAttendanceSaved: row.mms_attendance_saved === 'TRUE',
    targetSelectionReason: row.target_selection_reason || '',
    targetSelectionLabel: row.target_selection_label || '',
    recipientProfileId: row.recipient_profile_id || '',
    recipientName: row.recipient_name || '',
    recipientEmail: row.recipient_email || '',
    emailChannel: row.email_channel || '',
    emailSendStatus: row.email_send_status || '',
    emailSentAt: row.email_sent_at || '',
    gmailMessageId: row.gmail_message_id || '',
    gmailThreadId: row.gmail_thread_id || '',
    emailError: row.email_error || '',
    manualFollowUpNeeded: row.manual_follow_up_needed === 'TRUE',
    operationStatus: row.operation_status || '',
    completedAt: row.completed_at || '',
    source: row.source || '',
    createdAt: row.created_at || '',
  };
}

export function isPracticeNoteDeliveryEmailSent(record = {}) {
  return record.emailSendStatus === 'sent' || Boolean(record.gmailMessageId);
}

export function isPracticeNoteDeliveryInProgress(record = {}, now = new Date()) {
  if (record.operationStatus !== 'in_progress') return false;
  const createdAt = new Date(record.createdAt || '').getTime();
  if (!Number.isFinite(createdAt)) return true;
  return now.getTime() - createdAt < 2 * 60 * 1000;
}

export function findPracticeNoteDeliveryRecord(records = [], deliveryKey = '') {
  if (!deliveryKey) return null;
  return records.find((record) => record.deliveryKey === deliveryKey) || null;
}

export function isPracticeNoteVisibleInPortal(record = {}) {
  return isPracticeNoteDeliveryEmailSent(record)
    || record.operationStatus === 'completed'
    || Boolean(record.completedAt);
}

function formatPortalNoteHeadings(value = '') {
  return `${value || ''}`
    .replace(/^[^\S\r\n]*\[(what we did)\][^\S\r\n]*$/gimu, '**What we did:**')
    .replace(/^[^\S\r\n]*\[(progress\s*&\s*challenges)\][^\S\r\n]*$/gimu, '**Progress & Challenges:**')
    .replace(/^[^\S\r\n]*\[(practice goals?)\][^\S\r\n]*$/gimu, '**Practice Goals:**');
}

function practiceNoteSortTime(record = {}) {
  const lessonTime = new Date(record.lessonDate || '').getTime();
  if (Number.isFinite(lessonTime)) return lessonTime;

  const sentTime = new Date(record.emailSentAt || '').getTime();
  if (Number.isFinite(sentTime)) return sentTime;

  const completedTime = new Date(record.completedAt || '').getTime();
  if (Number.isFinite(completedTime)) return completedTime;

  const createdTime = new Date(record.createdAt || '').getTime();
  return Number.isFinite(createdTime) ? createdTime : 0;
}

export function buildPortalPracticeNoteText(record = {}) {
  const rawNoteText = clean(record.rawNoteText);
  if (rawNoteText) return formatPortalNoteHeadings(rawNoteText);

  const sections = [
    ['What we did', clean(record.whatWeDid)],
    ['Progress & Challenges', clean(record.progressChallenges)],
    ['Practice Goals', clean(record.practiceGoals)],
  ].filter(([, value]) => value);

  return sections
    .map(([heading, value]) => `**${heading}:**\n${value}`)
    .join('\n\n');
}

export function mapPracticeNoteLogRowToPortalNote(record = {}) {
  const notes = buildPortalPracticeNoteText(record);
  if (!notes) return null;

  return {
    lesson_date: record.lessonDate || record.emailSentAt || record.completedAt || record.createdAt || '',
    notes,
    tutor_name: record.tutorName || 'Unknown',
    attendance: record.mmsAttendanceStatus || (record.mmsAttendanceSaved ? 'Present' : ''),
    source: 'firstchord',
    note_id: record.noteId || '',
    email_sent_at: record.emailSentAt || '',
  };
}

// Deliberate behaviour: when a parent-visible owned note exists we return it
// without also fetching MMS to compare freshness. Cross-source comparison would
// force an MMS call on every portal load even when an owned note exists, which
// re-couples us to the API this migration is shedding. During the transition,
// preferring the owned note is the intended default; the MMS fallback only runs
// when there is no visible owned note at all.
export function selectLatestPortalPracticeNote(records = []) {
  const visibleRecords = records
    .filter(isPracticeNoteVisibleInPortal)
    .map((record) => ({
      record,
      portalNote: mapPracticeNoteLogRowToPortalNote(record),
    }))
    .filter((entry) => entry.portalNote);

  visibleRecords.sort((a, b) => practiceNoteSortTime(b.record) - practiceNoteSortTime(a.record));

  return visibleRecords[0]?.portalNote || null;
}
