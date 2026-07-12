// Pure helpers for song assignments (Song_Assignments sheet rows).
// Status vocabulary is fixed here; buildAssignmentUpdate is the slice-4
// transitions/ordering logic (the API route just persists what it returns).
import { SONGS_CATALOGUE } from '../config/songs-catalogue.mjs';

export const ASSIGNMENT_STATUSES = ['assigned', 'working', 'ready', 'done', 'parked'];

export function buildAssignmentId(mmsId, songId) {
  return `${mmsId}_${songId}`;
}

// Validates an assign request and returns the row to upsert, or { error }.
// assignedBy comes from the VERIFIED token payload, never the request body.
export function buildAssignmentUpsert({
  mmsId = '',
  songId = '',
  assignedBy = '',
  existingRows = [],
  catalogue = SONGS_CATALOGUE,
  now = new Date(),
} = {}) {
  const cleanMmsId = `${mmsId}`.trim();
  const cleanSongId = `${songId}`.trim();

  if (!/^sdt_\w+$/.test(cleanMmsId)) {
    return { error: 'invalid_student_id' };
  }
  const song = catalogue[cleanSongId];
  if (!song) {
    return { error: 'unknown_song' };
  }

  const assignmentId = buildAssignmentId(cleanMmsId, cleanSongId);
  const existing = existingRows.find((row) => row.assignmentId === assignmentId);
  const timestamp = now.toISOString();
  const maxSortOrder = existingRows
    .filter((row) => row.mmsId === cleanMmsId)
    .reduce((max, row) => Math.max(max, Number(row.sortOrder) || 0), 0);

  return {
    row: {
      assignmentId,
      mmsId: cleanMmsId,
      songId: cleanSongId,
      songTitle: song.title,
      assignedBy: existing?.assignedBy || `${assignedBy}`.trim(),
      assignedAt: existing?.assignedAt || timestamp,
      status: existing?.status || 'assigned',
      sortOrder: existing?.sortOrder || maxSortOrder + 1,
      pathId: existing?.pathId || '',
      stepLabel: existing?.stepLabel || '',
      tutorNoteOverride: existing?.tutorNoteOverride || '',
      updatedAt: timestamp,
    },
    created: !existing,
  };
}

// Validates a status/reorder request and returns { rows } to upsert (possibly
// several, when sort orders need normalising), or { error }. Exactly one of
// `status` / `direction` must be given. Parked rows sit outside the sequence:
// they keep their sort_order but are skipped when stepping up/down.
export function buildAssignmentUpdate({
  mmsId = '',
  songId = '',
  status = '',
  direction = '',
  existingRows = [],
  now = new Date(),
} = {}) {
  const cleanMmsId = `${mmsId}`.trim();
  const cleanSongId = `${songId}`.trim();
  const assignmentId = buildAssignmentId(cleanMmsId, cleanSongId);
  const timestamp = now.toISOString();

  const target = existingRows.find((row) => row.assignmentId === assignmentId);
  if (!target) {
    return { error: 'unknown_assignment' };
  }

  if (status && direction) {
    return { error: 'invalid_update' };
  }

  if (status) {
    if (!ASSIGNMENT_STATUSES.includes(status)) {
      return { error: 'invalid_status' };
    }
    if (target.status === status) {
      return { rows: [] };
    }
    return { rows: [{ ...target, status, updatedAt: timestamp }] };
  }

  if (direction !== 'up' && direction !== 'down') {
    return { error: 'invalid_update' };
  }

  // Normalise the student's sequence to 1..n (stable by current sort_order,
  // then assigned_at), then swap the target with its non-parked neighbour.
  const sequence = existingRows
    .filter((row) => row.mmsId === cleanMmsId)
    .sort((a, b) =>
      (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
      || `${a.assignedAt}`.localeCompare(`${b.assignedAt}`)
    );

  const ordered = sequence.map((row, index) => ({ row, newOrder: index + 1 }));
  const targetIndex = ordered.findIndex((entry) => entry.row.assignmentId === assignmentId);

  const step = direction === 'up' ? -1 : 1;
  let neighbourIndex = targetIndex + step;
  while (
    neighbourIndex >= 0
    && neighbourIndex < ordered.length
    && ordered[neighbourIndex].row.status === 'parked'
  ) {
    neighbourIndex += step;
  }
  if (neighbourIndex < 0 || neighbourIndex >= ordered.length) {
    return { rows: [] };
  }

  const swap = ordered[targetIndex].newOrder;
  ordered[targetIndex].newOrder = ordered[neighbourIndex].newOrder;
  ordered[neighbourIndex].newOrder = swap;

  const rows = ordered
    .filter(({ row, newOrder }) => Number(row.sortOrder) !== newOrder)
    .map(({ row, newOrder }) => ({ ...row, sortOrder: newOrder, updatedAt: timestamp }));

  return { rows };
}
