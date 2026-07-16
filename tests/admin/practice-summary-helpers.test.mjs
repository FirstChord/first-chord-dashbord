import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractRecurringThemes,
  buildPracticeSummary,
} from '../../lib/admin/practice-summary-helpers.mjs';

function note({ date, did = '', progress = '', goals = '', student = 'David Fern', tutor = 'Finn Le Marinel' }) {
  return {
    noteId: `note_${date}`,
    lessonDate: date,
    studentName: student,
    tutorName: tutor,
    whatWeDid: did,
    progressChallenges: progress,
    practiceGoals: goals,
  };
}

test('a phrase recurring across two lessons becomes a piece when Title-Cased in the text', () => {
  const notes = [
    note({ date: '2026-07-01', did: 'We started Mr Tambourine Man and played through the first four bars.' }),
    note({ date: '2026-07-08', did: 'Continued with Mr Tambourine Man, adding the strumming pattern.' }),
    note({ date: '2026-07-15', did: 'Mr Tambourine Man with the backing track.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const piece = pieces.find((entry) => entry.phrase === 'mr tambourine man');
  assert.ok(piece, 'expected the recurring title to be detected as a piece');
  assert.equal(piece.label, 'Mr Tambourine Man');
  assert.equal(piece.lessonCount, 3);
  assert.equal(piece.firstDate, '2026-07-01');
  assert.equal(piece.lastDate, '2026-07-15');
});

test('a recurring lowercase phrase is a working theme, not a piece', () => {
  const notes = [
    note({ date: '2026-07-01', did: 'We worked on playing hands together in the first section.' }),
    note({ date: '2026-07-08', did: 'More hands together across the whole tune.' }),
  ];
  const { pieces, themes } = extractRecurringThemes(notes);
  assert.equal(pieces.length, 0);
  assert.ok(themes.some((entry) => entry.phrase === 'hands together'));
});

test('a phrase seen in only one lesson never surfaces', () => {
  const notes = [
    note({ date: '2026-07-01', did: 'We started Greensleeves Melody today.' }),
    note({ date: '2026-07-08', did: 'Scales and sight reading warm ups.' }),
  ];
  const { pieces, themes } = extractRecurringThemes(notes);
  assert.equal(pieces.length, 0);
  assert.equal(themes.length, 0);
});

test('speaker names never appear in phrases', () => {
  const notes = [
    note({
      date: '2026-07-01',
      student: 'Arnav Rekhate',
      progress: 'Finn: So Arnav, how are you feeling about the new song? Arnav: Pretty good.',
    }),
    note({
      date: '2026-07-08',
      student: 'Arnav Rekhate',
      progress: 'Finn: So Arnav, how did the week go? Arnav: Great.',
    }),
  ];
  const { pieces, themes } = extractRecurringThemes(notes);
  const all = [...pieces.map((p) => p.phrase), ...themes.map((t) => t.phrase)].join(' ');
  assert.doesNotMatch(all, /finn|arnav/u);
});

test('filler phrases are excluded even when they recur', () => {
  const notes = [
    note({ date: '2026-07-01', progress: 'Lightly Row is coming along nicely.' }),
    note({ date: '2026-07-08', progress: 'Lightly Row is coming along really well now.' }),
  ];
  const { pieces, themes } = extractRecurringThemes(notes);
  assert.ok(pieces.some((entry) => entry.label === 'Lightly Row'));
  assert.ok(!themes.some((entry) => entry.phrase.includes('coming along')));
});

test('the longest recurring phrasing wins over its fragments', () => {
  const notes = [
    note({ date: '2026-07-01', did: 'Played both hands together through the piece.' }),
    note({ date: '2026-07-08', did: 'Again both hands together, slower this time.' }),
  ];
  const { themes } = extractRecurringThemes(notes);
  assert.ok(themes.some((entry) => entry.phrase === 'both hands together'));
  assert.ok(!themes.some((entry) => entry.phrase === 'hands together'));
});

test('latest tempo comes from the newest sentence mentioning the piece, last value in it', () => {
  const notes = [
    note({ date: '2026-07-01', did: 'Cissy Strut was sitting at 70% today.' }),
    note({ date: '2026-07-08', did: 'Cissy Strut was at 90%, now up to 100%.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const piece = pieces.find((entry) => entry.phrase === 'cissy strut');
  assert.ok(piece);
  assert.equal(piece.latestTempo, 100);
});

test('buildPracticeSummary composes focus, progress, cadence, and carried-over goals', () => {
  const now = new Date('2026-07-16').getTime();
  const notes = [
    note({
      date: '2026-07-01',
      did: 'Started the F chord changes.',
      goals: 'Practise the F chord change slowly at home.',
    }),
    note({
      date: '2026-07-08',
      did: 'More chord change drills.',
      progress: 'The F chord is still buzzing on the high strings.',
      goals: 'Keep working on the F chord change before next lesson.',
    }),
  ];
  const summary = buildPracticeSummary(notes, { now });
  assert.equal(summary.noteCount, 2);
  assert.equal(summary.focus.text, 'Keep working on the F chord change before next lesson.');
  assert.equal(summary.focus.date, '2026-07-08');
  assert.equal(summary.focus.carriedOver, true, 'the F-chord goal repeats across lessons');
  assert.equal(summary.latestProgress, 'The F chord is still buzzing on the high strings.');
  assert.equal(summary.daysSinceLastLesson, 8);
  assert.equal(summary.firstDate, '2026-07-01');
});

test('buildPracticeSummary degrades cleanly with no notes', () => {
  const summary = buildPracticeSummary([]);
  assert.equal(summary.noteCount, 0);
  assert.equal(summary.focus.text, '');
  assert.equal(summary.pieces.length, 0);
  assert.equal(summary.themes.length, 0);
  assert.equal(summary.daysSinceLastLesson, null);
});
