import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSIGNMENT_STATUSES,
  buildAssignmentId,
  buildAssignmentUpsert,
} from '../../lib/songs/assignment-helpers.mjs';

const CATALOGUE = {
  fc_song_ho_hey: { title: 'Ho Hey' },
  fc_song_yellow: { title: 'Yellow' },
};
const NOW = new Date('2026-07-12T10:00:00.000Z');

test('status vocabulary is fixed', () => {
  assert.deepEqual(ASSIGNMENT_STATUSES, ['assigned', 'working', 'ready', 'done', 'parked']);
});

test('assignment ids are deterministic', () => {
  assert.equal(buildAssignmentId('sdt_abc', 'fc_song_ho_hey'), 'sdt_abc_fc_song_ho_hey');
});

test('creates a new assignment with defaults and next sort order', () => {
  const existingRows = [
    { assignmentId: 'sdt_abc_fc_song_yellow', mmsId: 'sdt_abc', sortOrder: '3' },
    { assignmentId: 'sdt_other_fc_song_yellow', mmsId: 'sdt_other', sortOrder: '9' },
  ];
  const { row, created, error } = buildAssignmentUpsert({
    mmsId: 'sdt_abc',
    songId: 'fc_song_ho_hey',
    assignedBy: 'Finn',
    existingRows,
    catalogue: CATALOGUE,
    now: NOW,
  });
  assert.equal(error, undefined);
  assert.equal(created, true);
  assert.equal(row.assignmentId, 'sdt_abc_fc_song_ho_hey');
  assert.equal(row.songTitle, 'Ho Hey');
  assert.equal(row.assignedBy, 'Finn');
  assert.equal(row.status, 'assigned');
  assert.equal(row.sortOrder, 4); // after this student's max (3), ignoring other students
  assert.equal(row.assignedAt, NOW.toISOString());
  assert.equal(row.updatedAt, NOW.toISOString());
});

test('re-assigning is an idempotent upsert that preserves history fields', () => {
  const existing = {
    assignmentId: 'sdt_abc_fc_song_ho_hey',
    mmsId: 'sdt_abc',
    songId: 'fc_song_ho_hey',
    assignedBy: 'Dean',
    assignedAt: '2026-07-01T09:00:00.000Z',
    status: 'working',
    sortOrder: '2',
    pathId: 'path_x',
    stepLabel: '01 riff',
    tutorNoteOverride: 'slow it down',
  };
  const { row, created } = buildAssignmentUpsert({
    mmsId: 'sdt_abc',
    songId: 'fc_song_ho_hey',
    assignedBy: 'Finn',
    existingRows: [existing],
    catalogue: CATALOGUE,
    now: NOW,
  });
  assert.equal(created, false);
  assert.equal(row.assignedBy, 'Dean'); // original assigner kept
  assert.equal(row.assignedAt, '2026-07-01T09:00:00.000Z');
  assert.equal(row.status, 'working'); // progress never reset by re-assign
  assert.equal(row.sortOrder, '2');
  assert.equal(row.pathId, 'path_x');
  assert.equal(row.tutorNoteOverride, 'slow it down');
  assert.equal(row.updatedAt, NOW.toISOString());
});

test('rejects unknown songs and malformed student ids', () => {
  assert.equal(
    buildAssignmentUpsert({ mmsId: 'sdt_abc', songId: 'fc_song_nope', catalogue: CATALOGUE }).error,
    'unknown_song'
  );
  assert.equal(
    buildAssignmentUpsert({ mmsId: 'not-an-id', songId: 'fc_song_ho_hey', catalogue: CATALOGUE }).error,
    'invalid_student_id'
  );
  assert.equal(
    buildAssignmentUpsert({ mmsId: '', songId: 'fc_song_ho_hey', catalogue: CATALOGUE }).error,
    'invalid_student_id'
  );
});

test('works against the real catalogue', () => {
  const { row, error } = buildAssignmentUpsert({
    mmsId: 'sdt_tstJ00',
    songId: 'fc_song_seven_nation_army',
    assignedBy: 'Finn',
    now: NOW,
  });
  assert.equal(error, undefined);
  assert.equal(row.songTitle, 'Seven Nation Army');
});
