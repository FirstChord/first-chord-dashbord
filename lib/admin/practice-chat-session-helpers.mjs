/**
 * @fileoverview Practice Chat session telemetry: payload validation, the
 * Practice_Chat_Sessions row builder/reader, and the rules for what a session
 * row is allowed to claim.
 *
 * The tab exists because Practice_Notes_Log only gains a row when a tutor
 * reaches the end of the ritual, so abandonment, retries, transcription
 * failures and pre-save edits leave no trace there at all.
 *
 * Two rules govern everything here.
 *
 * **Abandonment is never written, only derived.** A browser that was closed
 * mid-lesson cannot report that it gave up, so a client claiming
 * `phase: 'abandoned'` would be evidence of nothing. The client reports the
 * furthest point it reached; `deriveSessionOutcome` decides what an unfinished
 * row means once enough time has passed.
 *
 * **The three ways a ritual can look imperfect are kept apart.** An ASR failure
 * is the tool breaking, a re-record is a tutor choosing to redo an answer, and
 * an edit is a tutor improving the output. Collapsing them into one "problem
 * rate" would report a careful tutor as a struggling one.
 */

const MAX_TEXT = 200;
const MAX_ID = 200;
// A session still unfinished an hour after it opened was abandoned, not slow.
// Generous on purpose: a tutor who opens the panel early and finishes at the
// end of a 30- or 45-minute lesson must never be counted as having given up.
export const ABANDONED_AFTER_MS = 60 * 60 * 1000;

export const SESSION_PHASES = ['opened', 'capturing', 'note_generated', 'finished'];
export const SESSION_OUTCOMES = [
  'saved_snapshot',
  'sent',
  'absent_no_makeup',
  'already_done',
  'manual_follow_up',
  'failed',
];
// Where the tutor had got to. Question steps plus the review screen; anything
// unrecognised is dropped rather than guessed at.
export const SESSION_STEPS = ['q1', 'q2', 'q3', 'review'];

function clean(value = '', maxLength = MAX_TEXT) {
  return `${value ?? ''}`.trim().slice(0, maxLength);
}

function boolString(value) {
  return value ? 'TRUE' : 'FALSE';
}

function readBool(value) {
  return `${value ?? ''}`.trim().toUpperCase() === 'TRUE';
}

/**
 * A non-negative whole number, or '' when the client did not measure it.
 *
 * Blank and zero are different facts and both are real: a tutor who typed the
 * note never started a recording (blank), while one whose recording failed
 * instantly did (zero). Coercing blank to 0 would invent measurements and drag
 * every median down.
 */
function countValue(value, { max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return '';
  return Math.min(Math.round(number), max);
}

// Durations are capped at four hours. A longer one is a laptop that slept
// mid-session, not a tutor who spent five hours on a lesson note, and one such
// row would dominate a p90 built from a few hundred sessions.
const MAX_DURATION_MS = 4 * 60 * 60 * 1000;

function durationValue(value) {
  return countValue(value, { max: MAX_DURATION_MS });
}

// 1–5 only. Anything else is treated as no answer, because a rating scale that
// silently accepts 0 or 7 stops being a scale.
function ratingValue(value) {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) return '';
  return number;
}

function enumValue(value, allowed, fallback = '') {
  const cleaned = clean(value, 40).toLowerCase();
  return allowed.includes(cleaned) ? cleaned : fallback;
}

function dateTimeValue(value = '') {
  const cleaned = clean(value, 120);
  if (!cleaned) return '';
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

/**
 * Per-question detail, bounded at three entries because the ritual has three
 * questions. Stored as JSON rather than as columns for the same reason
 * Stripe_Forecast_Monthly stores items_json: it keeps the detail available for
 * later analysis without a second high-volume tab.
 */
export function normaliseSessionSteps(value) {
  let entries = value;
  if (typeof value === 'string') {
    try {
      entries = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, 3).map((entry, index) => ({
    q: countValue(entry?.q) || index + 1,
    recordMs: durationValue(entry?.recordMs),
    transcribeMs: durationValue(entry?.transcribeMs),
    chars: countValue(entry?.chars),
    errors: countValue(entry?.errors) || 0,
    skipped: Boolean(entry?.skipped),
    reRecorded: countValue(entry?.reRecorded) || 0,
  }));
}

export function normalisePracticeChatSessionPayload(payload = {}, now = new Date()) {
  const sessionId = clean(payload.sessionId || payload.session_id, MAX_ID);
  const studentMmsId = clean(payload.studentMmsId || payload.studentId, 120);

  const errors = [];
  if (!sessionId) errors.push('sessionId is required');
  if (!studentMmsId) errors.push('studentMmsId is required');

  return {
    errors,
    sessionId,
    openedAt: dateTimeValue(payload.openedAt) || now.toISOString(),
    studentMmsId,
    tutor: clean(payload.tutor || payload.tutorName, 120),
    asrModel: clean(payload.asrModel, 80),
    buildVersion: clean(payload.buildVersion, 80),
    phase: enumValue(payload.phase, SESSION_PHASES, 'opened'),
    outcome: enumValue(payload.outcome, SESSION_OUTCOMES),
    noteId: clean(payload.noteId, MAX_ID),
    questionsAnswered: countValue(payload.questionsAnswered, { max: 3 }),
    questionsSkipped: countValue(payload.questionsSkipped, { max: 3 }),
    typedNotSpoken: Boolean(payload.typedNotSpoken),
    lastStep: enumValue(payload.lastStep, SESSION_STEPS),
    msToFirstRecord: durationValue(payload.msToFirstRecord),
    msCaptureTotal: durationValue(payload.msCaptureTotal),
    msTranscribeTotal: durationValue(payload.msTranscribeTotal),
    msActive: durationValue(payload.msActive),
    msSessionTotal: durationValue(payload.msSessionTotal),
    asrErrorCount: countValue(payload.asrErrorCount),
    reRecordCount: countValue(payload.reRecordCount),
    safetyFlagCount: countValue(payload.safetyFlagCount),
    safetyAck: Boolean(payload.safetyAck),
    noteEdited: Boolean(payload.noteEdited),
    // Signed: a tutor cutting the note down is a different signal from one
    // adding to it, and Math.abs would erase the distinction.
    editCharDelta: Number.isFinite(Number(payload.editCharDelta))
      ? Math.trunc(Number(payload.editCharDelta))
      : '',
    songsSelected: countValue(payload.songsSelected, { max: 12 }),
    unlistedSongs: countValue(payload.unlistedSongs, { max: 6 }),
    priorNoteExists: Boolean(payload.priorNoteExists),
    priorNoteAgeDays: countValue(payload.priorNoteAgeDays, { max: 3650 }),
    priorHistoryOpened: Boolean(payload.priorHistoryOpened),
    ratingPrompted: Boolean(payload.ratingPrompted),
    ratingAccuracy: ratingValue(payload.ratingAccuracy),
    ratingComment: clean(payload.ratingComment, MAX_TEXT),
    ratingAnsweredAt: dateTimeValue(payload.ratingAnsweredAt),
    priorUsefulness: ratingValue(payload.priorUsefulness),
    priorUsefulnessAt: dateTimeValue(payload.priorUsefulnessAt),
    steps: normaliseSessionSteps(payload.steps || payload.steps_json),
    createdAt: now.toISOString(),
  };
}

export function buildPracticeChatSessionSheetRow(session = {}) {
  return {
    session_id: session.sessionId || '',
    opened_at: session.openedAt || '',
    student_mms_id: session.studentMmsId || '',
    tutor: session.tutor || '',
    asr_model: session.asrModel || '',
    build_version: session.buildVersion || '',
    phase: session.phase || '',
    outcome: session.outcome || '',
    note_id: session.noteId || '',
    questions_answered: session.questionsAnswered ?? '',
    questions_skipped: session.questionsSkipped ?? '',
    typed_not_spoken: boolString(session.typedNotSpoken),
    last_step: session.lastStep || '',
    ms_to_first_record: session.msToFirstRecord ?? '',
    ms_capture_total: session.msCaptureTotal ?? '',
    ms_transcribe_total: session.msTranscribeTotal ?? '',
    ms_active: session.msActive ?? '',
    ms_session_total: session.msSessionTotal ?? '',
    asr_error_count: session.asrErrorCount ?? '',
    re_record_count: session.reRecordCount ?? '',
    safety_flag_count: session.safetyFlagCount ?? '',
    safety_ack: boolString(session.safetyAck),
    note_edited: boolString(session.noteEdited),
    edit_char_delta: session.editCharDelta ?? '',
    songs_selected: session.songsSelected ?? '',
    unlisted_songs: session.unlistedSongs ?? '',
    prior_note_exists: boolString(session.priorNoteExists),
    prior_note_age_days: session.priorNoteAgeDays ?? '',
    prior_history_opened: boolString(session.priorHistoryOpened),
    rating_prompted: boolString(session.ratingPrompted),
    rating_accuracy: session.ratingAccuracy ?? '',
    rating_comment: session.ratingComment || '',
    rating_answered_at: session.ratingAnsweredAt || '',
    prior_usefulness: session.priorUsefulness ?? '',
    prior_usefulness_at: session.priorUsefulnessAt || '',
    steps_json: JSON.stringify(session.steps || []),
    created_at: session.createdAt || '',
  };
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalisePracticeChatSessionRow(row = {}) {
  return {
    sessionId: row.session_id || '',
    openedAt: row.opened_at || '',
    studentMmsId: row.student_mms_id || '',
    tutor: row.tutor || '',
    asrModel: row.asr_model || '',
    buildVersion: row.build_version || '',
    phase: row.phase || '',
    outcome: row.outcome || '',
    noteId: row.note_id || '',
    questionsAnswered: numberOrNull(row.questions_answered),
    questionsSkipped: numberOrNull(row.questions_skipped),
    typedNotSpoken: readBool(row.typed_not_spoken),
    lastStep: row.last_step || '',
    msToFirstRecord: numberOrNull(row.ms_to_first_record),
    msCaptureTotal: numberOrNull(row.ms_capture_total),
    msTranscribeTotal: numberOrNull(row.ms_transcribe_total),
    msActive: numberOrNull(row.ms_active),
    msSessionTotal: numberOrNull(row.ms_session_total),
    asrErrorCount: numberOrNull(row.asr_error_count),
    reRecordCount: numberOrNull(row.re_record_count),
    safetyFlagCount: numberOrNull(row.safety_flag_count),
    safetyAck: readBool(row.safety_ack),
    noteEdited: readBool(row.note_edited),
    editCharDelta: numberOrNull(row.edit_char_delta),
    songsSelected: numberOrNull(row.songs_selected),
    unlistedSongs: numberOrNull(row.unlisted_songs),
    priorNoteExists: readBool(row.prior_note_exists),
    priorNoteAgeDays: numberOrNull(row.prior_note_age_days),
    priorHistoryOpened: readBool(row.prior_history_opened),
    ratingPrompted: readBool(row.rating_prompted),
    ratingAccuracy: numberOrNull(row.rating_accuracy),
    ratingComment: row.rating_comment || '',
    ratingAnsweredAt: row.rating_answered_at || '',
    priorUsefulness: numberOrNull(row.prior_usefulness),
    priorUsefulnessAt: row.prior_usefulness_at || '',
    steps: normaliseSessionSteps(row.steps_json),
    createdAt: row.created_at || '',
  };
}

/**
 * What an unfinished row means, decided here rather than by the client.
 *
 * `completed` — the client reported reaching the end.
 * `abandoned` — unfinished and old enough that nothing more is coming.
 * `in_flight` — unfinished but recent; a lesson may still be running, so this
 *   is deliberately neither a success nor a failure and must be excluded from
 *   both numerator and denominator of any completion rate.
 */
export function deriveSessionOutcome(session = {}, now = new Date()) {
  if (session.phase === 'finished') return 'completed';
  const openedAt = new Date(session.openedAt || '').getTime();
  if (!Number.isFinite(openedAt)) return 'abandoned';
  return now.getTime() - openedAt >= ABANDONED_AFTER_MS ? 'abandoned' : 'in_flight';
}

/**
 * The session a "was last week's note useful?" answer belongs to.
 *
 * The tutor answers on the dashboard at the *next* lesson, about a note written
 * at a previous one, and the dashboard never learns that older session's id. So
 * the server resolves it: the student's most recent finished session that
 * produced a note and has not already been rated.
 *
 * Requiring a `noteId` matters — an abandoned session produced no note, so
 * there is nothing for the tutor to have found useful. Requiring the rating to
 * be absent makes the write idempotent: a double-tap cannot overwrite an answer
 * or silently walk backwards through the student's history.
 */
export function selectSessionForPriorRating(sessions = [], studentMmsId = '') {
  const wanted = `${studentMmsId || ''}`.trim();
  if (!wanted) return null;

  return sessions
    .filter((session) => (
      session.studentMmsId === wanted
      && session.noteId
      && session.phase === 'finished'
      && !session.priorUsefulness
    ))
    .sort((a, b) => (
      new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()
    ))[0] || null;
}
