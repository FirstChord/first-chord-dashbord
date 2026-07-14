import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPathProgress,
  inferStudentLevel,
  inferStudentSeries,
} from '../../lib/songs/shelf-helpers.mjs';

const SONGS = [
  { songId: 'fc_song_d1', title: 'D1', level: 'Debut' },
  { songId: 'fc_song_d2', title: 'D2', level: 'Debut' },
  { songId: 'fc_song_g1a', title: 'G1a', level: 'Grade 1' },
  { songId: 'fc_song_g1b', title: 'G1b', level: 'Grade 1' },
  { songId: 'fc_song_g2a', title: 'G2a', level: 'Grade 2' },
];

// A piano student's catalogue spans two series with different vocabularies.
const MIXED = [
  ...SONGS,
  { songId: 'fc_song_jt1', title: 'JT1', level: 'Book 1', series: 'john_thompson' },
  { songId: 'fc_song_jt2', title: 'JT2', level: 'Book 2', series: 'john_thompson' },
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

test('levels are inferred within a series, never across them', () => {
  // Assigned Grade 2 (RSL) and Book 1 (John Thompson): each series answers for itself.
  const assignments = [{ songId: 'fc_song_g2a' }, { songId: 'fc_song_jt1' }];
  assert.equal(inferStudentLevel(assignments, MIXED, 'rsl'), 'Grade 2');
  assert.equal(inferStudentLevel(assignments, MIXED, 'john_thompson'), 'Book 1');
  // A student with no John Thompson assignments starts at that course's first book.
  assert.equal(inferStudentLevel([{ songId: 'fc_song_g2a' }], MIXED, 'john_thompson'), 'Book 1');
});

test('the opening series is the one the student is actually working in', () => {
  assert.equal(
    inferStudentSeries([{ songId: 'fc_song_jt1' }, { songId: 'fc_song_jt2' }], MIXED),
    'john_thompson'
  );
  assert.equal(inferStudentSeries([{ songId: 'fc_song_g1a' }], MIXED), 'rsl');
  // No assignments yet: fall back to the first series that has songs.
  assert.equal(inferStudentSeries([], MIXED), 'rsl');
  assert.equal(inferStudentSeries([], []), null);
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
