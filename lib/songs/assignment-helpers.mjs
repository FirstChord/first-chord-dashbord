// Pure helpers for song assignments (Song_Assignments sheet rows).
// Status vocabulary is fixed here; slice 4 adds the transitions UI.
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
