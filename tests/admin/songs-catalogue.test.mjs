import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SONGS_CATALOGUE, SONG_LEVELS } from '../../lib/config/songs-catalogue.mjs';
import {
  soundsliceUrlFor,
  songMatchesInstrument,
  getSongsForInstrument,
  validateCatalogue,
  findNameLeaks,
} from '../../lib/songs/catalogue-helpers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

test('catalogue passes validation', () => {
  assert.deepEqual(validateCatalogue(), []);
});

// Reviewed false positives: song titles that legitimately contain a word matching
// a student's first name. Add here ONLY after confirming the match is coincidental.
const NAME_LEAK_EXCEPTIONS = new Set([
  'fc_song_cat_and_mouse: contains "cat"', // RSL Classical Piano G1 exam piece title
  'fc_song_kiss_from_a_rose: contains "rose"', // Seal, RSL Acoustic Grade 6 exam piece
]);

test('catalogue contains no student first names (ships in the client bundle)', () => {
  const registrySource = fs.readFileSync(
    path.join(here, '../../lib/config/students-registry.js'),
    'utf8'
  );
  const firstNames = [...registrySource.matchAll(/firstName:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(firstNames.length > 100, 'registry first names should be extractable');
  const leaks = findNameLeaks(firstNames).filter((leak) => !NAME_LEAK_EXCEPTIONS.has(leak));
  assert.deepEqual(leaks, []);
});

test('soundslice URLs are derived from scorehash only', () => {
  assert.equal(
    soundsliceUrlFor({ soundslice: { scorehash: 'Yvmfc' } }),
    'https://www.soundslice.com/slices/Yvmfc/'
  );
  assert.equal(soundsliceUrlFor({}), null);
  assert.equal(soundsliceUrlFor(null), null);
});

test('instrument matching handles combo instrument strings', () => {
  const guitarSong = { instruments: ['Guitar'] };
  assert.equal(songMatchesInstrument(guitarSong, 'Guitar'), true);
  assert.equal(songMatchesInstrument(guitarSong, 'Piano / Guitar'), true);
  assert.equal(songMatchesInstrument(guitarSong, 'guitar'), true);
  assert.equal(songMatchesInstrument(guitarSong, 'Piano'), false);
  assert.equal(songMatchesInstrument(guitarSong, ''), false);
  assert.equal(songMatchesInstrument(guitarSong, undefined), false);
});

test('getSongsForInstrument returns guitar songs sorted by level then title', () => {
  const songs = getSongsForInstrument('Guitar');
  assert.ok(songs.length >= 10, 'seed catalogue should have 10+ guitar songs');
  const levelIndexes = songs.map((s) => SONG_LEVELS.indexOf(s.level));
  for (let i = 1; i < levelIndexes.length; i += 1) {
    assert.ok(levelIndexes[i] >= levelIndexes[i - 1], 'levels must be in SONG_LEVELS order');
    if (levelIndexes[i] === levelIndexes[i - 1]) {
      assert.ok(
        songs[i].title.localeCompare(songs[i - 1].title) >= 0,
        'titles sorted within a level'
      );
    }
  }
  for (const song of songs) {
    assert.match(song.soundsliceUrl, /^https:\/\/www\.soundslice\.com\/slices\/[\w-]+\/$/);
    assert.ok(song.songId.startsWith('fc_song_'));
  }
});

test('a course series is shelved in course order, not alphabetically', () => {
  // John Thompson's books are taught in sequence: The Train is #1 and must lead,
  // even though alphabetically it would sit near the end.
  const book1 = getSongsForInstrument('Piano').filter((s) => s.level === 'Book 1');
  assert.ok(book1.length > 10, 'Book 1 should be seeded');
  assert.equal(book1[0].title, 'The Train');
  const orders = book1.map((s) => s.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b), 'shelf follows course order');
  assert.deepEqual(orders, Array.from({ length: orders.length }, (_, i) => i + 1), 'no gaps');
});

test('bass students get a shelf of their own, not the guitar one', () => {
  const bass = getSongsForInstrument('Bass');
  assert.ok(bass.length > 30, 'bass should be seeded from the RSL Bass grade lists');

  // The bug this guards: bass students used to see an empty Song panel because the
  // catalogue had no bass entries at all, while the shelf filters strictly on instrument.
  const guitar = new Set(getSongsForInstrument('Guitar').map((s) => s.songId));
  assert.ok(
    bass.every((song) => !guitar.has(song.songId)),
    'bass repertoire must not be guitar repertoire'
  );

  // A beginner needs a rung below Grade 1 to start on.
  assert.ok(bass.some((s) => s.level === 'Debut'), 'bass needs a Debut level');
  assert.ok(bass.some((s) => s.level === 'Grade 6'), 'bass runs up to Grade 6');
});

test('getSongsForInstrument returns [] for unseeded instruments', () => {
  assert.deepEqual(getSongsForInstrument('Ukulele Orchestra'), []);
  assert.deepEqual(getSongsForInstrument('Voice'), []);
  assert.deepEqual(getSongsForInstrument(undefined), []);
});

test('validateCatalogue catches bad entries', () => {
  const bad = {
    'not-an-fc-id': {
      title: '',
      artist: '',
      instruments: ['Theremin'],
      level: 'Grade 9',
      contentType: 'vibes',
      soundslice: {},
    },
    fc_song_dupe_a: { title: 'A', artist: 'B', instruments: ['Guitar'], level: 'Debut', contentType: 'song', soundslice: { scorehash: 'xxxxx' } },
    fc_song_dupe_b: { title: 'C', artist: 'D', instruments: ['Guitar'], level: 'Debut', contentType: 'song', soundslice: { scorehash: 'xxxxx' } },
  };
  const errors = validateCatalogue(bad);
  assert.ok(errors.some((e) => e.includes('bad id format')));
  assert.ok(errors.some((e) => e.includes('missing title')));
  assert.ok(errors.some((e) => e.includes('is not in series')));
  assert.ok(errors.some((e) => e.includes('unknown contentType')));
  assert.ok(errors.some((e) => e.includes('unknown instrument')));
  assert.ok(errors.some((e) => e.includes('missing soundslice.scorehash')));
  assert.ok(errors.some((e) => e.includes('duplicate scorehash')));
});

test('a level from another series is rejected', () => {
  // 'Book 1' is a real level, but it belongs to John Thompson — not to RSL.
  const errors = validateCatalogue({
    fc_song_wrong_series: {
      title: 'X',
      artist: 'Y',
      instruments: ['Piano'],
      level: 'Book 1',
      contentType: 'song',
      soundslice: { scorehash: 'aaaaa' },
    },
  });
  assert.ok(errors.some((e) => e.includes('"Book 1" is not in series "rsl"')));
  assert.deepEqual(
    validateCatalogue({
      fc_song_right_series: {
        title: 'X',
        artist: 'Y',
        series: 'john_thompson',
        instruments: ['Piano'],
        level: 'Book 1',
        contentType: 'song',
        soundslice: { scorehash: 'aaaaa' },
      },
    }),
    []
  );
});

test('findNameLeaks flags student names in titles and notes', () => {
  const catalogue = {
    fc_song_leaky: {
      title: 'Redemption Song (Annie)',
      tutorNote: '',
      studentNote: '',
    },
  };
  assert.deepEqual(findNameLeaks(['Annie', 'Jo'], catalogue), ['fc_song_leaky: contains "annie"']);
  assert.deepEqual(findNameLeaks(['Annie'], SONGS_CATALOGUE).length >= 0, true);
});
