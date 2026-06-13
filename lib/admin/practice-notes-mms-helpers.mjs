export const TEST_PRACTICE_NOTES_STUDENT_ID = 'sdt_fBg9JN';
export const PRACTICE_NOTES_LEVEL_2_PILOT_TUTORS = ['Finn', 'Tom', 'Fennella'];

function clean(value = '') {
  return `${value || ''}`.trim();
}

function normaliseTutorName(value = '') {
  const cleaned = clean(value).toLowerCase();
  if (!cleaned) return '';
  if (cleaned === 'finn' || cleaned.includes('finn le marinel')) return 'Finn';
  if (cleaned === 'tom' || cleaned.includes('tom walters')) return 'Tom';
  if (cleaned === 'fennella' || cleaned.includes('fennella mccallum')) return 'Fennella';
  return clean(value);
}

export function isPracticeNotesLevel2PilotTutor(value = '') {
  const tutor = normaliseTutorName(value);
  return PRACTICE_NOTES_LEVEL_2_PILOT_TUTORS.includes(tutor);
}

export function isPracticeNotesLevel2PilotStudent(student = {}) {
  if (student?.mmsId === TEST_PRACTICE_NOTES_STUDENT_ID || student?.studentId === TEST_PRACTICE_NOTES_STUDENT_ID) {
    return true;
  }
  return [
    student?.tutor,
    student?.registryTutor,
    student?.currentTutor,
    student?.teacherName,
  ].some(isPracticeNotesLevel2PilotTutor);
}

function escapeHtml(value = '') {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDate(value) {
  const parsed = new Date(value || '');
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalisePracticeNoteAttendanceRecord(record = {}) {
  return {
    attendanceId: clean(record.ID),
    eventId: clean(record.EventID),
    studentId: clean(record.StudentID),
    teacherId: clean(record.TeacherID),
    teacherName: clean(record.Teacher?.Name || record.TeacherName),
    attendanceStatus: clean(record.AttendanceStatus),
    eventStartDate: clean(record.EventStartDate),
    eventEndDate: clean(record.EventEndDate),
    eventDuration: toNumber(record.EventDuration),
    originalChargeAmount: toNumber(record.OriginalChargeAmount),
    chargeWithTax: toNumber(record.Charge?.ChargeWithTax),
    studentNote: record.StudentNote || '',
    parentNote: record.ParentNote || '',
    teacherNote: record.TeacherNote || '',
    displayDescription: clean(record.Charge?.DisplayDescription),
  };
}

export function listPracticeNoteAttendanceCandidates(records = [], now = new Date()) {
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return records
    .map(normalisePracticeNoteAttendanceRecord)
    .filter((record) => record.attendanceId && record.eventId && record.studentId)
    .filter((record) => {
      const start = parseDate(record.eventStartDate);
      return !start || start.getTime() <= cutoff.getTime();
    })
    .sort((a, b) => {
      const aTime = parseDate(a.eventStartDate)?.getTime() || 0;
      const bTime = parseDate(b.eventStartDate)?.getTime() || 0;
      return bTime - aTime;
    });
}

export function selectPracticeNoteAttendanceTarget(records = [], now = new Date(), options = {}) {
  const candidates = listPracticeNoteAttendanceCandidates(records, now);
  const requestedAttendanceId = clean(options.targetAttendanceId);
  if (requestedAttendanceId) {
    return candidates.find((record) => record.attendanceId === requestedAttendanceId) || null;
  }
  const unrecorded = candidates.find((record) => record.attendanceStatus === 'Unrecorded');
  return unrecorded || candidates[0] || null;
}

export function describePracticeNoteAttendanceSelection({
  target = {},
  candidates = [],
  targetAttendanceId = '',
} = {}) {
  const requestedAttendanceId = clean(targetAttendanceId);
  if (!target?.attendanceId) {
    return {
      reason: 'none',
      label: 'No lesson selected.',
    };
  }
  if (requestedAttendanceId) {
    return {
      reason: 'explicit_selection',
      label: 'You selected this lesson from the date list.',
    };
  }
  if (target.attendanceStatus === 'Unrecorded') {
    return {
      reason: 'latest_unrecorded',
      label: 'Selected because it is the latest unrecorded lesson found for this student.',
    };
  }
  const firstCandidate = candidates[0] || {};
  if (firstCandidate.attendanceId === target.attendanceId) {
    return {
      reason: 'latest_available',
      label: 'Selected because it is the latest lesson found for this student.',
    };
  }
  return {
    reason: 'matched_candidate',
    label: 'Selected from the recent lessons found for this student.',
  };
}

export function buildPracticeNoteEmailRecipients(studentRecord = {}) {
  const parents = studentRecord.Family?.Parents || [];
  return parents
    .filter((parent) => parent?.ID)
    .filter((parent) => parent.IsActive !== false)
    .filter((parent) => parent.HasEmailAddress !== false)
    .filter((parent) => clean(parent.Email?.EmailAddress))
    .map((parent) => ({
      recipientProfileId: parent.ID,
      name: parent.FormalName || parent.FullName || `${parent.FirstName || ''} ${parent.LastName || ''}`.trim(),
      email: parent.Email?.EmailAddress || '',
    }));
}

export function formatPracticeNoteHtml(noteText = '') {
  const paragraphs = clean(noteText)
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return '';
  }

  return paragraphs
    .map((paragraph) => {
      const lines = paragraph
        .split(/\r?\n/u)
        .map((line) => escapeHtml(line))
        .join('<br>');
      return `<p>${lines}</p>`;
    })
    .join('');
}

export function buildPracticeNoteAttendancePayload({ attendance = {}, noteHtml = '' } = {}) {
  const payload = {
    TeacherNote: attendance.teacherNote || '',
    ParentNote: attendance.parentNote || '',
    StudentNote: noteHtml,
    AttendanceStatus: 'Present',
  };
  const priceOverride = attendance.originalChargeAmount ?? attendance.chargeWithTax;
  if (Number.isFinite(priceOverride)) {
    payload.PriceOverride = priceOverride;
  }
  return payload;
}

export function buildPracticeNoteEmailPayload(recipients = []) {
  return {
    RecipientProfileIDs: recipients
      .map((recipient) => recipient.recipientProfileId)
      .filter(Boolean),
  };
}
