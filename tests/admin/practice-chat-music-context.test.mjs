import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPracticeChatMusicContext,
  buildTranscriptionPrompt,
  inferInstrument,
  resolveSelectedPracticeNoteSongs,
  resolveUnlistedPracticeNoteSongs,
  selectCatalogueSongs,
  selectLiveSongs,
  selectLiveSongTitles,
} from '../../lib/admin/practice-chat-music-context.mjs';

const catalogue = {
  fc_song_a: { title: 'Ho Hey', artist: 'The Lumineers', instruments: ['Guitar'] },
  fc_song_b: { title: 'Sweet Home Chicago', artist: 'Robert Johnson', instruments: ['Guitar'] },
  fc_song_c: { title: 'Green Onions', artist: 'Booker T', instruments: ['Bass'] },
  fc_song_d: { title: 'Stand By Me', artist: 'Ben E. King', instruments: ['Guitar'] },
};

const assignments = [
  { songId: 'fc_song_a', status: 'working' },
  { songId: 'fc_song_b', status: 'assigned' },
  { songId: 'fc_song_d', status: 'done' },
];

test('selects only songs currently in front of the student', () => {
  const titles = selectLiveSongTitles({ assignments, catalogue });

  assert.deepEqual(titles, ['Ho Hey', 'Sweet Home Chicago']);
  assert.ok(!titles.includes('Stand By Me'), 'finished songs are not this lesson');
});

test('returns stable live song objects for Practice Note links', () => {
  assert.deepEqual(selectLiveSongs({ assignments, catalogue }), [
    { songId: 'fc_song_a', title: 'Ho Hey', status: 'working' },
    { songId: 'fc_song_b', title: 'Sweet Home Chicago', status: 'assigned' },
  ]);
});

test('validates selected note songs against the canonical catalogue', () => {
  assert.deepEqual(resolveSelectedPracticeNoteSongs({
    songIds: ['fc_song_b', 'fc_song_a'],
    assignments,
    catalogue,
  }), {
    songIds: ['fc_song_b', 'fc_song_a'],
    songTitles: ['Sweet Home Chicago', 'Ho Hey'],
    errors: [],
  });

  assert.deepEqual(resolveSelectedPracticeNoteSongs({
    songIds: ['fc_song_d'],
    assignments,
    catalogue,
  }), {
    songIds: ['fc_song_d'],
    songTitles: ['Stand By Me'],
    errors: [],
  });

  const invalid = resolveSelectedPracticeNoteSongs({
    songIds: ['fc_song_missing'],
    catalogue,
  });
  assert.deepEqual(invalid.songIds, []);
  assert.match(invalid.errors[0], /not in the First Chord catalogue/u);

  const tooMany = resolveSelectedPracticeNoteSongs({
    songIds: Array.from({ length: 13 }, (_, index) => `song_${index}`),
    assignments,
    catalogue,
  });
  assert.deepEqual(tooMany.songIds, []);
  assert.match(tooMany.errors[0], /no more than 12/u);
});

test('returns bounded catalogue metadata for deliberate tutor search', () => {
  assert.deepEqual(selectCatalogueSongs({ catalogue }), [
    { songId: 'fc_song_c', title: 'Green Onions', artist: 'Booker T', contentType: 'song' },
    { songId: 'fc_song_a', title: 'Ho Hey', artist: 'The Lumineers', contentType: 'song' },
    { songId: 'fc_song_d', title: 'Stand By Me', artist: 'Ben E. King', contentType: 'song' },
    { songId: 'fc_song_b', title: 'Sweet Home Chicago', artist: 'Robert Johnson', contentType: 'song' },
  ]);
});

test('keeps bounded unlisted titles as observations', () => {
  assert.deepEqual(resolveUnlistedPracticeNoteSongs({
    titles: [' Tutor original ', 'Tutor original', 'New warm-up'],
  }), {
    titles: ['Tutor original', 'New warm-up'],
    errors: [],
  });
  assert.match(resolveUnlistedPracticeNoteSongs({
    titles: Array.from({ length: 7 }, (_, index) => `Song ${index}`),
  }).errors[0], /no more than 6/u);
});

test('excludes parked songs', () => {
  const titles = selectLiveSongTitles({
    assignments: [{ songId: 'fc_song_a', status: 'parked' }],
    catalogue,
  });

  assert.deepEqual(titles, []);
});

test('includes ready songs alongside assigned and working', () => {
  const titles = selectLiveSongTitles({
    assignments: [{ songId: 'fc_song_a', status: 'ready' }],
    catalogue,
  });

  assert.deepEqual(titles, ['Ho Hey']);
});

test('skips unknown song ids rather than guessing', () => {
  const titles = selectLiveSongTitles({
    assignments: [
      { songId: 'fc_song_missing', status: 'working' },
      { songId: 'fc_song_a', status: 'working' },
    ],
    catalogue,
  });

  assert.deepEqual(titles, ['Ho Hey']);
});

test('deduplicates repeated titles', () => {
  const titles = selectLiveSongTitles({
    assignments: [
      { songId: 'fc_song_a', status: 'working' },
      { songId: 'fc_song_a', status: 'assigned' },
    ],
    catalogue,
  });

  assert.deepEqual(titles, ['Ho Hey']);
});

test('caps the song list so a long shelf cannot crowd out the prompt', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ songId: `s${i}`, status: 'working' }));
  const bigCatalogue = Object.fromEntries(
    many.map((entry, i) => [entry.songId, { title: `Song ${i}`, instruments: ['Guitar'] }])
  );

  const titles = selectLiveSongTitles({ assignments: many, catalogue: bigCatalogue });
  assert.equal(titles.length, 12);
});

test('infers the instrument from the live shelf', () => {
  assert.equal(inferInstrument({ assignments, catalogue }), 'Guitar');
});

test('infers nothing from an empty shelf', () => {
  assert.equal(inferInstrument({ assignments: [], catalogue }), '');
});

test('prompt names the instrument and the songs', () => {
  const prompt = buildTranscriptionPrompt({
    instrument: 'Guitar',
    songTitles: ['Ho Hey', 'Sweet Home Chicago'],
  });

  assert.match(prompt, /Guitar/);
  assert.match(prompt, /Ho Hey/);
  assert.match(prompt, /Sweet Home Chicago/);
  assert.match(prompt, /Mixolydian/);
});

test('prompt is empty when there is nothing useful to say', () => {
  assert.equal(buildTranscriptionPrompt({ instrument: '', songTitles: [] }), '');
});

test('prompt survives a shelf with songs but no clear instrument', () => {
  const prompt = buildTranscriptionPrompt({ instrument: '', songTitles: ['Ho Hey'] });
  assert.match(prompt, /Ho Hey/);
});

test('full context bundles instrument, titles, and prompt', () => {
  const context = buildPracticeChatMusicContext({ assignments, catalogue });

  assert.equal(context.instrument, 'Guitar');
  assert.deepEqual(context.songs, [
    { songId: 'fc_song_a', title: 'Ho Hey', status: 'working' },
    { songId: 'fc_song_b', title: 'Sweet Home Chicago', status: 'assigned' },
  ]);
  assert.equal(context.catalogueSongs.length, 4);
  assert.deepEqual(context.songTitles, ['Ho Hey', 'Sweet Home Chicago']);
  assert.match(context.prompt, /Sweet Home Chicago/);
});

test('full context on an empty shelf sends no prompt at all', () => {
  const context = buildPracticeChatMusicContext({ assignments: [], catalogue });

  assert.equal(context.prompt, '');
  assert.deepEqual(context.songTitles, []);
});

test('prompt contains no student name or identifier', () => {
  const context = buildPracticeChatMusicContext({ assignments, catalogue });

  assert.ok(!/sdt_/.test(context.prompt));
  assert.ok(!/student/i.test(context.prompt.replace(/The student plays/i, '')));
});
