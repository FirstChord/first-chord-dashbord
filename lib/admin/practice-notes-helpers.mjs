import crypto from 'node:crypto';

const MAX_FIELD_LENGTH = 5000;

function clean(value = '', maxLength = MAX_FIELD_LENGTH) {
  return `${value || ''}`.trim().slice(0, maxLength);
}

function boolString(value) {
  return value ? 'TRUE' : 'FALSE';
}

export function buildPracticeNoteId({ studentMmsId = '', createdAt = '', rawNoteText = '' } = {}) {
  const seed = [studentMmsId, createdAt, rawNoteText].join('|');
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12);
  return `practice_note:${studentMmsId || 'unknown'}:${hash}`;
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
    source: clean(payload.source || 'practice_chat_pwa', 120),
    createdAt,
    userAgent: clean(payload.userAgent, 500),
  };
}

export function buildPracticeNoteLogSheetRow(note = {}) {
  return {
    note_id: note.noteId || '',
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
    source: note.source || '',
    created_at: note.createdAt || '',
    user_agent: note.userAgent || '',
  };
}
