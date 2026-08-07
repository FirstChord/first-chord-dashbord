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

test('one song spelled several ways becomes one piece, counted by distinct lessons', () => {
  // The real failure: the ASR wrote The Man Who Sold the World three ways in
  // one student's notes, so the tutor saw three pieces with three counts.
  // Each spelling has to recur on its own before it is a candidate at all, so
  // the fixture mirrors the live data: two spellings twice, one three times.
  const notes = [
    note({ date: '2026-07-10', did: 'We started The Man Who Sold the World today.' }),
    note({ date: '2026-07-17', did: 'More work on Man Who Sold, the barre chords mainly.' }),
    note({ date: '2026-07-24', did: 'Who Solved the World is nearly there.' }),
    note({ date: '2026-07-31', did: 'Who Solved the World, tidying the solo.' }),
    note({ date: '2026-08-07', did: 'Polished the last bits of The Man Who Sold the World.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const matching = pieces.filter((piece) => /sold|solved/i.test(piece.label));

  assert.equal(matching.length, 1, `expected one merged piece, got ${matching.map((p) => p.label).join(' | ')}`);
  // Counted by distinct lessons, not by summing the per-spelling tallies —
  // which would have read 3 + 2 + 2 = 7 across five lessons.
  assert.equal(matching[0].lessonCount, 5);
  assert.equal(matching[0].firstDate, '2026-07-10');
  assert.equal(matching[0].lastDate, '2026-08-07');
});

test('a matched song is named by the catalogue, not by what the ASR heard', () => {
  const notes = [
    note({ date: '2026-07-10', did: 'Working on Who Sold the World again.' }),
    note({ date: '2026-07-17', did: 'Who Sold the World, second half.' }),
    note({ date: '2026-07-24', did: 'Man Who Sold today.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const piece = pieces.find((entry) => /sold/i.test(entry.label));

  assert.ok(piece);
  // Showing the tutor "Who Sold the World" shows them the mishearing rather
  // than the piece they are about to teach.
  assert.equal(piece.label, 'The Man Who Sold the World');
  assert.ok(piece.songId, 'a catalogue-named piece carries its song id');
});

test('two different songs sharing words are not merged', () => {
  // Sweet Home Chicago is in the catalogue and Sweet Home Alabama is not, so a
  // token-overlap rule would happily fold one into the other.
  const notes = [
    note({ date: '2026-07-01', did: 'We looked at Sweet Home Chicago and the 12-bar form.' }),
    note({ date: '2026-07-08', did: 'Sweet Home Chicago again, then started Sweet Home Alabama.' }),
    note({ date: '2026-07-15', did: 'Sweet Home Alabama intro riff.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const labels = pieces.map((piece) => piece.label);

  assert.ok(labels.some((l) => /chicago/i.test(l)), `expected Chicago, got ${labels.join(' | ')}`);
  assert.ok(labels.some((l) => /alabama/i.test(l)), `expected Alabama, got ${labels.join(' | ')}`);
});

test('a piece with no catalogue entry is left exactly as written', () => {
  const notes = [
    note({ date: '2026-07-01', did: 'Started Bogus Fake Tune, an original.' }),
    note({ date: '2026-07-08', did: 'Bogus Fake Tune, second section.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const piece = pieces.find((entry) => /bogus/i.test(entry.label));

  assert.ok(piece, 'an unmatched title must still be surfaced');
  assert.equal(piece.label, 'Bogus Fake Tune');
  assert.equal(piece.lessonCount, 2);
});

test('a single distinctive word never claims a catalogue song', () => {
  // "world" alone must not attach to The Man Who Sold the World.
  const notes = [
    note({ date: '2026-07-01', did: 'We talked about World Music and its rhythms.' }),
    note({ date: '2026-07-08', did: 'More World Music listening.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const piece = pieces.find((entry) => /world/i.test(entry.label));

  assert.ok(piece);
  assert.equal(piece.label, 'World Music');
});

test('a piece the catalogue does not know keeps the tutor’s wording and no song id', () => {
  // Correctness for these is a catalogue-coverage question, not an algorithm
  // one — which is why cataloguing a song is what fixes its card. This fixture
  // uses an invented title so it stays uncatalogued no matter what is added.
  const notes = [
    note({ date: '2026-07-01', did: 'Started Zarbatron Waltz this week.' }),
    note({ date: '2026-07-08', did: 'Zarbatron Waltz, second section.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const piece = pieces.find((entry) => /zarbatron/i.test(entry.label));

  assert.ok(piece);
  assert.equal(piece.label, 'Zarbatron Waltz');
  assert.equal(piece.songId, '');
});

test('a phrase matching several different catalogue titles names none of them', () => {
  // "Riff Exercise", "Grade 1 Riff Exercise" and "Grade 3 Riff Exercise" are
  // all catalogued. Naming this after whichever fitted tightest put a bass
  // grade 3 title on a guitar student's card.
  const notes = [
    note({ date: '2026-07-01', did: 'We worked on the Riff Exercise today.' }),
    note({ date: '2026-07-08', did: 'Riff Exercise again, cleaner this time.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const piece = pieces.find((entry) => /riff/i.test(entry.label));

  assert.ok(piece);
  assert.equal(piece.songId, '', 'an ambiguous phrase must not claim a song');
  assert.equal(piece.label, 'Riff Exercise', 'it falls back to what the tutor said');
});

test('an ambiguous fragment resolves to a song the same student already names', () => {
  // "man who solved" fits both The Man Who Sold the World and The Man Who
  // Can't Be Moved. On its own it identifies neither — but this student's other
  // notes name one of them outright, so the fragment belongs to that one.
  const notes = [
    note({ date: '2026-07-10', did: 'Who Solved the World, first half.' }),
    note({ date: '2026-07-17', did: 'Who Solved the World again today.' }),
    note({ date: '2026-07-24', did: 'Man Who Solved, the barre chords.' }),
    note({ date: '2026-07-31', did: 'Man Who Solved, tidying it up.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const matching = pieces.filter((piece) => /sold|solved|man who/i.test(piece.label));

  assert.equal(matching.length, 1, `expected one piece, got ${matching.map((p) => p.label).join(' | ')}`);
  assert.equal(matching[0].label, 'The Man Who Sold the World');
  assert.equal(matching[0].lessonCount, 4);
});

test('an ambiguous fragment with no supporting evidence stays as written', () => {
  const notes = [
    note({ date: '2026-07-10', did: 'We started Man Who today.' }),
    note({ date: '2026-07-17', did: 'Man Who again, slower.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const piece = pieces.find((entry) => /man who/i.test(entry.label));

  assert.ok(piece);
  assert.equal(piece.songId, '', 'nothing tells us which "Man Who" song this is');
  assert.equal(piece.label, 'Man Who');
});

test('a mishearing must share the start of the word', () => {
  // "sitting" and "getting" are two edits apart, which once pulled a Taylor
  // Swift title into a student working on Dock of the Bay.
  const notes = [
    note({ date: '2026-07-01', did: 'We were Sitting Comfortably before starting.' }),
    note({ date: '2026-07-08', did: 'Sitting Comfortably again this week.' }),
  ];
  const { pieces } = extractRecurringThemes(notes);
  const piece = pieces.find((entry) => /sitting/i.test(entry.label));

  assert.ok(piece);
  assert.doesNotMatch(piece.label, /getting|together/iu);
});

function noteWithSongs({ date, did = '', songIds = [], songTitles = [] }) {
  return { ...note({ date, did }), songIds, songTitles };
}

test('a tutor-confirmed song link is recorded as confirmed, not inferred', () => {
  const notes = [
    noteWithSongs({
      date: '2026-07-01',
      did: 'We played through it twice.',
      songIds: ['fc_song_ho_hey'],
      songTitles: ['Ho Hey'],
    }),
    noteWithSongs({ date: '2026-07-08', did: 'More of the same.', songIds: ['fc_song_ho_hey'], songTitles: ['Ho Hey'] }),
  ];
  const { pieces } = buildPracticeSummary(notes);
  const piece = pieces.find((entry) => entry.songId === 'fc_song_ho_hey');

  assert.ok(piece, 'a confirmed song appears even though no phrase named it');
  assert.equal(piece.songIdSource, 'confirmed');
  assert.equal(piece.label, 'Ho Hey');
  assert.equal(piece.lessonCount, 2);
  assert.equal(piece.confirmedLessonCount, 2);
});

test('a mined piece stays labelled inferred so nothing mistakes it for a join', () => {
  const notes = [
    note({ date: '2026-07-01', did: 'Started The Man Who Sold the World.' }),
    note({ date: '2026-07-08', did: 'The Man Who Sold the World again.' }),
  ];
  const { pieces } = buildPracticeSummary(notes);
  const piece = pieces.find((entry) => /sold the world/i.test(entry.label));

  assert.ok(piece);
  assert.ok(piece.songId, 'the catalogue supplied an id');
  assert.equal(piece.songIdSource, 'inferred');
  assert.equal(piece.confirmedLessonCount, 0);
});

test('an unmatched piece carries no song id and no source', () => {
  const notes = [
    note({ date: '2026-07-01', did: 'Started Zarbatron Waltz.' }),
    note({ date: '2026-07-08', did: 'Zarbatron Waltz again.' }),
  ];
  const { pieces } = buildPracticeSummary(notes);
  const piece = pieces.find((entry) => /zarbatron/i.test(entry.label));

  assert.ok(piece);
  assert.equal(piece.songId, '');
  assert.equal(piece.songIdSource, '');
});

test('confirming a song a phrase already found upgrades it without losing lessons', () => {
  // The regression this guards: counting only confirmed lessons would drop a
  // piece worked on for weeks to "1 lesson" the moment a tutor first used the
  // selector, which reads as the feature breaking.
  const notes = [
    note({ date: '2026-07-01', did: 'Started The Man Who Sold the World.' }),
    note({ date: '2026-07-08', did: 'The Man Who Sold the World, chorus.' }),
    noteWithSongs({
      date: '2026-07-15',
      did: 'Kept going with it.',
      songIds: ['fc_song_the_man_who_sold_the_world'],
      songTitles: ['The Man Who Sold the World'],
    }),
  ];
  const { pieces } = buildPracticeSummary(notes);
  const matching = pieces.filter((entry) => /sold the world/i.test(entry.label));

  assert.equal(matching.length, 1, 'the confirmed link and the mined phrase are one piece');
  assert.equal(matching[0].songIdSource, 'confirmed');
  assert.equal(matching[0].lessonCount, 3, 'all three lessons count');
  assert.equal(matching[0].confirmedLessonCount, 1, 'but only one is confirmed evidence');
});
