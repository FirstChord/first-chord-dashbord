import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ASSIGNMENT_STATUSES,
  buildAssignmentId,
  buildAssignmentUpsert,
  buildAssignmentUpdate,
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

function sequenceRows() {
  // Three songs for sdt_abc (orders 1..3) plus another student's row.
  return [
    { assignmentId: 'sdt_abc_fc_song_a', mmsId: 'sdt_abc', songId: 'fc_song_a', status: 'working', sortOrder: '1', assignedAt: '2026-07-01T09:00:00.000Z' },
    { assignmentId: 'sdt_abc_fc_song_b', mmsId: 'sdt_abc', songId: 'fc_song_b', status: 'assigned', sortOrder: '2', assignedAt: '2026-07-02T09:00:00.000Z' },
    { assignmentId: 'sdt_abc_fc_song_c', mmsId: 'sdt_abc', songId: 'fc_song_c', status: 'assigned', sortOrder: '3', assignedAt: '2026-07-03T09:00:00.000Z' },
    { assignmentId: 'sdt_other_fc_song_a', mmsId: 'sdt_other', songId: 'fc_song_a', status: 'assigned', sortOrder: '1', assignedAt: '2026-07-01T09:00:00.000Z' },
  ];
}

test('status change updates only the target row', () => {
  const { rows, error } = buildAssignmentUpdate({
    mmsId: 'sdt_abc',
    songId: 'fc_song_b',
    status: 'done',
    existingRows: sequenceRows(),
    now: NOW,
  });
  assert.equal(error, undefined);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].assignmentId, 'sdt_abc_fc_song_b');
  assert.equal(rows[0].status, 'done');
  assert.equal(rows[0].updatedAt, NOW.toISOString());
});

test('status change is a no-op when already in that status', () => {
  const { rows } = buildAssignmentUpdate({
    mmsId: 'sdt_abc',
    songId: 'fc_song_a',
    status: 'working',
    existingRows: sequenceRows(),
    now: NOW,
  });
  assert.deepEqual(rows, []);
});

test('rejects unknown statuses, unknown assignments, and ambiguous updates', () => {
  assert.equal(
    buildAssignmentUpdate({ mmsId: 'sdt_abc', songId: 'fc_song_a', status: 'finished', existingRows: sequenceRows() }).error,
    'invalid_status'
  );
  assert.equal(
    buildAssignmentUpdate({ mmsId: 'sdt_abc', songId: 'fc_song_nope', status: 'done', existingRows: sequenceRows() }).error,
    'unknown_assignment'
  );
  assert.equal(
    buildAssignmentUpdate({ mmsId: 'sdt_abc', songId: 'fc_song_a', status: 'done', direction: 'up', existingRows: sequenceRows() }).error,
    'invalid_update'
  );
  assert.equal(
    buildAssignmentUpdate({ mmsId: 'sdt_abc', songId: 'fc_song_a', existingRows: sequenceRows() }).error,
    'invalid_update'
  );
});

test('reorder down swaps with the next row only for this student', () => {
  const { rows } = buildAssignmentUpdate({
    mmsId: 'sdt_abc',
    songId: 'fc_song_a',
    direction: 'down',
    existingRows: sequenceRows(),
    now: NOW,
  });
  const byId = Object.fromEntries(rows.map((r) => [r.assignmentId, r.sortOrder]));
  assert.deepEqual(byId, { sdt_abc_fc_song_a: 2, sdt_abc_fc_song_b: 1 });
});

test('reorder at the edge is a no-op', () => {
  const up = buildAssignmentUpdate({
    mmsId: 'sdt_abc', songId: 'fc_song_a', direction: 'up', existingRows: sequenceRows(), now: NOW,
  });
  assert.deepEqual(up.rows, []);
  const down = buildAssignmentUpdate({
    mmsId: 'sdt_abc', songId: 'fc_song_c', direction: 'down', existingRows: sequenceRows(), now: NOW,
  });
  assert.deepEqual(down.rows, []);
});

test('reorder skips parked neighbours and normalises messy sort orders', () => {
  const rows = sequenceRows();
  rows[1].status = 'parked'; // fc_song_b parked between a and c
  rows[2].sortOrder = '9'; // messy order gets normalised to 1..n
  const result = buildAssignmentUpdate({
    mmsId: 'sdt_abc',
    songId: 'fc_song_c',
    direction: 'up',
    existingRows: rows,
    now: NOW,
  });
  const byId = Object.fromEntries(result.rows.map((r) => [r.assignmentId, r.sortOrder]));
  // c jumps over parked b to swap with a; b keeps its normalised slot.
  assert.equal(byId.sdt_abc_fc_song_a, 3);
  assert.equal(byId.sdt_abc_fc_song_c, 1);
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
