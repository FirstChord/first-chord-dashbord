import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPathProgress, buildShelf, inferStudentLevel } from '../../lib/songs/shelf-helpers.mjs';

const SONGS = [
  { songId: 'fc_song_d1', title: 'D1', level: 'Debut' },
  { songId: 'fc_song_d2', title: 'D2', level: 'Debut' },
  { songId: 'fc_song_g1a', title: 'G1a', level: 'Grade 1' },
  { songId: 'fc_song_g1b', title: 'G1b', level: 'Grade 1' },
  { songId: 'fc_song_g2a', title: 'G2a', level: 'Grade 2' },
];

test('level is the highest assigned level, falling back to the lowest available', () => {
  assert.equal(inferStudentLevel([{ songId: 'fc_song_g1a' }], SONGS), 'Grade 1');
  assert.equal(
    inferStudentLevel([{ songId: 'fc_song_d1' }, { songId: 'fc_song_g2a' }], SONGS),
    'Grade 2'
  );
  assert.equal(inferStudentLevel([], SONGS), 'Debut');
  assert.equal(inferStudentLevel([], []), null);
});

test('shelf offers unassigned songs at level, topping up from the next level', () => {
  const { level, candidates } = buildShelf(
    [{ songId: 'fc_song_g1a', status: 'working' }],
    SONGS,
    { limit: 3 }
  );
  assert.equal(level, 'Grade 1');
  assert.deepEqual(candidates.map((s) => s.songId), ['fc_song_g1b', 'fc_song_g2a']);
});

test('new student shelf starts at the lowest level', () => {
  const { level, candidates } = buildShelf([], SONGS, { limit: 2 });
  assert.equal(level, 'Debut');
  assert.deepEqual(candidates.map((s) => s.songId), ['fc_song_d1', 'fc_song_d2']);
});

test('path progress reports steps, statuses, and the current position', () => {
  const templates = {
    fc_path_x: { name: 'Path X', instrument: 'Guitar', level: 'Debut', steps: ['fc_song_d1', 'fc_song_d2', 'fc_song_g1a'] },
  };
  const assignments = [
    { songId: 'fc_song_d1', pathId: 'fc_path_x', status: 'done' },
    { songId: 'fc_song_d2', pathId: 'fc_path_x', status: 'working' },
    { songId: 'fc_song_g1a', pathId: 'fc_path_x', status: 'assigned' },
    { songId: 'fc_song_g2a', pathId: '', status: 'assigned' },
  ];
  const progress = buildPathProgress(assignments, templates);
  assert.equal(progress.name, 'Path X');
  assert.equal(progress.position, 2);
  assert.deepEqual(progress.steps.map((s) => s.status), ['done', 'working', 'assigned']);
});

test('no path assigned means no progress strip', () => {
  assert.equal(buildPathProgress([{ songId: 'fc_song_d1', pathId: '' }], {}), null);
  assert.equal(buildPathProgress([], {}), null);
});
