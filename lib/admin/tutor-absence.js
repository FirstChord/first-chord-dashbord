import { getMmsTutorCalendarEventsForDate } from './mms.js';
import { savePlanningItem } from './planning.js';
import {
  deleteTutorAbsenceStateRow,
  getPlanningItemRows,
  getTutorAbsenceStateRows,
  upsertTutorAbsenceStateRow,
} from './sheets.js';
import { getOperationalAdminStudents } from './students.js';
import { getAllTutorOptions } from './tutors.js';
import {
  buildCoverTutorOptions,
  buildTutorAbsenceCancellationMessageGroups,
  buildTutorAbsenceId,
  buildTutorAbsencePausePlanningBundle,
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

function enrichAbsenceLessonsWithStudents(lessons = [], studentByMmsId = new Map()) {
  return (lessons || []).map((lesson) => {
    const student = studentByMmsId.get(lesson.studentMmsId) || {};
    if (!student.mmsId) {
      return lesson;
    }

    return {
      ...lesson,
      studentName: lesson.studentName || student.fullName || '',
      parentName: lesson.parentName || [student.parentFirstName, student.parentLastName].filter(Boolean).join(' ').trim(),
      parentEmail: lesson.parentEmail || student.email || '',
      parentPhone: lesson.parentPhone || student.contactNumber || '',
      instrument: lesson.instrument || student.instrument || '',
      tutor: lesson.tutor || student.tutor || '',
      paymentMode: student.paymentMode || lesson.paymentMode || '',
      paymentExpectation: student.paymentExpectation || lesson.paymentExpectation || '',
      stripeCustomerId: student.stripeCustomerId || lesson.stripeCustomerId || '',
      stripeSubscriptionId: student.stripeSubscriptionId || lesson.stripeSubscriptionId || '',
    };
  });
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function resolveTutor(tutorShortName = '', tutors = []) {
  return tutors.find((tutor) => tutor.shortName === tutorShortName) || null;
}

function planningFieldsMatch(existing = {}, next = {}) {
  return [
    'title',
    'notes',
    'itemType',
    'owner',
    'status',
    'area',
    'linkedWorkflowId',
    'linkedStudentId',
    'linkedTutorId',
    'parentPlanningId',
    'outcome',
    'nextAction',
    'targetDate',
  ].every((key) => `${existing[key] || ''}`.trim() === `${next[key] || ''}`.trim());
}

async function createStructuredPausePlanningFromCancellation({
  row = {},
  actorEmail = '',
} = {}) {
  if (row.decision !== 'cancel_day') {
    return [];
  }

  const allAbsenceRows = await getTutorAbsenceStateRows();
  const relatedRows = allAbsenceRows
    .map(parseTutorAbsenceStateRow)
    .filter((absence) => (
      absence.tutorShortName === row.tutorShortName
      && absence.decision === 'cancel_day'
    ));

  const {
    plans,
    supersededPlanningIds,
    supersededPlanningPrefixes,
  } = buildTutorAbsencePausePlanningBundle({ rows: relatedRows });

  if (!plans.length) {
    return [];
  }

  const existingRows = await getPlanningItemRows();
  const existingIds = new Set(existingRows.map((item) => item.planningId).filter(Boolean));
  const newPlanIds = new Set(plans.map((plan) => plan.planningId));
  const supersededIds = new Set(supersededPlanningIds);

  for (const existing of existingRows) {
    if (!existing.planningId || newPlanIds.has(existing.planningId)) {
      continue;
    }
    const matchesGroupedPrefix = supersededPlanningPrefixes.some((prefix) => (
      prefix && existing.planningId.startsWith(prefix)
    ));
    if (matchesGroupedPrefix) {
      supersededIds.add(existing.planningId);
    }
  }

  const created = [];

  for (const planningId of supersededIds) {
    if (!existingIds.has(planningId) || newPlanIds.has(planningId)) {
      continue;
    }
    const existing = existingRows.find((item) => item.planningId === planningId) || {};
    if (existing.status === 'parked' && existing.nextAction === 'Superseded by a grouped tutor-absence away-period pause plan.') {
      continue;
    }
    await savePlanningItem({
      planningId,
      item: {
        ...existing,
        status: 'parked',
        nextAction: 'Superseded by a grouped tutor-absence away-period pause plan.',
      },
      actorEmail,
      progressNote: 'Parked because a grouped away-period pause plan now covers these tutor absence dates.',
    });
  }

  for (const plan of plans) {
    const existing = existingRows.find((item) => item.planningId === plan.planningId) || {};
    if (existing.planningId && planningFieldsMatch(existing, plan.item)) {
      continue;
    }
    const saved = await savePlanningItem({
      planningId: plan.planningId,
      item: plan.item,
      actorEmail,
      progressNote: plan.progressNote,
    });
    if (!existingIds.has(plan.planningId)) {
      created.push(saved.planningId);
      existingIds.add(saved.planningId);
    }
  }

  return created;
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
  } else if (lessons.length) {
    try {
      const students = await getOperationalAdminStudents();
      lessons = enrichAbsenceLessonsWithStudents(lessons, buildStudentMap(students));
    } catch {
      // Keep the saved lesson snapshot usable even if the enrichment read fails.
    }
  }

  const messageState = savedState?.messageState || {};
  const allStateRows = await getTutorAbsenceStateRows();
  const parsedStateRows = allStateRows.map(parseTutorAbsenceStateRow);
  const summary = summariseTutorAbsenceState({
    lessons,
    messageState,
    decision: savedState?.decision || '',
    coverTutorName: savedState?.coverTutorName || '',
  });

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
    cancellationMessageGroups: buildTutorAbsenceCancellationMessageGroups({
      rows: parsedStateRows,
      tutorShortName: selectedTutor?.shortName || '',
    }).filter((group) => group.missedDates.includes(selectedDate)),
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
  const createdPausePlanningIds = await createStructuredPausePlanningFromCancellation({
    row,
    actorEmail: updatedBy,
  });

  return {
    ...row,
    affectedLessons,
    messageState,
    createdPausePlanningIds,
  };
}

export async function deleteTutorAbsenceWorkflow(absenceId = '') {
  return deleteTutorAbsenceStateRow(absenceId);
}

function serialiseTutorAbsenceRow(row = {}, updatedBy = '') {
  const now = new Date().toISOString();
  return {
    absenceId: row.absenceId,
    tutorShortName: row.tutorShortName,
    tutorName: row.tutorName,
    absenceDate: row.absenceDate,
    status: row.status,
    decision: row.decision,
    coverTutorShortName: row.coverTutorShortName,
    coverTutorName: row.coverTutorName,
    affectedLessonsJson: JSON.stringify(row.affectedLessons || []),
    messageStateJson: serialise(row.messageState),
    note: row.note,
    createdAt: row.createdAt || now,
    updatedAt: now,
    resolvedAt: row.resolvedAt || '',
    updatedBy,
  };
}

export async function markTutorAbsenceCancellationGroupMessaged({
  groupKey = '',
  updatedBy = '',
} = {}) {
  if (!groupKey) {
    throw new Error('groupKey is required');
  }

  const rows = (await getTutorAbsenceStateRows()).map(parseTutorAbsenceStateRow);
  const groups = buildTutorAbsenceCancellationMessageGroups({ rows });
  const group = groups.find((candidate) => candidate.groupKey === groupKey);
  if (!group) {
    throw new Error('Grouped cancellation message was not found');
  }

  const byAbsenceId = new Map(rows.map((row) => [row.absenceId, row]));
  const touched = new Set();

  for (const occurrence of group.occurrences) {
    const row = byAbsenceId.get(occurrence.absenceId);
    if (!row || touched.has(`${occurrence.absenceId}:${occurrence.eventId}`)) {
      continue;
    }

    row.messageState = {
      ...(row.messageState || {}),
      [occurrence.eventId]: {
        ...(row.messageState?.[occurrence.eventId] || {}),
        messaged: true,
        groupedMessageKey: group.groupKey,
      },
    };
    touched.add(`${occurrence.absenceId}:${occurrence.eventId}`);
  }

  const absenceIdsToSave = new Set(group.occurrences.map((occurrence) => occurrence.absenceId));
  for (const absenceId of absenceIdsToSave) {
    const row = byAbsenceId.get(absenceId);
    if (!row) continue;
    await upsertTutorAbsenceStateRow(serialiseTutorAbsenceRow(row, updatedBy));
  }

  return {
    groupKey: group.groupKey,
    updatedLessons: touched.size,
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

// Read-only list of logged tutor absences for the workflow page, so every saved
// absence is reachable (not just the first open one). Open absences first, then
// resolved, each sorted by date.
export async function getOpenTutorAbsences() {
  const rows = await getTutorAbsenceStateRows();
  return rows
    .map(parseTutorAbsenceStateRow)
    .filter((row) => row.absenceId && row.absenceDate && row.tutorShortName)
    .map((row) => {
      const summary = summariseTutorAbsenceState({
        lessons: row.affectedLessons,
        messageState: row.messageState,
        decision: row.decision,
        coverTutorName: row.coverTutorName,
      });
      return {
        absenceId: row.absenceId,
        tutorShortName: row.tutorShortName,
        tutorName: row.tutorName,
        absenceDate: row.absenceDate,
        status: row.status,
        decision: row.decision,
        totalLessons: summary.totalLessons,
        remainingMessages: summary.remainingMessages,
      };
    })
    .sort((a, b) => {
      const aResolved = a.status === 'resolved' ? 1 : 0;
      const bResolved = b.status === 'resolved' ? 1 : 0;
      return (
        aResolved - bResolved
        || a.absenceDate.localeCompare(b.absenceDate)
        || a.tutorName.localeCompare(b.tutorName)
      );
    });
}
