import { getMmsTutorCalendarEventsForDate } from './mms.js';
import { getTutorAbsenceStateRows, upsertTutorAbsenceStateRow } from './sheets.js';
import { getOperationalAdminStudents } from './students.js';
import { getAllTutorOptions } from './tutors.js';
import {
  buildCoverTutorOptions,
  buildTutorAbsenceId,
  normaliseTutorAbsenceDecision,
  normaliseTutorAbsenceEvent,
  normaliseTutorAbsenceStatus,
  parseTutorAbsenceStateRow,
  summariseTutorAbsenceState,
} from './tutor-absence-helpers.mjs';

function serialise(value) {
  return JSON.stringify(value || {});
}

function buildStudentMap(students = []) {
  return new Map(students.filter((student) => student.mmsId).map((student) => [student.mmsId, student]));
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function resolveTutor(tutorShortName = '', tutors = []) {
  return tutors.find((tutor) => tutor.shortName === tutorShortName) || null;
}

export async function getTutorAbsenceWorkflow({ tutorShortName = '', absenceDate = '' } = {}) {
  const tutors = getAllTutorOptions();
  const selectedTutor = resolveTutor(tutorShortName, tutors);
  const selectedDate = absenceDate || todayInputValue();
  const absenceId = selectedTutor && selectedDate
    ? buildTutorAbsenceId({ tutorShortName: selectedTutor.shortName, absenceDate: selectedDate })
    : '';
  const stateRows = absenceId ? await getTutorAbsenceStateRows(absenceId) : [];
  const savedState = stateRows[0] ? parseTutorAbsenceStateRow(stateRows[0]) : null;
  let lessons = savedState?.affectedLessons || [];
  let loadError = '';

  if (selectedTutor?.teacherId && selectedDate && !lessons.length) {
    try {
      const [students, events] = await Promise.all([
        getOperationalAdminStudents(),
        getMmsTutorCalendarEventsForDate({
          teacherId: selectedTutor.teacherId,
          date: selectedDate,
        }),
      ]);
      const studentByMmsId = buildStudentMap(students);
      lessons = events
        .map((event) => normaliseTutorAbsenceEvent(event, studentByMmsId))
        .filter((lesson) => lesson.eventId && lesson.studentMmsId)
        .sort((a, b) => a.lessonTime.localeCompare(b.lessonTime) || a.studentName.localeCompare(b.studentName));
    } catch (error) {
      loadError = error.message || 'Could not load MMS lessons for this tutor/date.';
    }
  }

  const messageState = savedState?.messageState || {};
  const summary = summariseTutorAbsenceState({ lessons, messageState });

  return {
    tutors,
    selectedTutor,
    selectedDate,
    absenceId,
    lessons,
    coverOptions: selectedTutor
      ? buildCoverTutorOptions({ absentTutor: selectedTutor, lessons, tutors })
      : [],
    state: savedState || {
      absenceId,
      tutorShortName: selectedTutor?.shortName || '',
      tutorName: selectedTutor?.fullName || '',
      absenceDate: selectedDate,
      status: lessons.length ? 'in_progress' : 'draft',
      decision: '',
      coverTutorShortName: '',
      coverTutorName: '',
      affectedLessons: lessons,
      messageState,
      note: '',
      createdAt: '',
      updatedAt: '',
      resolvedAt: '',
      updatedBy: '',
    },
    summary,
    loadError,
  };
}

export async function saveTutorAbsenceWorkflow({
  absenceId,
  tutorShortName,
  tutorName,
  absenceDate,
  status = 'in_progress',
  decision = '',
  coverTutorShortName = '',
  coverTutorName = '',
  affectedLessons = [],
  messageState = {},
  note = '',
  updatedBy = '',
}) {
  const now = new Date().toISOString();
  const existingRows = absenceId ? await getTutorAbsenceStateRows(absenceId) : [];
  const existing = existingRows[0] ? parseTutorAbsenceStateRow(existingRows[0]) : null;
  const normalisedStatus = normaliseTutorAbsenceStatus(status);

  const row = {
    absenceId,
    tutorShortName,
    tutorName,
    absenceDate,
    status: normalisedStatus,
    decision: normaliseTutorAbsenceDecision(decision),
    coverTutorShortName,
    coverTutorName,
    affectedLessonsJson: JSON.stringify(affectedLessons || []),
    messageStateJson: serialise(messageState),
    note,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    resolvedAt: normalisedStatus === 'resolved' ? existing?.resolvedAt || now : '',
    updatedBy,
  };

  await upsertTutorAbsenceStateRow(row);

  return {
    ...row,
    affectedLessons,
    messageState,
  };
}

export async function getTutorAbsenceOverviewSummary() {
  const rows = await getTutorAbsenceStateRows();
  const openRows = rows
    .map(parseTutorAbsenceStateRow)
    .filter((row) => row.status && row.status !== 'resolved')
    .sort((a, b) => (
      a.absenceDate.localeCompare(b.absenceDate)
      || a.tutorName.localeCompare(b.tutorName)
    ));
  const unresolvedMessages = openRows.reduce((sum, row) => (
    sum + summariseTutorAbsenceState({
      lessons: row.affectedLessons,
      messageState: row.messageState,
    }).remainingMessages
  ), 0);
  const firstOpenAbsence = openRows[0] || null;

  return {
    openAbsences: openRows.length,
    unresolvedMessages,
    firstOpenAbsence: firstOpenAbsence
      ? {
        absenceId: firstOpenAbsence.absenceId,
        tutorShortName: firstOpenAbsence.tutorShortName,
        tutorName: firstOpenAbsence.tutorName,
        absenceDate: firstOpenAbsence.absenceDate,
        status: firstOpenAbsence.status,
      }
      : null,
  };
}
