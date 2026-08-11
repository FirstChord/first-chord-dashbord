#!/usr/bin/env node
// The six-week Practice Chat evaluation, as CSV for analysis in Python.
//
//   node scripts/eval-practice-chat.mjs [--days 42]
//
// Writes two files under backups/practice-chat-eval/ (gitignored, like every
// other local extract of school data):
//
//   sessions-<date>.csv  one row per ritual attempt, joined to its note
//   summary-<date>.txt   the headline figures, as the dashboard shows them
//
// This is where **per-tutor adoption** lives, deliberately. The dashboard page
// shows school-level totals and names a tutor only against something broken,
// because state-tabs.md forbids that page becoming a tutor leaderboard. A
// spreadsheet Finn opens to make a judgement is a different artefact from a
// screen the school walks past, and the tutor column belongs in the first one.
//
// Read-only: it fetches Sheets and MMS and writes local files. Nothing else.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPracticeChatSessionRows, getPracticeNoteLogRows } from '../lib/admin/sheets.js';
import { searchAttendanceForPayroll } from '../lib/admin/mms.js';
import {
  buildPracticeChatEvaluation,
  DEFAULT_WINDOW_DAYS,
  mapEvaluationLessons,
  weekStartOf,
} from '../lib/admin/practice-chat-eval-helpers.mjs';
import { deriveSessionOutcome } from '../lib/admin/practice-chat-session-helpers.mjs';
import { resolveTutorName } from '../lib/admin/tutor-identity.mjs';
import { loadLocalEnv } from './script-env.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, headers) {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n');
}

const SESSION_COLUMNS = [
  'session_id', 'opened_at', 'week_start', 'student_mms_id', 'tutor',
  'derived_outcome', 'phase', 'outcome', 'last_step',
  'questions_answered', 'questions_skipped', 'typed_not_spoken',
  'ms_to_first_record', 'ms_capture_total', 'ms_transcribe_total', 'ms_active', 'ms_session_total',
  'asr_error_count', 're_record_count', 'safety_flag_count', 'safety_ack',
  'note_edited', 'edit_char_delta', 'songs_selected', 'unlisted_songs',
  'prior_note_exists', 'prior_note_age_days', 'prior_history_opened',
  'rating_prompted', 'rating_accuracy', 'rating_comment', 'prior_usefulness',
  'asr_model', 'build_version',
  // Joined from Practice_Notes_Log so one file answers most questions.
  'note_id', 'note_lesson_date', 'note_has_practice_goals', 'note_has_challenges',
  'note_song_count', 'note_email_status', 'note_manual_follow_up',
];

function sessionRow(session, notesById) {
  const note = notesById.get(session.noteId) || null;
  const hasText = (value) => (`${value || ''}`.trim() ? 1 : 0);
  return {
    session_id: session.sessionId,
    opened_at: session.openedAt,
    week_start: weekStartOf(session.openedAt),
    student_mms_id: session.studentMmsId,
    tutor: resolveTutorName(session.tutor),
    derived_outcome: session.derivedOutcome,
    phase: session.phase,
    outcome: session.outcome,
    last_step: session.lastStep,
    questions_answered: session.questionsAnswered,
    questions_skipped: session.questionsSkipped,
    typed_not_spoken: session.typedNotSpoken ? 1 : 0,
    ms_to_first_record: session.msToFirstRecord,
    ms_capture_total: session.msCaptureTotal,
    ms_transcribe_total: session.msTranscribeTotal,
    ms_active: session.msActive,
    ms_session_total: session.msSessionTotal,
    asr_error_count: session.asrErrorCount,
    re_record_count: session.reRecordCount,
    safety_flag_count: session.safetyFlagCount,
    safety_ack: session.safetyAck ? 1 : 0,
    note_edited: session.noteEdited ? 1 : 0,
    edit_char_delta: session.editCharDelta,
    songs_selected: session.songsSelected,
    unlisted_songs: session.unlistedSongs,
    prior_note_exists: session.priorNoteExists ? 1 : 0,
    prior_note_age_days: session.priorNoteAgeDays,
    prior_history_opened: session.priorHistoryOpened ? 1 : 0,
    rating_prompted: session.ratingPrompted ? 1 : 0,
    rating_accuracy: session.ratingAccuracy,
    rating_comment: session.ratingComment,
    prior_usefulness: session.priorUsefulness,
    asr_model: session.asrModel,
    build_version: session.buildVersion,
    note_id: session.noteId,
    note_lesson_date: note?.lessonDate || '',
    // Booleans, not the note text: this file is for counting, and a CSV full of
    // lesson prose is a data-protection problem looking for a laptop to sit on.
    note_has_practice_goals: note ? hasText(note.practiceGoals) : '',
    note_has_challenges: note ? hasText(note.progressChallenges) : '',
    note_song_count: note ? (note.songIds?.length || 0) + (note.unlistedSongTitles?.length || 0) : '',
    note_email_status: note?.emailSendStatus || '',
    note_manual_follow_up: note ? (note.manualFollowUpNeeded ? 1 : 0) : '',
  };
}

function pct(rate) {
  return rate?.pct === null || rate?.pct === undefined ? '—' : `${rate.pct}%`;
}

function formatSummary(report, perTutor) {
  const { adoption, friction, reliability, editing, cost, timeSaved, learningCurve } = report.observed;
  const { accuracy, usefulness } = report.rated;
  const { continuity, compounding, reflection } = report.derived;

  const lines = [
    `Practice Chat evaluation — ${report.windowDays} days to ${report.generatedAt.slice(0, 10)}`,
    '',
    'OBSERVED',
    `  Rituals started            ${adoption.ritualsStarted}`,
    `  Rituals completed          ${adoption.ritualsCompleted}`,
    `  Still in progress          ${adoption.inFlight} (excluded from completion rate)`,
    `  Eligible lessons taught    ${adoption.eligibleLessons} (+${adoption.unrecordedLessons} unmarked, ${adoption.absentLessons} absences excluded)`,
    `  Adoption                   ${pct(adoption.adoptionRate)} (${adoption.adoptionRate.count}/${adoption.adoptionRate.total})`,
    `  Completion once started    ${pct(adoption.completionRate)} (${adoption.completionRate.count}/${adoption.completionRate.total})`,
    `  Median active time         ${Math.round((friction.medianActiveMs || 0) / 1000)}s over ${friction.timedSessions} sessions`,
    `  p90 active time            ${Math.round((friction.p90ActiveMs || 0) / 1000)}s`,
    `  Abandoned                  ${pct(friction.abandonmentRate)} (${friction.abandonmentRate.count}/${friction.abandonmentRate.total})`,
    `  Abandonment points         ${friction.abandonedByStep.map((s) => `${s.label}=${s.count}`).join(' ') || 'none'}`,
    `  Transcription errors       ${pct(reliability.asrErrorSessions)} of sessions, ${reliability.totalAsrErrors} total`,
    `  Re-records (not failures)  ${pct(reliability.reRecordSessions)} of sessions, ${reliability.totalReRecords} total`,
    `  Delivery                   ${reliability.deliverySent} sent · ${reliability.deliveryFailed} failed · ${reliability.deliveryUntracked} untracked · ${reliability.manualFollowUp} need follow-up`,
    `  Notes edited before save   ${pct(editing.editRate)} (${editing.editRate.count}/${editing.editRate.total})`,
    '',
    'COST AND TIME',
    `  Cost per note              ${cost.perNoteUsd === null ? '— (no priced sessions)' : `$${cost.perNoteUsd.toFixed(4)}`}`,
    `  Total spend                ${cost.totalUsd === null ? '—' : `$${cost.totalUsd.toFixed(2)}`} over ${cost.audioMinutes} audio minutes`
      + (cost.unpricedSessions ? ` (${cost.unpricedSessions} sessions on an unpriced model, excluded)` : ''),
    timeSaved.savedPerNoteMs === null
      ? '  Time saved                 NO BASELINE — hand-time ~10 manual notes into'
        + '\n                             lib/config/practice-chat-baseline.mjs. Cannot be'
        + '\n                             measured retrospectively.'
      : `  Time saved per note        ${Math.round(timeSaved.savedPerNoteMs / 1000)}s vs ${timeSaved.baselineSeconds}s by hand`
        + `\n  Hours saved in window      ${timeSaved.savedTotalHours} across ${timeSaved.notesCompared} notes`
        + `\n  Baseline provenance        ${timeSaved.baselineNote || 'not recorded'}`,
    `  Learning curve             ${learningCurve.length > 1
      ? learningCurve.map((e) => `wk${e.week}=${Math.round(e.medianActiveMs / 1000)}s`).join(' ')
      : 'not enough weeks yet'}`,
    '',
    'RATED BY TUTORS (self-reported — never merge with the above)',
    `  Accuracy                   ${accuracy.mean ?? '—'} / 5 from n=${accuracy.n} (${pct(accuracy.responseRate)} of prompts answered)`,
    `  Useful next lesson         ${usefulness.mean ?? '—'} / 5 from n=${usefulness.n}`,
    '',
    'DERIVED (a rule inferred these — not measurements)',
    `  Next practice action       ${pct(reflection.nextActionCaptured)} of notes`,
    `  Progress/challenges        ${pct(reflection.challengesCaptured)} of notes`,
    `  Looked up earlier lessons  ${pct(continuity.historyOpened)} of sessions that had a previous note`,
    `  Median days between        ${continuity.medianDaysBetweenRituals ?? '—'}`,
    `  Students 2+ / 4+ / 6+      ${compounding.studentsWith2Plus} / ${compounding.studentsWith4Plus} / ${compounding.studentsWith6Plus} (of ${compounding.studentsWithAny})`,
    '',
    'BY TUTOR (this file only — deliberately absent from the dashboard)',
    ...perTutor.map((entry) => (
      `  ${entry.tutor.padEnd(12)} ${String(entry.completed).padStart(3)} completed / ${String(entry.started).padStart(3)} started / ${String(entry.eligible).padStart(3)} taught`
    )),
    '',
    'NOT MEASURABLE THIS CYCLE',
    '  Speaker-attribution corrections — no diarisation exists in the pipeline.',
    '  Whether the student\'s voice appears — one mic, one undifferentiated transcript.',
    '  "Read the previous note" — the dashboard always renders it; only the',
    '    deliberate "Show earlier lessons" click is evidence.',
    '  These are not zero. They are unmeasurable, and reporting them as zero',
    '  would be the most misleading thing this file could do.',
  ];
  return lines.join('\n');
}

function buildPerTutor({ sessions, lessons, now }) {
  const byTutor = new Map();
  const touch = (tutor) => {
    const name = resolveTutorName(tutor) || 'unknown';
    if (!byTutor.has(name)) byTutor.set(name, { tutor: name, started: 0, completed: 0, eligible: 0 });
    return byTutor.get(name);
  };
  for (const session of sessions) {
    const entry = touch(session.tutor);
    entry.started += 1;
    if (deriveSessionOutcome(session, now) === 'completed') entry.completed += 1;
  }
  for (const lesson of lessons) {
    if (!lesson.tutor) continue;
    touch(lesson.tutor).eligible += 1;
  }
  return [...byTutor.values()].sort((a, b) => b.completed - a.completed || a.tutor.localeCompare(b.tutor));
}

async function main() {
  await loadLocalEnv(repoRoot);

  const windowDays = argValue('--days', DEFAULT_WINDOW_DAYS);
  const now = new Date();
  const startDate = new Date(now.getTime() - windowDays * DAY_MS).toISOString().slice(0, 10);
  const endDate = now.toISOString().slice(0, 10);

  const [sessions, notes] = await Promise.all([
    getPracticeChatSessionRows(),
    getPracticeNoteLogRows(),
  ]);

  let attendanceRows = [];
  try {
    const result = await searchAttendanceForPayroll({ startDate, endDate, allowExpired: true });
    attendanceRows = result?.rows || [];
  } catch (error) {
    console.warn(`⚠️  MMS attendance unavailable (${error.message}). Adoption rates will be blank.`);
  }

  const report = buildPracticeChatEvaluation({ sessions, notes, attendanceRows, now, windowDays });
  const windowStartMs = now.getTime() - windowDays * DAY_MS;
  const windowSessions = sessions
    .filter((session) => new Date(session.openedAt || 0).getTime() >= windowStartMs)
    .map((session) => ({ ...session, derivedOutcome: deriveSessionOutcome(session, now) }));
  const lessons = mapEvaluationLessons(attendanceRows)
    .filter((lesson) => new Date(lesson.startAt || 0).getTime() >= windowStartMs);

  const notesById = new Map(notes.filter((note) => note.noteId).map((note) => [note.noteId, note]));
  const perTutor = buildPerTutor({ sessions: windowSessions, lessons, now });

  const outDir = path.join(repoRoot, 'backups', 'practice-chat-eval');
  await mkdir(outDir, { recursive: true });

  const csvPath = path.join(outDir, `sessions-${endDate}.csv`);
  const summaryPath = path.join(outDir, `summary-${endDate}.txt`);
  const summary = formatSummary(report, perTutor);

  await writeFile(
    csvPath,
    toCsv(windowSessions.map((session) => sessionRow(session, notesById)), SESSION_COLUMNS),
    'utf8',
  );
  await writeFile(summaryPath, `${summary}\n`, 'utf8');

  console.log(summary);
  console.log('');
  console.log(`📄 ${path.relative(repoRoot, csvPath)}  (${windowSessions.length} sessions)`);
  console.log(`📄 ${path.relative(repoRoot, summaryPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
