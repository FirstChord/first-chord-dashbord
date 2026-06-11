export const TEST_PRACTICE_NOTES_STUDENT_ID = 'sdt_fBg9JN';

function clean(value = '') {
  return `${value || ''}`.trim();
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

export function selectPracticeNoteAttendanceTarget(records = [], now = new Date()) {
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const candidates = records
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

  const unrecorded = candidates.find((record) => record.attendanceStatus === 'Unrecorded');
  return unrecorded || candidates[0] || null;
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
