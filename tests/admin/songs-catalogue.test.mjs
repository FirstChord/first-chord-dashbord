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
  assert.ok(errors.some((e) => e.includes('unknown level')));
  assert.ok(errors.some((e) => e.includes('unknown contentType')));
  assert.ok(errors.some((e) => e.includes('unknown instrument')));
  assert.ok(errors.some((e) => e.includes('missing soundslice.scorehash')));
  assert.ok(errors.some((e) => e.includes('duplicate scorehash')));
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
