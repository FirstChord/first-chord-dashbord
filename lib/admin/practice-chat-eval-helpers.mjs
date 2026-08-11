/**
 * @fileoverview The six-week Practice Chat evaluation: turns session telemetry,
 * practice notes and MMS attendance into the numbers that answer "is this
 * ritual worth keeping?".
 *
 * Pure and read-only. Everything here is a function of its arguments so the
 * whole report can be tested without Sheets, MMS or a browser.
 *
 * The organising rule is that **three kinds of claim must never be added
 * together**, because they are not equally trustworthy and the brief asks for
 * all three:
 *
 *   `observed` — the system watched it happen (durations, counts, outcomes)
 *   `rated`    — a tutor said so (1–5 answers; always carries its n)
 *   `derived`  — a rule inferred it (abandonment, "a next action was captured")
 *
 * A reader who cannot tell which is which will read a text heuristic as a
 * measurement. So they are separate branches of the result, not separate
 * adjectives in a comment.
 *
 * Every rate is returned beside its numerator and denominator. Six weeks of a
 * small school is not much data, and a bare percentage invites a confidence
 * nobody has earned.
 */

import { deriveSessionOutcome } from './practice-chat-session-helpers.mjs';
import { resolveTutorName } from './tutor-identity.mjs';
import {
  ASR_COST_PER_MINUTE_USD,
  BASELINE_NOTE,
  medianManualNoteSeconds,
} from '../config/practice-chat-baseline.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_WINDOW_DAYS = 42;

// A lesson that was taught. Absences are not eligible for a practice note, and
// counting them would report a tutor whose student was off sick as having
// skipped the ritual. Mirrors ATTENDED_STATUSES in payroll-helpers.
const TAUGHT_STATUSES = new Set(['present', 'attended', 'completed']);
// Not yet marked. Neither taught nor not-taught — the denominator's own
// uncertainty, reported beside it rather than silently folded in either way.
const UNRECORDED_STATUSES = new Set(['unrecorded', '']);

function normaliseStatus(value = '') {
  return `${value ?? ''}`.trim().toLowerCase();
}

function parseTime(value) {
  const time = new Date(value || '').getTime();
  return Number.isFinite(time) ? time : null;
}

function inWindow(value, { startMs, endMs }) {
  const time = parseTime(value);
  return time !== null && time >= startMs && time <= endMs;
}

/**
 * A rate that refuses to exist without its evidence.
 *
 * `pct` is null rather than 0 when the denominator is empty: "no lessons yet"
 * and "nobody used it" are different findings, and a 0% that means the former
 * is the most misleading number this report could print.
 */
function rate(count, total) {
  return {
    count,
    total,
    pct: total > 0 ? Math.round((count / total) * 1000) / 10 : null,
  };
}

// Nearest-rank, no interpolation. With a few hundred sessions the choice of
// percentile method moves the answer less than the noise does, and this one can
// be explained in a sentence to someone reading the report.
function percentile(values = [], fraction = 0.5) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.max(0, Math.ceil(fraction * sorted.length) - 1);
  return sorted[index];
}

function median(values = []) {
  return percentile(values, 0.5);
}

/**
 * Round to one decimal place, symmetrically about zero.
 *
 * `Math.round` breaks ties toward positive infinity, so `Math.round(-0.5)` is
 * `-0` — which renders as "0" and reads as "no difference". On a signed saving
 * that is the one value that must never be misread: it would turn "the ritual
 * is slower than writing by hand" into "the ritual changed nothing".
 */
function roundSigned(value) {
  return Math.sign(value) * Math.round(Math.abs(value) * 10) / 10;
}

// Monday of the week a timestamp falls in, as YYYY-MM-DD. Weeks are the unit a
// music school actually runs on: every student has one lesson a week, so a
// weekly bucket is one lesson per student and the trend line is readable.
export function weekStartOf(value) {
  const time = parseTime(value);
  if (time === null) return '';
  const date = new Date(time);
  const day = date.getUTCDay();
  const daysFromMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - daysFromMonday * DAY_MS);
  return monday.toISOString().slice(0, 10);
}

/**
 * The fields the evaluation needs from a raw MMS attendance row.
 *
 * Reads the same field names `mapAttendanceRow` in payroll-helpers does. That
 * function is private to payroll and carries pay-classification concerns this
 * report has no use for, so this takes the four fields it needs rather than
 * widening payroll's surface for a read-only view.
 */
export function mapEvaluationLessons(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    studentId: row?.StudentID || row?.Student?.ID || '',
    lessonDate: `${row?.EventStartDate || ''}`.slice(0, 10),
    startAt: row?.EventStartDate || '',
    status: `${row?.AttendanceStatus || ''}`.trim(),
    tutor: resolveTutorName(row?.Teacher?.Name || ''),
  })).filter((lesson) => lesson.lessonDate);
}

function countBy(rows = [], keyOf) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function noteTimestamp(note = {}) {
  return note.lessonDate || note.createdAt || note.emailSentAt || note.completedAt || '';
}

// --- Adoption ----------------------------------------------------------------

function buildAdoption({ sessions, lessons, weeks }) {
  const taught = lessons.filter((lesson) => TAUGHT_STATUSES.has(normaliseStatus(lesson.status)));
  const unrecorded = lessons.filter((lesson) => UNRECORDED_STATUSES.has(normaliseStatus(lesson.status)));
  const absent = lessons.filter((lesson) => (
    !TAUGHT_STATUSES.has(normaliseStatus(lesson.status))
    && !UNRECORDED_STATUSES.has(normaliseStatus(lesson.status))
  ));

  const completed = sessions.filter((session) => session.derivedOutcome === 'completed');
  const abandoned = sessions.filter((session) => session.derivedOutcome === 'abandoned');
  const inFlight = sessions.filter((session) => session.derivedOutcome === 'in_flight');
  // A session that may still be running is neither a success nor a failure, so
  // it is excluded from *both* sides of the completion rate rather than counted
  // as a loss. Reported separately so the exclusion is visible.
  const settled = completed.length + abandoned.length;

  const weekly = weeks.map((weekStart) => ({
    weekStart,
    eligible: taught.filter((lesson) => weekStartOf(lesson.startAt) === weekStart).length,
    started: sessions.filter((session) => weekStartOf(session.openedAt) === weekStart).length,
    completed: completed.filter((session) => weekStartOf(session.openedAt) === weekStart).length,
    abandoned: abandoned.filter((session) => weekStartOf(session.openedAt) === weekStart).length,
  }));

  return {
    eligibleLessons: taught.length,
    // The denominator carries its own completeness. ~10% of lessons sit
    // unmarked at any time, so an adoption rate is accurate to about that much
    // and the reader is entitled to know it.
    unrecordedLessons: unrecorded.length,
    absentLessons: absent.length,
    ritualsStarted: sessions.length,
    ritualsCompleted: completed.length,
    inFlight: inFlight.length,
    completionRate: rate(completed.length, settled),
    adoptionRate: rate(completed.length, taught.length),
    weekly,
  };
}

// --- Friction ----------------------------------------------------------------

function buildFriction({ sessions }) {
  const completed = sessions.filter((session) => session.derivedOutcome === 'completed');
  const abandoned = sessions.filter((session) => session.derivedOutcome === 'abandoned');
  const settled = completed.length + abandoned.length;

  const activeMs = completed.map((session) => session.msActive).filter(Number.isFinite);
  const toFirstRecordMs = sessions.map((session) => session.msToFirstRecord).filter(Number.isFinite);

  return {
    // Timed on completed sessions only: an abandoned one has no duration to
    // report, and including a partial as if it were a fast finish would make
    // giving up look like efficiency.
    medianActiveMs: median(activeMs),
    p90ActiveMs: percentile(activeMs, 0.9),
    timedSessions: activeMs.length,
    medianToFirstRecordMs: median(toFirstRecordMs),
    abandonmentRate: rate(abandoned.length, settled),
    abandonedByStep: countBy(abandoned, (session) => session.lastStep || 'before_first_question'),
    typedNotSpoken: sessions.filter((session) => session.typedNotSpoken).length,
    // Kept, but never presented as friction: a panel opened at the start of a
    // lesson and finished at the end measures the lesson, not the ritual.
    medianSessionTotalMs: median(completed.map((session) => session.msSessionTotal).filter(Number.isFinite)),
  };
}

// --- Reliability --------------------------------------------------------------

function buildReliability({ sessions, notes }) {
  const withAsrError = sessions.filter((session) => (session.asrErrorCount || 0) > 0);
  const withReRecord = sessions.filter((session) => (session.reRecordCount || 0) > 0);

  const sent = notes.filter((note) => note.emailSendStatus === 'sent' || Boolean(note.gmailMessageId));
  const failed = notes.filter((note) => note.emailSendStatus === 'failed');
  const absentOnly = notes.filter((note) => note.emailSendStatus === 'not_sent_absent');
  // Blank is not failure. The legacy copy path never had a delivery to track,
  // and buildPracticeInsights already models this distinction — losing it here
  // would invent an error rate out of the older flow.
  const untracked = notes.filter((note) => !note.emailSendStatus && !note.gmailMessageId);
  const manualFollowUp = notes.filter((note) => note.manualFollowUpNeeded);

  // The only place a tutor's name is allowed on screen, and only ever attached
  // to something broken and fixable. Adoption by tutor lives in the CSV: a
  // completion-rate table is the leaderboard state-tabs.md forbids.
  const troubleByTutor = new Map();
  const flag = (tutor, key) => {
    const name = resolveTutorName(tutor);
    if (!name) return;
    const entry = troubleByTutor.get(name) || { tutor: name, asrErrors: 0, deliveryFailures: 0, manualFollowUp: 0 };
    entry[key] += 1;
    troubleByTutor.set(name, entry);
  };
  for (const session of withAsrError) flag(session.tutor, 'asrErrors');
  for (const note of failed) flag(note.actingTutor || note.tutorName, 'deliveryFailures');
  for (const note of manualFollowUp) flag(note.actingTutor || note.tutorName, 'manualFollowUp');

  return {
    asrErrorSessions: rate(withAsrError.length, sessions.length),
    totalAsrErrors: sessions.reduce((sum, session) => sum + (session.asrErrorCount || 0), 0),
    // A correction, not a failure. Reported next to the error rate precisely so
    // the two are never read as one number.
    reRecordSessions: rate(withReRecord.length, sessions.length),
    totalReRecords: sessions.reduce((sum, session) => sum + (session.reRecordCount || 0), 0),
    notesLogged: notes.length,
    deliverySent: sent.length,
    deliveryFailed: failed.length,
    deliveryAbsentOnly: absentOnly.length,
    deliveryUntracked: untracked.length,
    manualFollowUp: manualFollowUp.length,
    needsAttention: [...troubleByTutor.values()]
      .filter((entry) => entry.asrErrors + entry.deliveryFailures + entry.manualFollowUp > 0)
      .sort((a, b) => (
        (b.asrErrors + b.deliveryFailures + b.manualFollowUp)
        - (a.asrErrors + a.deliveryFailures + a.manualFollowUp)
      )),
  };
}

// --- Editing (observed proxy for quality) -------------------------------------

function buildEditing({ sessions }) {
  const reachedNote = sessions.filter((session) => (
    session.phase === 'note_generated' || session.phase === 'finished'
  ));
  const edited = reachedNote.filter((session) => session.noteEdited);
  const deltas = edited.map((session) => Math.abs(session.editCharDelta || 0)).filter((value) => value > 0);

  return {
    // How often a tutor changed the generated note before saving. The strongest
    // quality signal available without asking anyone anything — but it measures
    // *dissatisfaction*, not accuracy: a tutor may edit a perfectly accurate
    // note to add something the ritual never asked about.
    editRate: rate(edited.length, reachedNote.length),
    medianEditChars: median(deltas),
    safetyFlagged: sessions.filter((session) => (session.safetyFlagCount || 0) > 0).length,
    safetyAcknowledged: sessions.filter((session) => session.safetyAck).length,
  };
}

// --- Value: what it costs, and what it replaces --------------------------------

/**
 * What the transcription actually cost.
 *
 * Priced off audio minutes sent, per the model each session recorded, so a
 * mid-trial model switch re-prices itself. Sessions on a model with no
 * published per-minute rate are counted separately rather than costed at a
 * guess — a made-up unit cost is worse than an admitted gap, because it will be
 * quoted at someone.
 */
function buildCost({ sessions }) {
  let usd = 0;
  let pricedSessions = 0;
  let pricedMinutes = 0;
  let unpricedSessions = 0;

  for (const session of sessions) {
    const ms = session.msCaptureTotal;
    if (!Number.isFinite(ms) || ms <= 0) continue;
    const rate = ASR_COST_PER_MINUTE_USD[session.asrModel];
    if (!Number.isFinite(rate)) {
      unpricedSessions += 1;
      continue;
    }
    const minutes = ms / 60000;
    usd += minutes * rate;
    pricedMinutes += minutes;
    pricedSessions += 1;
  }

  return {
    totalUsd: pricedSessions ? Math.round(usd * 100) / 100 : null,
    perNoteUsd: pricedSessions ? Math.round((usd / pricedSessions) * 10000) / 10000 : null,
    audioMinutes: Math.round(pricedMinutes),
    pricedSessions,
    // Visible on purpose: a large number here means the headline cost describes
    // only part of the trial.
    unpricedSessions,
  };
}

/**
 * Time saved against writing the note by hand.
 *
 * The whole point of measuring duration at all. Without the hand-measured
 * baseline this returns nulls and says so, rather than treating "we never
 * measured the old way" as "the old way took zero seconds".
 *
 * Compares against `ms_active` (first recording to finished), not open-to-
 * finished, because the latter includes a panel left open through a lesson and
 * would invent savings that are really just teaching time.
 */
function buildTimeSaved({ sessions, baselineSeconds, baselineNote }) {
  const completed = sessions.filter((session) => session.derivedOutcome === 'completed');
  const activeMs = completed.map((session) => session.msActive).filter(Number.isFinite);
  const medianMs = median(activeMs);

  if (!Number.isFinite(baselineSeconds) || !Number.isFinite(medianMs)) {
    return {
      baselineSeconds: Number.isFinite(baselineSeconds) ? baselineSeconds : null,
      baselineNote,
      medianRitualMs: Number.isFinite(medianMs) ? medianMs : null,
      savedPerNoteMs: null,
      savedTotalHours: null,
      notesCompared: activeMs.length,
    };
  }

  const savedPerNoteMs = baselineSeconds * 1000 - medianMs;
  return {
    baselineSeconds,
    baselineNote,
    medianRitualMs: medianMs,
    // Signed. If the ritual turns out slower than writing by hand, that is a
    // finding, and rounding it up to zero would be hiding the answer.
    savedPerNoteMs,
    savedTotalHours: roundSigned((savedPerNoteMs * activeMs.length) / 3600000),
    notesCompared: activeMs.length,
  };
}

/**
 * Does the ritual get faster as a tutor gets used to it?
 *
 * Bucketed by weeks since **that tutor's** first session, not by calendar week.
 * Tutors join the evaluation at different points, so calendar weeks would mix
 * one person's first attempt with another's twentieth and flatten the curve
 * into noise — which is precisely the shape that makes a learning curve look
 * like it isn't there.
 */
function buildLearningCurve({ sessions, maxWeeks = 6 }) {
  const firstSeenByTutor = new Map();
  for (const session of sessions) {
    const tutor = resolveTutorName(session.tutor);
    const opened = parseTime(session.openedAt);
    if (!tutor || opened === null) continue;
    const current = firstSeenByTutor.get(tutor);
    if (current === undefined || opened < current) firstSeenByTutor.set(tutor, opened);
  }

  const buckets = new Map();
  for (const session of sessions) {
    if (session.derivedOutcome !== 'completed' || !Number.isFinite(session.msActive)) continue;
    const tutor = resolveTutorName(session.tutor);
    const opened = parseTime(session.openedAt);
    const first = firstSeenByTutor.get(tutor);
    if (!tutor || opened === null || first === undefined) continue;

    const week = Math.floor((opened - first) / (7 * DAY_MS)) + 1;
    if (week < 1 || week > maxWeeks) continue;
    const bucket = buckets.get(week) || { week, values: [], tutors: new Set() };
    bucket.values.push(session.msActive);
    bucket.tutors.add(tutor);
    buckets.set(week, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => a.week - b.week)
    .map((bucket) => ({
      week: bucket.week,
      medianActiveMs: median(bucket.values),
      sessions: bucket.values.length,
      tutors: bucket.tutors.size,
    }));
}

// --- Human ratings ------------------------------------------------------------

function buildRatings({ sessions }) {
  const prompted = sessions.filter((session) => session.ratingPrompted);
  const answered = prompted.filter((session) => session.ratingAccuracy);
  const accuracy = answered.map((session) => session.ratingAccuracy);
  const usefulness = sessions.map((session) => session.priorUsefulness).filter(Boolean);

  const distribution = (values) => [1, 2, 3, 4, 5].map((score) => ({
    label: `${score}`,
    count: values.filter((value) => value === score).length,
  }));

  const mean = (values) => (values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : null);

  return {
    accuracy: {
      n: accuracy.length,
      mean: mean(accuracy),
      distribution: distribution(accuracy),
      // Skips are recorded, so the response rate is itself evidence: a rating
      // people decline to give is a finding about the prompt.
      responseRate: rate(answered.length, prompted.length),
      comments: answered
        .filter((session) => session.ratingComment)
        .map((session) => ({
          comment: session.ratingComment,
          answeredAt: session.ratingAnsweredAt || session.openedAt,
        })),
    },
    usefulness: {
      n: usefulness.length,
      mean: mean(usefulness),
      distribution: distribution(usefulness),
    },
  };
}

// --- Derived: continuity, reflection, compounding -----------------------------

function buildContinuity({ sessions, notes }) {
  const withPrior = sessions.filter((session) => session.priorNoteExists);
  const gapsByStudent = new Map();
  for (const note of notes) {
    const date = parseTime(noteTimestamp(note));
    if (date === null || !note.studentMmsId) continue;
    const list = gapsByStudent.get(note.studentMmsId) || [];
    list.push(date);
    gapsByStudent.set(note.studentMmsId, list);
  }

  const gaps = [];
  for (const dates of gapsByStudent.values()) {
    const sorted = [...dates].sort((a, b) => a - b);
    for (let index = 1; index < sorted.length; index += 1) {
      gaps.push(Math.round((sorted[index] - sorted[index - 1]) / DAY_MS));
    }
  }

  return {
    // NOT "did the tutor read it". The dashboard renders the previous note and
    // the Lesson Focus summary automatically on student select, so it is always
    // on screen and a passive view proves nothing. Only the deliberate "Show
    // earlier lessons" click is evidence of looking something up.
    priorNoteAvailable: rate(withPrior.length, sessions.length),
    historyOpened: rate(
      sessions.filter((session) => session.priorHistoryOpened).length,
      withPrior.length,
    ),
    medianDaysBetweenRituals: median(gaps),
  };
}

function buildCompounding({ notes }) {
  const byStudent = new Map();
  for (const note of notes) {
    if (!note.studentMmsId) continue;
    byStudent.set(note.studentMmsId, (byStudent.get(note.studentMmsId) || 0) + 1);
  }
  const counts = [...byStudent.values()];
  return {
    studentsWithAny: counts.length,
    studentsWith2Plus: counts.filter((count) => count >= 2).length,
    studentsWith4Plus: counts.filter((count) => count >= 4).length,
    // Only reachable by students whose tutor ran the ritual from week one. With
    // tutors joining at week three this bucket is structurally near-empty for
    // everyone else — a fact about the rollout, not about the tool.
    studentsWith6Plus: counts.filter((count) => count >= 6).length,
  };
}

function buildReflection({ notes }) {
  const hasText = (value) => Boolean(`${value || ''}`.trim());
  return {
    // A text rule, not an observation: "a next practice action was captured"
    // means the Practice Goals section is non-empty. It cannot tell a clear
    // action from a sentence that merely occupies the section.
    nextActionCaptured: rate(notes.filter((note) => hasText(note.practiceGoals)).length, notes.length),
    challengesCaptured: rate(notes.filter((note) => hasText(note.progressChallenges)).length, notes.length),
    songEvidence: rate(
      notes.filter((note) => (note.songIds?.length || 0) + (note.unlistedSongTitles?.length || 0) > 0).length,
      notes.length,
    ),
  };
}

/**
 * The whole evaluation.
 *
 * `sessions` and `notes` are normalised rows; `attendanceRows` are raw MMS
 * attendance records (mapped here via `mapEvaluationLessons`).
 */
export function buildPracticeChatEvaluation({
  sessions = [],
  notes = [],
  attendanceRows = [],
  now = new Date(),
  windowDays = DEFAULT_WINDOW_DAYS,
  // Injectable so tests can supply a baseline without editing the config the
  // humans paste their stopwatch readings into.
  baselineSeconds = medianManualNoteSeconds(),
  baselineNote = BASELINE_NOTE,
} = {}) {
  const endMs = now.getTime();
  const startMs = endMs - windowDays * DAY_MS;
  const bounds = { startMs, endMs };

  const windowSessions = sessions
    .filter((session) => inWindow(session.openedAt, bounds))
    .map((session) => ({ ...session, derivedOutcome: deriveSessionOutcome(session, now) }));
  const windowNotes = notes.filter((note) => inWindow(noteTimestamp(note), bounds));
  const lessons = mapEvaluationLessons(attendanceRows)
    .filter((lesson) => inWindow(lesson.startAt, bounds));

  const weeks = [...new Set([
    ...windowSessions.map((session) => weekStartOf(session.openedAt)),
    ...lessons.map((lesson) => weekStartOf(lesson.startAt)),
  ])].filter(Boolean).sort();

  return {
    windowDays,
    generatedAt: now.toISOString(),
    weeks,
    observed: {
      adoption: buildAdoption({ sessions: windowSessions, lessons, weeks }),
      friction: buildFriction({ sessions: windowSessions }),
      reliability: buildReliability({ sessions: windowSessions, notes: windowNotes }),
      editing: buildEditing({ sessions: windowSessions }),
      cost: buildCost({ sessions: windowSessions }),
      timeSaved: buildTimeSaved({ sessions: windowSessions, baselineSeconds, baselineNote }),
      learningCurve: buildLearningCurve({ sessions: windowSessions }),
    },
    rated: buildRatings({ sessions: windowSessions }),
    derived: {
      continuity: buildContinuity({ sessions: windowSessions, notes: windowNotes }),
      reflection: buildReflection({ notes: windowNotes }),
      compounding: buildCompounding({ notes: windowNotes }),
    },
  };
}
