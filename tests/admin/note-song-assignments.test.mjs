import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAssignmentUpsert,
  buildNoteSongAssignments,
} from '../../lib/songs/assignment-helpers.mjs';

const catalogue = {
  fc_song_a: { title: 'Song A', artist: 'A', instruments: ['Guitar'], level: 'Debut' },
  fc_song_b: { title: 'Song B', artist: 'B', instruments: ['Guitar'], level: 'Debut' },
};

const existing = (overrides = {}) => ({
  assignmentId: 'sdt_a_fc_song_a',
  mmsId: 'sdt_a',
  songId: 'fc_song_a',
  status: 'assigned',
  sortOrder: 1,
  assignedBy: 'Finn',
  assignedAt: '2026-07-01T00:00:00.000Z',
  assignedVia: 'shelf',
  ...overrides,
});

test('a note link creates a shelf row for a song the student lacks', () => {
  const { rows } = buildNoteSongAssignments({
    mmsId: 'sdt_a',
    songIds: ['fc_song_a'],
    assignedBy: 'Tom',
    existingRows: [],
    catalogue,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].songId, 'fc_song_a');
  assert.equal(rows[0].assignedBy, 'Tom');
  assert.equal(rows[0].assignedVia, 'note');
  // Born working: the note is evidence it was in front of the student today.
  assert.equal(rows[0].status, 'working');
});

test('a song the student already has is left completely alone', () => {
  const { rows } = buildNoteSongAssignments({
    mmsId: 'sdt_a',
    songIds: ['fc_song_a'],
    assignedBy: 'Tom',
    existingRows: [existing()],
    catalogue,
  });

  assert.deepEqual(rows, []);
});

test('naming a finished song in a note does not reopen it', () => {
  const { rows } = buildNoteSongAssignments({
    mmsId: 'sdt_a',
    songIds: ['fc_song_a'],
    assignedBy: 'Tom',
    existingRows: [existing({ status: 'done' })],
    catalogue,
  });

  assert.deepEqual(rows, []);
});

test('a parked song named in a note stays parked', () => {
  const { rows } = buildNoteSongAssignments({
    mmsId: 'sdt_a',
    songIds: ['fc_song_a'],
    assignedBy: 'Tom',
    existingRows: [existing({ status: 'parked' })],
    catalogue,
  });

  assert.deepEqual(rows, []);
});

test('two new songs in one note get distinct sort orders', () => {
  const { rows } = buildNoteSongAssignments({
    mmsId: 'sdt_a',
    songIds: ['fc_song_a', 'fc_song_b'],
    assignedBy: 'Tom',
    existingRows: [],
    catalogue,
  });

  assert.deepEqual(rows.map((row) => row.sortOrder), [1, 2]);
});

test('new songs append after an existing shelf rather than colliding with it', () => {
  const { rows } = buildNoteSongAssignments({
    mmsId: 'sdt_a',
    songIds: ['fc_song_b'],
    assignedBy: 'Tom',
    existingRows: [existing({ sortOrder: 4 })],
    catalogue,
  });

  assert.equal(rows[0].sortOrder, 5);
});

test('an unknown song id is skipped, never fatal', () => {
  const { rows } = buildNoteSongAssignments({
    mmsId: 'sdt_a',
    songIds: ['fc_song_not_real', 'fc_song_a'],
    assignedBy: 'Tom',
    existingRows: [],
    catalogue,
  });

  assert.deepEqual(rows.map((row) => row.songId), ['fc_song_a']);
});

test('a repeated id in one note creates one row', () => {
  const { rows } = buildNoteSongAssignments({
    mmsId: 'sdt_a',
    songIds: ['fc_song_a', 'fc_song_a'],
    assignedBy: 'Tom',
    existingRows: [],
    catalogue,
  });

  assert.equal(rows.length, 1);
});

test('an invalid student id yields nothing rather than a bad row', () => {
  const { rows } = buildNoteSongAssignments({
    mmsId: 'not-an-mms-id',
    songIds: ['fc_song_a'],
    assignedBy: 'Tom',
    existingRows: [],
    catalogue,
  });

  assert.deepEqual(rows, []);
});

test('shelf assignments still default to assigned and record their own door', () => {
  const { row } = buildAssignmentUpsert({
    mmsId: 'sdt_a',
    songId: 'fc_song_a',
    assignedBy: 'Finn',
    existingRows: [],
    catalogue,
  });

  assert.equal(row.status, 'assigned');
  assert.equal(row.assignedVia, 'shelf');
});

test('re-assigning from the shelf never rewrites how a row was born', () => {
  const { row } = buildAssignmentUpsert({
    mmsId: 'sdt_a',
    songId: 'fc_song_a',
    assignedBy: 'Finn',
    existingRows: [existing({ assignedVia: 'note' })],
    catalogue,
  });

  assert.equal(row.assignedVia, 'note');
});
