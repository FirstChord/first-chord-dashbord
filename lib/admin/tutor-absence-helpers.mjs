import { buildStructuredPausePlanningDraft } from './planning-helpers.mjs';

const DEFAULT_TIME_ZONE = 'Europe/London';
const ABSENCE_STATUS_VALUES = new Set(['draft', 'in_progress', 'parents_to_message', 'resolved']);
const ABSENCE_DECISION_VALUES = new Set(['', 'cancel_day', 'cover']);
const PAUSED_EXPECTATION = 'stripe_paused_expected';

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

function safeIdSegment(value = '') {
  return `${value || ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseDateValue(value = '') {
  const match = `${value || ''}`.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetween(first, second) {
  return Math.round((second.getTime() - first.getTime()) / 86400000);
}

function inferReturnDateFromMissedLessons(dates = []) {
  const parsedDates = [...new Set(dates)]
    .map(parseDateValue)
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  if (!parsedDates.length) return '';

  const last = parsedDates[parsedDates.length - 1];
  const previous = parsedDates[parsedDates.length - 2] || null;
  const intervalDays = previous
    ? Math.max(1, Math.min(daysBetween(previous, last), 14))
    : 7;
  return formatDateValue(addDays(last, intervalDays || 7));
}

export function buildTutorAbsencePausePlanningId({ absenceId = '', lesson = {} } = {}) {
  return [
    'planning_tutor_absence_pause',
    safeIdSegment(absenceId),
    safeIdSegment(lesson.studentMmsId),
    safeIdSegment(lesson.eventId || lesson.lessonDate),
  ].filter(Boolean).join('_');
}

export function buildTutorAbsencePausePeriodPlanningId({
  tutorShortName = '',
  studentMmsId = '',
  firstDate = '',
  lastDate = '',
} = {}) {
  return [
    'planning_tutor_absence_pause_period',
    safeIdSegment(tutorShortName),
    safeIdSegment(studentMmsId),
    safeIdSegment(firstDate),
    safeIdSegment(lastDate),
  ].filter(Boolean).join('_');
}

function collectPauseCandidatesFromRows(rows = []) {
  return (rows || []).flatMap((row) => {
    if (row.decision !== 'cancel_day') return [];
    return (row.affectedLessons || []).flatMap((lesson) => {
      const state = row.messageState?.[lesson.eventId] || {};
      const lessonDate = `${lesson.lessonDate || row.absenceDate || ''}`.trim();
      const studentMmsId = `${lesson.studentMmsId || ''}`.trim();

      if (!lessonDate || !studentMmsId || state.pauseSkipped) {
        return [];
      }
      if (`${lesson.paymentExpectation || ''}`.trim() === PAUSED_EXPECTATION) {
        return [];
      }

      return [{
        row,
        lesson,
        state,
        lessonDate,
        studentMmsId,
      }];
    });
  });
}

function splitCandidatesIntoBlocks(candidates = []) {
  const sorted = [...candidates].sort((a, b) => (
    a.lessonDate.localeCompare(b.lessonDate)
    || `${a.lesson.eventId || ''}`.localeCompare(`${b.lesson.eventId || ''}`)
  ));
  const blocks = [];

  for (const candidate of sorted) {
    const candidateDate = parseDateValue(candidate.lessonDate);
    const currentBlock = blocks[blocks.length - 1];
    const previous = currentBlock?.[currentBlock.length - 1];
    const previousDate = previous ? parseDateValue(previous.lessonDate) : null;
    const gap = previousDate && candidateDate ? daysBetween(previousDate, candidateDate) : 0;

    if (!currentBlock || gap > 14) {
      blocks.push([candidate]);
    } else {
      currentBlock.push(candidate);
    }
  }

  return blocks;
}

export function buildTutorAbsencePausePlanningBundle({
  rows = [],
  now = new Date(),
} = {}) {
  const candidates = collectPauseCandidatesFromRows(rows);
  const groupedByStudent = new Map();

  for (const candidate of candidates) {
    const tutorKey = candidate.row.tutorShortName || candidate.row.tutorName || '';
    const key = `${tutorKey}::${candidate.studentMmsId}`;
    const existing = groupedByStudent.get(key) || [];
    existing.push(candidate);
    groupedByStudent.set(key, existing);
  }

  const plans = [];
  const supersededPlanningIds = new Set();
  const supersededPlanningPrefixes = new Set();

  for (const studentCandidates of groupedByStudent.values()) {
    for (const block of splitCandidatesIntoBlocks(studentCandidates)) {
      if (block.length < 2) {
        const candidate = block[0];
        plans.push(...buildTutorAbsencePausePlanningItems({
          absenceId: candidate.row.absenceId,
          tutorName: candidate.row.tutorName,
          tutorShortName: candidate.row.tutorShortName,
          absenceDate: candidate.row.absenceDate,
          lessons: [candidate.lesson],
          messageState: candidate.row.messageState,
          now,
        }));
        continue;
      }

      const firstCandidate = block[0];
      const lastCandidate = block[block.length - 1];
      const missedDates = [...new Set(block.map((candidate) => candidate.lessonDate))].sort();
      const firstDate = missedDates[0];
      const lastDate = missedDates[missedDates.length - 1];
      const returnDate = inferReturnDateFromMissedLessons(missedDates);
      const tutorName = firstCandidate.row.tutorName || firstCandidate.row.tutorShortName || '';
      const tutorShortName = firstCandidate.row.tutorShortName || '';
      const studentName = firstCandidate.lesson.studentName || 'student';
      const draft = buildStructuredPausePlanningDraft({
        studentName,
        pauseType: 'range',
        firstPauseDate: firstDate,
        returnDate,
        extraNote: [
          `Tutor absence: ${tutorName || tutorShortName || 'Tutor'}.`,
          `Missed lessons: ${missedDates.join(', ')}.`,
        ].join(' '),
        now,
      });

      if (!draft.isComplete) {
        continue;
      }

      for (const candidate of block) {
        supersededPlanningIds.add(buildTutorAbsencePausePlanningId({
          absenceId: candidate.row.absenceId,
          lesson: candidate.lesson,
        }));
      }

      const planningId = buildTutorAbsencePausePeriodPlanningId({
        tutorShortName,
        studentMmsId: firstCandidate.studentMmsId,
        firstDate,
        lastDate,
      });
      const groupPrefix = [
        'planning_tutor_absence_pause_period',
        safeIdSegment(tutorShortName),
        safeIdSegment(firstCandidate.studentMmsId),
      ].filter(Boolean).join('_');
      supersededPlanningPrefixes.add(groupPrefix);

      const allAligned = block.every((candidate) => Boolean(candidate.state.paymentExpectationAligned));
      const absenceIds = [...new Set(block.map((candidate) => candidate.row.absenceId).filter(Boolean))];
      const eventIds = [...new Set(block.map((candidate) => candidate.lesson.eventId).filter(Boolean))];

      plans.push({
        planningId,
        item: {
          ...draft,
          notes: [
            draft.notes,
            `Tutor absence IDs: ${absenceIds.join(', ')}.`,
            tutorName || tutorShortName ? `Tutor absence tutor: ${tutorName || tutorShortName}.` : '',
            `Tutor absence missed lesson dates: ${missedDates.join(', ')}.`,
            eventIds.length ? `MMS event IDs: ${eventIds.join(', ')}.` : '',
          ].filter(Boolean).join('\n'),
          itemType: 'action',
          status: allAligned ? 'done' : 'active',
          area: 'admin',
          linkedWorkflowId: 'tutor-absence',
          linkedStudentId: firstCandidate.studentMmsId,
          linkedTutorId: tutorShortName || tutorName || '',
          parentPlanningId: `tutor_absence_period:${tutorShortName}:${firstDate}:${lastDate}`,
          nextAction: allAligned
            ? 'Payment pause already handled from the tutor absence workflow.'
            : draft.nextAction,
        },
        progressNote: allAligned
          ? 'Auto-created from grouped tutor absence cancellations; payment pauses were already aligned.'
          : 'Auto-created from grouped tutor absence cancellations.',
      });
    }
  }

  return {
    plans,
    supersededPlanningIds: [...supersededPlanningIds],
    supersededPlanningPrefixes: [...supersededPlanningPrefixes],
  };
}

export function buildTutorAbsencePausePlanningItems({
  absenceId = '',
  tutorName = '',
  tutorShortName = '',
  absenceDate = '',
  lessons = [],
  messageState = {},
  now = new Date(),
} = {}) {
  return (lessons || []).flatMap((lesson) => {
    const state = messageState[lesson.eventId] || {};
    const lessonDate = `${lesson.lessonDate || absenceDate || ''}`.trim();
    const studentMmsId = `${lesson.studentMmsId || ''}`.trim();

    if (!lessonDate || !studentMmsId || state.pauseSkipped) {
      return [];
    }
    if (`${lesson.paymentExpectation || ''}`.trim() === PAUSED_EXPECTATION) {
      return [];
    }

    const draft = buildStructuredPausePlanningDraft({
      studentName: lesson.studentName || 'student',
      pauseType: 'single',
      lessonDate,
      extraNote: `Tutor absence: ${tutorName || tutorShortName || 'Tutor'}.`,
      now,
    });

    if (!draft.isComplete) {
      return [];
    }

    const alreadyAligned = Boolean(state.paymentExpectationAligned);
    const planningId = buildTutorAbsencePausePlanningId({ absenceId, lesson });
    const tutorLine = tutorName || tutorShortName
      ? `Tutor absence tutor: ${tutorName || tutorShortName}.`
      : '';
    const absenceLine = absenceDate ? `Tutor absence date: ${absenceDate}.` : '';
    const eventLine = lesson.eventId ? `MMS event ID: ${lesson.eventId}.` : '';

    return [{
      planningId,
      item: {
        ...draft,
        notes: [
          draft.notes,
          `Tutor absence ID: ${absenceId}.`,
          tutorLine,
          absenceLine,
          eventLine,
        ].filter(Boolean).join('\n'),
        itemType: 'action',
        status: alreadyAligned ? 'done' : 'active',
        area: 'admin',
        linkedWorkflowId: 'tutor-absence',
        linkedStudentId: studentMmsId,
        linkedTutorId: tutorShortName || tutorName || '',
        parentPlanningId: absenceId,
        nextAction: alreadyAligned
          ? 'Payment pause already handled from the tutor absence workflow.'
          : draft.nextAction,
      },
      progressNote: alreadyAligned
        ? 'Auto-created from tutor absence cancellation; payment pause was already aligned.'
        : 'Auto-created from tutor absence cancellation.',
    }];
  });
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
