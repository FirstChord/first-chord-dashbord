import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSongOutcomeRow,
  buildStatusLogEntries,
  OUTCOME_NOTE_MAX_LENGTH,
  SONG_OUTCOME_CHOICES,
} from '../../lib/songs/outcome-helpers.mjs';

const NOW = new Date('2026-07-18T10:00:00.000Z');
const makeId = () => 'fixed';

const ASSIGNMENT = {
  assignmentId: 'sdt_abc_fc_song_ho_hey',
  mmsId: 'sdt_abc',
  songId: 'fc_song_ho_hey',
  songTitle: 'Ho Hey',
  status: 'done',
};

test('outcome vocabulary is fixed', () => {
  assert.deepEqual(SONG_OUTCOME_CHOICES, ['cruised', 'about_right', 'battle']);
});

test('status log diffs real transitions only', () => {
  const previousRows = [
    { assignmentId: 'a1', mmsId: 'sdt_abc', songId: 's1', status: 'working', sortOrder: 1 },
    { assignmentId: 'a2', mmsId: 'sdt_abc', songId: 's2', status: 'assigned', sortOrder: 2 },
  ];
  const changedRows = [
    { assignmentId: 'a1', mmsId: 'sdt_abc', songId: 's1', status: 'done', sortOrder: 1 },
    // Reorder-only write: same status, must not produce a log row.
    { assignmentId: 'a2', mmsId: 'sdt_abc', songId: 's2', status: 'assigned', sortOrder: 3 },
    // Brand new assignment: logs '' -> assigned.
    { assignmentId: 'a3', mmsId: 'sdt_abc', songId: 's3', status: 'assigned', sortOrder: 4 },
  ];

  const entries = buildStatusLogEntries({
    previousRows,
    changedRows,
    changedBy: 'Finn',
    now: NOW,
    makeId,
  });

  assert.deepEqual(entries, [
    {
      logId: 'sl_fixed',
      assignmentId: 'a1',
      mmsId: 'sdt_abc',
      songId: 's1',
      fromStatus: 'working',
      toStatus: 'done',
      changedBy: 'Finn',
      changedAt: NOW.toISOString(),
    },
    {
      logId: 'sl_fixed',
      assignmentId: 'a3',
      mmsId: 'sdt_abc',
      songId: 's3',
      fromStatus: '',
      toStatus: 'assigned',
      changedBy: 'Finn',
      changedAt: NOW.toISOString(),
    },
  ]);
});

test('outcome row records the assignment context', () => {
  const { row, error } = buildSongOutcomeRow({
    mmsId: 'sdt_abc',
    songId: 'fc_song_ho_hey',
    outcome: 'battle',
    note: '  Barre chord in the bridge  ',
    recordedBy: 'Finn',
    existingRows: [ASSIGNMENT],
    now: NOW,
    makeId,
  });

  assert.equal(error, undefined);
  assert.deepEqual(row, {
    outcomeId: 'so_fixed',
    assignmentId: 'sdt_abc_fc_song_ho_hey',
    mmsId: 'sdt_abc',
    songId: 'fc_song_ho_hey',
    songTitle: 'Ho Hey',
    atStatus: 'done',
    outcome: 'battle',
    note: 'Barre chord in the bridge',
    recordedBy: 'Finn',
    recordedAt: NOW.toISOString(),
  });
});

test('note-only outcomes are allowed; empty submissions are not', () => {
  const noteOnly = buildSongOutcomeRow({
    mmsId: 'sdt_abc',
    songId: 'fc_song_ho_hey',
    note: 'Lost interest after week two',
    existingRows: [ASSIGNMENT],
    now: NOW,
    makeId,
  });
  assert.equal(noteOnly.error, undefined);
  assert.equal(noteOnly.row.outcome, '');

  const empty = buildSongOutcomeRow({
    mmsId: 'sdt_abc',
    songId: 'fc_song_ho_hey',
    existingRows: [ASSIGNMENT],
  });
  assert.equal(empty.error, 'empty_outcome');
});

test('rejects unknown assignments and unknown outcomes; caps note length', () => {
  const unknownAssignment = buildSongOutcomeRow({
    mmsId: 'sdt_abc',
    songId: 'fc_song_yellow',
    outcome: 'cruised',
    existingRows: [ASSIGNMENT],
  });
  assert.equal(unknownAssignment.error, 'unknown_assignment');

  const unknownOutcome = buildSongOutcomeRow({
    mmsId: 'sdt_abc',
    songId: 'fc_song_ho_hey',
    outcome: 'amazing',
    existingRows: [ASSIGNMENT],
  });
  assert.equal(unknownOutcome.error, 'invalid_outcome');

  const longNote = buildSongOutcomeRow({
    mmsId: 'sdt_abc',
    songId: 'fc_song_ho_hey',
    note: 'x'.repeat(OUTCOME_NOTE_MAX_LENGTH + 50),
    existingRows: [ASSIGNMENT],
    now: NOW,
    makeId,
  });
  assert.equal(longNote.row.note.length, OUTCOME_NOTE_MAX_LENGTH);
});
