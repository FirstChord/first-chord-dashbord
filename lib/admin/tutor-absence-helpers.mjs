const DEFAULT_TIME_ZONE = 'Europe/London';
const ABSENCE_STATUS_VALUES = new Set(['draft', 'in_progress', 'parents_to_message', 'resolved']);
const ABSENCE_DECISION_VALUES = new Set(['', 'cancel_day', 'cover']);

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function parseMmsWallClock(value) {
  const match = `${value || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    weekdayDate: new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
  };
}

export function formatTutorAbsenceDate(value = '') {
  const wallClock = parseMmsWallClock(`${value}T12:00:00`);
  if (!wallClock) return value;
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(wallClock.weekdayDate);
  const day = Number(value.slice(8, 10));
  const month = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(wallClock.weekdayDate);
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${weekday} ${day}${suffix} ${month}`;
}

function formatTime(value = '') {
  const wallClock = parseMmsWallClock(value);
  if (wallClock) return wallClock.time;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DEFAULT_TIME_ZONE,
  }).format(parsed);
}

function firstName(value = '', fallback = '') {
  return `${value || ''}`.trim().split(/\s+/)[0] || fallback;
}

function studentIdsForEvent(event = {}) {
  const ids = new Set();
  if (event.StudentID) ids.add(event.StudentID);
  for (const id of event.StudentIDs || []) {
    if (id) ids.add(id);
  }
  for (const attendance of event.Attendances || []) {
    if (attendance.StudentID) ids.add(attendance.StudentID);
  }
  for (const student of event.Students || []) {
    if (student.ID) ids.add(student.ID);
  }
  return [...ids];
}

function eventStudentName(event = {}) {
  const student = (event.Students || [])[0] || {};
  return student.FullName || [student.FirstName, student.LastName].filter(Boolean).join(' ').trim();
}

export function normaliseTutorAbsenceStatus(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return ABSENCE_STATUS_VALUES.has(normalised) ? normalised : 'draft';
}

export function normaliseTutorAbsenceDecision(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return ABSENCE_DECISION_VALUES.has(normalised) ? normalised : '';
}

export function parseTutorAbsenceStateRow(row = {}) {
  return {
    absenceId: row.absenceId || '',
    tutorShortName: row.tutorShortName || '',
    tutorName: row.tutorName || '',
    absenceDate: row.absenceDate || '',
    status: normaliseTutorAbsenceStatus(row.status),
    decision: normaliseTutorAbsenceDecision(row.decision),
    coverTutorShortName: row.coverTutorShortName || '',
    coverTutorName: row.coverTutorName || '',
    affectedLessons: parseJson(row.affectedLessonsJson, []),
    messageState: parseJson(row.messageStateJson, {}),
    note: row.note || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
    resolvedAt: row.resolvedAt || '',
    updatedBy: row.updatedBy || '',
  };
}

export function normaliseTutorAbsenceEvent(event = {}, studentByMmsId = new Map()) {
  const studentIds = studentIdsForEvent(event);
  const firstStudentId = studentIds[0] || '';
  const student = studentByMmsId.get(firstStudentId) || {};
  const studentName = student.fullName || eventStudentName(event) || 'Unknown student';
  const instrument = student.instrument || '';

  return {
    eventId: event.ID || '',
    studentMmsId: firstStudentId,
    studentName,
    parentName: [student.parentFirstName, student.parentLastName].filter(Boolean).join(' ').trim(),
    parentEmail: student.email || '',
    parentPhone: student.contactNumber || '',
    instrument,
    tutor: student.tutor || '',
    paymentMode: student.paymentMode || '',
    paymentExpectation: student.paymentExpectation || '',
    stripeCustomerId: student.stripeCustomerId || '',
    stripeSubscriptionId: student.stripeSubscriptionId || '',
    startAt: event.StartDate || '',
    lessonDate: parseMmsWallClock(event.StartDate)?.date || '',
    lessonTime: formatTime(event.StartDate),
    durationMinutes: event.Duration ? String(event.Duration) : '',
    studentCount: studentIds.length,
  };
}

export function buildTutorAbsenceId({ tutorShortName = '', absenceDate = '' } = {}) {
  return `tutor_absence:${tutorShortName}:${absenceDate}`;
}

export function buildCoverTutorOptions({ absentTutor = {}, lessons = [], tutors = [] } = {}) {
  const neededInstruments = new Set(lessons.map((lesson) => `${lesson.instrument || ''}`.toLowerCase()).filter(Boolean));
  const absentTeacherId = absentTutor.teacherId || '';

  return tutors
    .filter((tutor) => tutor.teacherId && tutor.teacherId !== absentTeacherId)
    .map((tutor) => {
      const tutorInstruments = (tutor.instruments || []).map((instrument) => instrument.toLowerCase());
      const matchedInstruments = [...neededInstruments].filter((instrument) => tutorInstruments.includes(instrument));
      return {
        ...tutor,
        matchedInstruments,
      };
    })
    .filter((tutor) => tutor.matchedInstruments.length)
    .sort((a, b) => b.matchedInstruments.length - a.matchedInstruments.length || a.fullName.localeCompare(b.fullName));
}

export function buildTutorAbsenceMessage({ lesson = {}, tutorName = '', absenceDate = '', decision = '', coverTutorName = '' } = {}) {
  const parentFirst = firstName(lesson.parentName, 'there');
  const studentFirst = firstName(lesson.studentName, 'the lesson');
  const absentTutorFirst = firstName(tutorName, 'their tutor');
  const coverTutorFirst = firstName(coverTutorName, 'another First Chord tutor');
  const day = formatTutorAbsenceDate(absenceDate);

  if (decision === 'cover') {
    return `Heya ${parentFirst}, just a quick heads up that ${absentTutorFirst} is off on ${day}, so ${studentFirst}’s lesson will be covered by ${coverTutorFirst}.\n\nThe lesson should go ahead as normal, and ${absentTutorFirst} will pass on notes so ${coverTutorFirst} is up to speed with what ${studentFirst} has been working on.`;
  }

  return `Heya ${parentFirst}, just a quick heads up that ${absentTutorFirst} is off on ${day}, so ${studentFirst}’s lesson won’t be going ahead that day.\n\nSorry for the disruption, and we’ll make sure the lesson/payment side is handled correctly from our end.`;
}

export function isTutorAbsencePaymentHandled(lesson = {}, state = {}) {
  if (state.pauseSkipped) {
    return true;
  }

  return Boolean(
    state.pauseToolRan
    && state.paymentExpectationAligned,
  );
}

export function summariseTutorAbsenceState({
  lessons = [],
  messageState = {},
  decision = '',
  coverTutorName = '',
} = {}) {
  const totalLessons = lessons.length;
  const messagedCount = lessons.filter((lesson) => messageState[lesson.eventId]?.messaged).length;
  const normalisedDecision = normaliseTutorAbsenceDecision(decision);
  const workflowState = messageState.__workflow || {};
  const paymentHandledCount = normalisedDecision === 'cancel_day'
    ? lessons.filter((lesson) => isTutorAbsencePaymentHandled(lesson, messageState[lesson.eventId] || {})).length
    : 0;
  const coverReady = normalisedDecision === 'cover'
    ? Boolean(coverTutorName && workflowState.coverTutorConfirmed && workflowState.coverTutorBriefed)
    : false;
  const allMessaged = totalLessons > 0 && messagedCount === totalLessons;
  const paymentComplete = normalisedDecision === 'cancel_day' && totalLessons > 0 && paymentHandledCount === totalLessons;

  return {
    totalLessons,
    messagedCount,
    remainingMessages: Math.max(totalLessons - messagedCount, 0),
    allMessaged,
    paymentHandledCount,
    remainingPaymentActions: normalisedDecision === 'cancel_day'
      ? Math.max(totalLessons - paymentHandledCount, 0)
      : 0,
    paymentComplete,
    coverReady,
    canResolve: normalisedDecision === 'cancel_day'
      ? allMessaged && paymentComplete
      : normalisedDecision === 'cover'
        ? allMessaged && coverReady
        : false,
  };
}
