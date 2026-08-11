#!/usr/bin/env node
// The week 3 / week 6 review of generated learner progress summaries.
//
//   node scripts/eval-practice-summaries.mjs --week 3 [--sample 15] [--min-notes 3]
//
// Samples students who have enough history for a summary to be worth judging,
// writes each generated summary beside the notes it was built from, and leaves
// five columns blank for a human to fill in:
//
//   accurate        1-5   does it match what the notes actually say?
//   missed          y/n   did it leave out something important?
//   unsupported     y/n   did it assert anything the notes do not support?
//   useful          1-5   would this help you plan the next lesson?
//   comment         free text
//
// The last one is the point. A summary can be perfectly faithful to the notes
// and still be of no use to the person teaching next Tuesday, and only a tutor
// reading it can tell you that.
//
// `buildPracticeSummary` is deterministic, so this reruns cleanly and the same
// input always produces the same summary to judge.
//
// Output lands in backups/practice-chat-eval/ (gitignored). It contains real
// lesson notes and student names — the same data as the Sheets backup beside
// it. Keep it local; do not attach it to anything.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPracticeNoteLogRows } from '../lib/admin/sheets.js';
import { buildPracticeSummary } from '../lib/admin/practice-summary-helpers.mjs';
import { loadLocalEnv } from './script-env.mjs';

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

const COLUMNS = [
  'student_mms_id', 'student_name', 'notes_used', 'first_note', 'last_note',
  'generated_focus', 'generated_pieces', 'generated_latest_progress',
  'source_notes',
  // Left blank on purpose — these are the review.
  'accurate_1_5', 'missed_important_y_n', 'unsupported_claim_y_n', 'useful_1_5', 'comment',
];

function renderSummary(summary) {
  return {
    focus: summary?.focus?.text || '',
    pieces: (summary?.pieces || [])
      .map((piece) => {
        const source = piece.songIdSource === 'confirmed' ? 'tutor-confirmed' : 'inferred from wording';
        return `${piece.label} (${piece.lessonCount} lesson${piece.lessonCount === 1 ? '' : 's'}, ${source})`;
      })
      .join(' | '),
    latestProgress: summary?.latestProgress || '',
  };
}

function renderSourceNotes(notes) {
  return notes
    .slice()
    .sort((a, b) => `${a.lessonDate}`.localeCompare(`${b.lessonDate}`))
    .map((note) => {
      const parts = [
        note.whatWeDid && `What we did: ${note.whatWeDid}`,
        note.progressChallenges && `Progress & challenges: ${note.progressChallenges}`,
        note.practiceGoals && `Practice goals: ${note.practiceGoals}`,
      ].filter(Boolean);
      return `[${note.lessonDate || 'undated'}] ${parts.join(' / ')}`;
    })
    .join('\n\n');
}

async function main() {
  await loadLocalEnv(repoRoot);

  const week = argValue('--week', 0);
  if (![3, 6].includes(week)) {
    console.error('Pass --week 3 or --week 6 (the two agreed review points).');
    process.exit(1);
  }
  const sampleSize = argValue('--sample', 15);
  const minNotes = argValue('--min-notes', 3);

  const notes = await getPracticeNoteLogRows();

  const byStudent = new Map();
  for (const note of notes) {
    if (!note.studentMmsId) continue;
    const list = byStudent.get(note.studentMmsId) || [];
    list.push(note);
    byStudent.set(note.studentMmsId, list);
  }

  const eligible = [...byStudent.entries()]
    .filter(([, studentNotes]) => studentNotes.length >= minNotes)
    // Most history first: a summary built from three notes is a thinner test of
    // the compounding claim than one built from eight.
    .sort((a, b) => b[1].length - a[1].length);

  if (!eligible.length) {
    console.log(`No students have ${minNotes}+ practice notes yet — nothing to review at week ${week}.`);
    return;
  }

  const sample = eligible.slice(0, sampleSize);
  const rows = sample.map(([studentMmsId, studentNotes]) => {
    const summary = buildPracticeSummary(studentNotes);
    const rendered = renderSummary(summary);
    const dates = studentNotes
      .map((note) => note.lessonDate)
      .filter(Boolean)
      .sort();
    return {
      student_mms_id: studentMmsId,
      student_name: studentNotes.find((note) => note.studentName)?.studentName || '',
      notes_used: studentNotes.length,
      first_note: dates[0] || '',
      last_note: dates[dates.length - 1] || '',
      generated_focus: rendered.focus,
      generated_pieces: rendered.pieces,
      generated_latest_progress: rendered.latestProgress,
      source_notes: renderSourceNotes(studentNotes),
      accurate_1_5: '',
      missed_important_y_n: '',
      unsupported_claim_y_n: '',
      useful_1_5: '',
      comment: '',
    };
  });

  const outDir = path.join(repoRoot, 'backups', 'practice-chat-eval');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `practice-summary-review-wk${week}.csv`);

  await writeFile(
    outPath,
    [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(','))].join('\n'),
    'utf8',
  );

  console.log(`Week ${week} summary review`);
  console.log(`  ${eligible.length} students have ${minNotes}+ notes; sampled ${rows.length}`);
  console.log(`  median notes per sampled student: ${rows[Math.floor(rows.length / 2)]?.notes_used ?? '—'}`);
  console.log('');
  console.log(`📄 ${path.relative(repoRoot, outPath)}`);
  console.log('   Fill in accurate_1_5, missed_important_y_n, unsupported_claim_y_n, useful_1_5, comment.');
  if (week === 3) {
    console.log('');
    console.log('   Note: at week 3 the sample will be almost entirely your own students,');
    console.log('   since other tutors only start this week. Say so in the write-up.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
