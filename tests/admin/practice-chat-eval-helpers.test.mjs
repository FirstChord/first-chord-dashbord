import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPracticeChatEvaluation,
  mapEvaluationLessons,
  weekStartOf,
} from '../../lib/admin/practice-chat-eval-helpers.mjs';

const NOW = new Date('2026-08-14T18:00:00.000Z'); // a Friday

function session(overrides = {}) {
  return {
    sessionId: `s${Math.random()}`,
    openedAt: '2026-08-12T15:00:00.000Z',
    studentMmsId: 'sdt_1',
    tutor: 'Finn',
    asrModel: 'whisper-1',
    phase: 'finished',
    outcome: 'sent',
    noteId: 'n1',
    msActive: 90000,
    msToFirstRecord: 5000,
    msCaptureTotal: null,
    msSessionTotal: 90000,
    asrErrorCount: 0,
    reRecordCount: 0,
    safetyFlagCount: 0,
    noteEdited: false,
    editCharDelta: 0,
    typedNotSpoken: false,
    priorNoteExists: false,
    priorHistoryOpened: false,
    ratingPrompted: false,
    ...overrides,
  };
}

function note(overrides = {}) {
  return {
    studentMmsId: 'sdt_1',
    lessonDate: '2026-08-12',
    tutorName: 'Finn',
    practiceGoals: 'Play bar 4 slowly',
    progressChallenges: 'Chord changes still slow',
    emailSendStatus: 'sent',
    songIds: [],
    unlistedSongTitles: [],
    ...overrides,
  };
}

function lesson(overrides = {}) {
  return {
    StudentID: 'sdt_1',
    EventStartDate: '2026-08-12T15:00:00Z',
    AttendanceStatus: 'Present',
    Teacher: { Name: 'Finn' },
    ...overrides,
  };
}

test('weeks bucket to the Monday, so one bucket is one lesson per student', () => {
  assert.equal(weekStartOf('2026-08-12T15:00:00Z'), '2026-08-10'); // Wed -> Mon
  assert.equal(weekStartOf('2026-08-10T00:00:00Z'), '2026-08-10'); // Mon -> itself
  assert.equal(weekStartOf('2026-08-16T23:00:00Z'), '2026-08-10'); // Sun -> same week
  assert.equal(weekStartOf('nonsense'), '');
});

test('only taught lessons are eligible, and the denominator declares its own gaps', () => {
  const report = buildPracticeChatEvaluation({
    attendanceRows: [
      lesson({ AttendanceStatus: 'Present' }),
      lesson({ AttendanceStatus: 'Attended' }),
      lesson({ AttendanceStatus: 'Unrecorded' }),
      lesson({ AttendanceStatus: '' }),
      lesson({ AttendanceStatus: 'AbsentNotice' }),
      // Absent-but-invoiced is payable, but no lesson was taught, so there was
      // nothing to write a practice note about.
      lesson({ AttendanceStatus: 'AbsentNoMakeup' }),
    ],
    now: NOW,
  });

  const { adoption } = report.observed;
  assert.equal(adoption.eligibleLessons, 2);
  assert.equal(adoption.unrecordedLessons, 2);
  assert.equal(adoption.absentLessons, 2);
});

test('a session that may still be running counts on neither side of completion', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ phase: 'finished' }),
      session({ phase: 'opened', openedAt: '2026-08-10T09:00:00.000Z' }), // old -> abandoned
      session({ phase: 'capturing', openedAt: '2026-08-14T17:55:00.000Z' }), // 5 min ago
    ],
    now: NOW,
  });

  const { adoption } = report.observed;
  assert.equal(adoption.ritualsStarted, 3);
  assert.equal(adoption.ritualsCompleted, 1);
  assert.equal(adoption.inFlight, 1);
  // 1 of 2 settled, not 1 of 3.
  assert.deepEqual(adoption.completionRate, { count: 1, total: 2, pct: 50 });
});

test('an empty denominator gives null, never 0%', () => {
  // "No lessons yet" and "nobody used it" are different findings and 0% would
  // report the first as the second.
  const report = buildPracticeChatEvaluation({ sessions: [], attendanceRows: [], now: NOW });
  assert.equal(report.observed.adoption.adoptionRate.pct, null);
  assert.equal(report.observed.adoption.completionRate.pct, null);
});

test('every rate carries its numerator and denominator', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [session(), session({ phase: 'opened', openedAt: '2026-08-10T09:00:00.000Z' })],
    notes: [note()],
    attendanceRows: [lesson(), lesson(), lesson(), lesson()],
    now: NOW,
  });

  for (const rateValue of [
    report.observed.adoption.adoptionRate,
    report.observed.adoption.completionRate,
    report.observed.friction.abandonmentRate,
    report.observed.reliability.asrErrorSessions,
    report.observed.editing.editRate,
    report.derived.reflection.nextActionCaptured,
  ]) {
    assert.ok(Number.isFinite(rateValue.count), 'count present');
    assert.ok(Number.isFinite(rateValue.total), 'total present');
  }
});

test('timings come from completed sessions only', () => {
  // An abandoned session has no duration to report, and treating a partial as
  // a fast finish would make giving up look like efficiency.
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ msActive: 60000 }),
      session({ msActive: 120000 }),
      session({ phase: 'opened', msActive: 1000, openedAt: '2026-08-10T09:00:00.000Z' }),
    ],
    now: NOW,
  });

  assert.equal(report.observed.friction.timedSessions, 2);
  assert.equal(report.observed.friction.medianActiveMs, 60000);
  assert.equal(report.observed.friction.p90ActiveMs, 120000);
});

test('abandonment is reported by the step it happened at', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ phase: 'opened', lastStep: 'q1', openedAt: '2026-08-10T09:00:00.000Z' }),
      session({ phase: 'capturing', lastStep: 'q2', openedAt: '2026-08-10T09:00:00.000Z' }),
      session({ phase: 'note_generated', lastStep: 'review', openedAt: '2026-08-10T09:00:00.000Z' }),
      session({ phase: 'opened', lastStep: '', openedAt: '2026-08-10T09:00:00.000Z' }),
    ],
    now: NOW,
  });

  const steps = Object.fromEntries(
    report.observed.friction.abandonedByStep.map((entry) => [entry.label, entry.count]),
  );
  assert.equal(steps.q1, 1);
  assert.equal(steps.q2, 1);
  assert.equal(steps.review, 1);
  assert.equal(steps.before_first_question, 1);
});

test('re-records are not counted as failures', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ reRecordCount: 3, asrErrorCount: 0 }),
      session({ asrErrorCount: 2, reRecordCount: 0 }),
    ],
    now: NOW,
  });

  const { reliability } = report.observed;
  assert.equal(reliability.asrErrorSessions.count, 1);
  assert.equal(reliability.totalAsrErrors, 2);
  assert.equal(reliability.reRecordSessions.count, 1);
  assert.equal(reliability.totalReRecords, 3);
});

test('an untracked delivery is not a failed one', () => {
  // The legacy copy path never had a delivery to track. Counting blank as
  // failure would invent an error rate out of the older flow.
  const report = buildPracticeChatEvaluation({
    notes: [
      note({ emailSendStatus: 'sent' }),
      note({ emailSendStatus: 'failed' }),
      note({ emailSendStatus: '', gmailMessageId: '' }),
      note({ emailSendStatus: 'not_sent_absent' }),
    ],
    now: NOW,
  });

  const { reliability } = report.observed;
  assert.equal(reliability.deliverySent, 1);
  assert.equal(reliability.deliveryFailed, 1);
  assert.equal(reliability.deliveryUntracked, 1);
  assert.equal(reliability.deliveryAbsentOnly, 1);
});

test('one tutor recorded under two names is one human', () => {
  // "Calum, Calum Steel +1" shipped once already; resolveTutorName is the fix.
  const report = buildPracticeChatEvaluation({
    sessions: [session({ tutor: 'Calum', asrErrorCount: 1 })],
    notes: [
      note({ tutorName: 'Calum Steel', emailSendStatus: 'failed' }),
      note({ tutorName: 'Calum', manualFollowUpNeeded: true }),
    ],
    now: NOW,
  });

  const attention = report.observed.reliability.needsAttention;
  assert.equal(attention.length, 1, 'one tutor, one row');
  assert.equal(attention[0].tutor, 'Calum');
  assert.equal(attention[0].asrErrors, 1);
  assert.equal(attention[0].deliveryFailures, 1);
  assert.equal(attention[0].manualFollowUp, 1);
});

test('the attention list holds only tutors with something broken', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [session({ tutor: 'Finn' }), session({ tutor: 'Dean', asrErrorCount: 1 })],
    notes: [note({ tutorName: 'Finn' })],
    now: NOW,
  });

  assert.deepEqual(
    report.observed.reliability.needsAttention.map((entry) => entry.tutor),
    ['Dean'],
  );
});

test('ratings stay separate from observed behaviour and always carry n', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ ratingPrompted: true, ratingAccuracy: 5, ratingComment: 'Nailed it' }),
      session({ ratingPrompted: true, ratingAccuracy: 3 }),
      session({ ratingPrompted: true }), // skipped
      session({ priorUsefulness: 4 }),
    ],
    now: NOW,
  });

  assert.equal(report.rated.accuracy.n, 2);
  assert.equal(report.rated.accuracy.mean, 4);
  assert.deepEqual(report.rated.accuracy.responseRate, { count: 2, total: 3, pct: 66.7 });
  assert.equal(report.rated.accuracy.comments.length, 1);
  assert.equal(report.rated.usefulness.n, 1);
  assert.equal(report.rated.usefulness.mean, 4);
  // The three evidence classes must not be merged.
  assert.ok(report.observed && report.rated && report.derived);
  assert.equal(report.observed.rated, undefined);
});

test('edit rate is measured against sessions that produced a note', () => {
  // A session abandoned at question two never generated a note, so it cannot
  // have been left unedited.
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ phase: 'finished', noteEdited: true, editCharDelta: -40 }),
      session({ phase: 'finished', noteEdited: false }),
      session({ phase: 'opened', openedAt: '2026-08-10T09:00:00.000Z' }),
    ],
    now: NOW,
  });

  assert.deepEqual(report.observed.editing.editRate, { count: 1, total: 2, pct: 50 });
  assert.equal(report.observed.editing.medianEditChars, 40);
});

test('continuity measures the deliberate click, not the automatic render', () => {
  // The dashboard always renders the previous note, so "it was on screen"
  // proves nothing. Only "Show earlier lessons" is evidence.
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ priorNoteExists: true, priorHistoryOpened: true }),
      session({ priorNoteExists: true, priorHistoryOpened: false }),
      session({ priorNoteExists: false, priorHistoryOpened: false }),
    ],
    now: NOW,
  });

  const { continuity } = report.derived;
  assert.deepEqual(continuity.priorNoteAvailable, { count: 2, total: 3, pct: 66.7 });
  assert.deepEqual(continuity.historyOpened, { count: 1, total: 2, pct: 50 });
});

test('days between rituals are measured per student, never across students', () => {
  const report = buildPracticeChatEvaluation({
    notes: [
      note({ studentMmsId: 'sdt_1', lessonDate: '2026-08-01' }),
      note({ studentMmsId: 'sdt_1', lessonDate: '2026-08-08' }),
      note({ studentMmsId: 'sdt_2', lessonDate: '2026-08-02' }),
    ],
    now: NOW,
    windowDays: 60,
  });

  // One gap of 7 days for sdt_1; sdt_2's single note contributes no gap.
  assert.equal(report.derived.continuity.medianDaysBetweenRituals, 7);
});

test('cohorts count students, not notes', () => {
  const notes = [
    ...Array.from({ length: 6 }, (_, i) => note({ studentMmsId: 'sdt_1', lessonDate: `2026-07-0${i + 1}` })),
    ...Array.from({ length: 4 }, (_, i) => note({ studentMmsId: 'sdt_2', lessonDate: `2026-07-0${i + 1}` })),
    note({ studentMmsId: 'sdt_3', lessonDate: '2026-07-01' }),
  ];
  const report = buildPracticeChatEvaluation({ notes, now: NOW, windowDays: 90 });

  const { compounding } = report.derived;
  assert.equal(compounding.studentsWithAny, 3);
  assert.equal(compounding.studentsWith2Plus, 2);
  assert.equal(compounding.studentsWith4Plus, 2);
  assert.equal(compounding.studentsWith6Plus, 1);
});

test('the window excludes everything outside it', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ openedAt: '2026-08-12T15:00:00.000Z' }),
      session({ openedAt: '2026-01-01T15:00:00.000Z' }),
    ],
    notes: [note({ lessonDate: '2026-08-12' }), note({ lessonDate: '2026-01-01' })],
    attendanceRows: [lesson(), lesson({ EventStartDate: '2026-01-01T15:00:00Z' })],
    now: NOW,
    windowDays: 42,
  });

  assert.equal(report.observed.adoption.ritualsStarted, 1);
  assert.equal(report.observed.adoption.eligibleLessons, 1);
  assert.equal(report.observed.reliability.notesLogged, 1);
});

test('cost is priced per model from audio minutes actually sent', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ asrModel: 'whisper-1', msCaptureTotal: 120000 }), // 2 min
      session({ asrModel: 'whisper-1', msCaptureTotal: 180000 }), // 3 min
    ],
    now: NOW,
  });

  const { cost } = report.observed;
  assert.equal(cost.audioMinutes, 5);
  assert.equal(cost.pricedSessions, 2);
  assert.equal(cost.totalUsd, 0.03); // 5 min x $0.006
  assert.equal(cost.perNoteUsd, 0.015);
});

test('a model with no published rate is admitted, never guessed at', () => {
  // A made-up unit cost is worse than an admitted gap, because it gets quoted.
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ asrModel: 'whisper-1', msCaptureTotal: 60000 }),
      session({ asrModel: 'gpt-4o-mini-transcribe-2025-12-15', msCaptureTotal: 600000 }),
    ],
    now: NOW,
  });

  const { cost } = report.observed;
  assert.equal(cost.pricedSessions, 1);
  assert.equal(cost.unpricedSessions, 1);
  // The ten unpriced minutes are absent from the total, not costed at zero.
  assert.equal(cost.totalUsd, 0.01);
});

test('a typed note costs nothing and does not dilute the per-note price', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ asrModel: 'whisper-1', msCaptureTotal: 120000 }),
      session({ asrModel: 'whisper-1', msCaptureTotal: null, typedNotSpoken: true }),
    ],
    now: NOW,
  });

  assert.equal(report.observed.cost.pricedSessions, 1);
  assert.equal(report.observed.cost.perNoteUsd, 0.012);
});

test('with no measured baseline, time saved is null rather than assumed', () => {
  // "We never measured the old way" must never become "the old way was free".
  const report = buildPracticeChatEvaluation({
    sessions: [session({ msActive: 90000 })],
    now: NOW,
    baselineSeconds: null,
  });

  const { timeSaved } = report.observed;
  assert.equal(timeSaved.baselineSeconds, null);
  assert.equal(timeSaved.savedPerNoteMs, null);
  assert.equal(timeSaved.savedTotalHours, null);
  assert.equal(timeSaved.medianRitualMs, 90000, 'the ritual is still timed');
});

test('time saved is computed against the hand-measured baseline', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ msActive: 90000 }),
      session({ msActive: 90000 }),
    ],
    now: NOW,
    baselineSeconds: 240, // four minutes by hand
    baselineNote: 'Finn, 10 notes, Aug 2026',
  });

  const { timeSaved } = report.observed;
  assert.equal(timeSaved.medianRitualMs, 90000);
  assert.equal(timeSaved.savedPerNoteMs, 150000); // 4min - 90s
  assert.equal(timeSaved.savedTotalHours, 0.1);
  assert.equal(timeSaved.notesCompared, 2);
  assert.equal(timeSaved.baselineNote, 'Finn, 10 notes, Aug 2026');
});

test('a ritual slower than the old way reports a negative saving', () => {
  // If the answer is "this made things worse", the report has to be able to
  // say so. Clamping at zero would hide the one result that should stop it.
  const report = buildPracticeChatEvaluation({
    sessions: [session({ msActive: 300000 })],
    now: NOW,
    baselineSeconds: 120,
  });

  assert.equal(report.observed.timeSaved.savedPerNoteMs, -180000);
  assert.ok(report.observed.timeSaved.savedTotalHours < 0);
});

test('the learning curve buckets by each tutor\'s own weeks, not the calendar', () => {
  // Tutors join at different points. Calendar weeks would mix one person's
  // first attempt with another's twentieth and flatten the curve into noise.
  const week = 7 * 24 * 60 * 60 * 1000;
  const finnStart = new Date('2026-07-06T15:00:00.000Z').getTime();
  const deanStart = new Date('2026-07-27T15:00:00.000Z').getTime();

  const report = buildPracticeChatEvaluation({
    sessions: [
      // Finn: slow in his week 1, fast by his week 3.
      session({ tutor: 'Finn', openedAt: new Date(finnStart).toISOString(), msActive: 200000 }),
      session({ tutor: 'Finn', openedAt: new Date(finnStart + 2 * week).toISOString(), msActive: 100000 }),
      // Dean starts three weeks later and is also slow in *his* week 1.
      session({ tutor: 'Dean', openedAt: new Date(deanStart).toISOString(), msActive: 220000 }),
      session({ tutor: 'Dean', openedAt: new Date(deanStart + 2 * week).toISOString(), msActive: 110000 }),
    ],
    now: NOW,
    windowDays: 60,
  });

  const curve = Object.fromEntries(
    report.observed.learningCurve.map((entry) => [entry.week, entry]),
  );
  assert.equal(curve[1].sessions, 2, 'both tutors\' first weeks land in week 1');
  assert.equal(curve[1].tutors, 2);
  assert.equal(curve[1].medianActiveMs, 200000);
  assert.equal(curve[3].medianActiveMs, 100000, 'and both third weeks in week 3');
});

test('the learning curve ignores abandoned sessions', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ msActive: 90000 }),
      session({ phase: 'opened', msActive: 5000, openedAt: '2026-08-10T09:00:00.000Z' }),
    ],
    now: NOW,
  });

  const total = report.observed.learningCurve.reduce((sum, entry) => sum + entry.sessions, 0);
  assert.equal(total, 1);
});

test('mapEvaluationLessons reads MMS field names and drops undated rows', () => {
  const lessons = mapEvaluationLessons([
    lesson(),
    { StudentID: 'sdt_9', AttendanceStatus: 'Present' }, // no date
    { Student: { ID: 'sdt_8' }, EventStartDate: '2026-08-11T10:00:00Z', AttendanceStatus: 'Present', Teacher: { Name: 'Calum Steel' } },
  ]);

  assert.equal(lessons.length, 2);
  assert.equal(lessons[0].lessonDate, '2026-08-12');
  assert.equal(lessons[1].studentId, 'sdt_8');
  assert.equal(lessons[1].tutor, 'Calum', 'tutor names resolve to the canonical short name');
});

test('weekly trend lines up sessions against eligible lessons', () => {
  const report = buildPracticeChatEvaluation({
    sessions: [
      session({ openedAt: '2026-08-12T15:00:00.000Z' }),
      session({ openedAt: '2026-08-05T15:00:00.000Z' }),
    ],
    attendanceRows: [
      lesson({ EventStartDate: '2026-08-12T15:00:00Z' }),
      lesson({ EventStartDate: '2026-08-13T15:00:00Z' }),
      lesson({ EventStartDate: '2026-08-05T15:00:00Z' }),
    ],
    now: NOW,
  });

  const weekly = Object.fromEntries(report.observed.adoption.weekly.map((w) => [w.weekStart, w]));
  assert.equal(weekly['2026-08-10'].eligible, 2);
  assert.equal(weekly['2026-08-10'].completed, 1);
  assert.equal(weekly['2026-08-03'].eligible, 1);
  assert.equal(weekly['2026-08-03'].completed, 1);
});
