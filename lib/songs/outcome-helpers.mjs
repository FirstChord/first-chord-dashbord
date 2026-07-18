// Pure helpers for the song-loop telemetry lane (Song_Status_Log and
// Song_Outcomes, both append-only). Status log rows are derived by diffing an
// assignment write; outcome rows are the tutor's optional one-tap answer at
// done/parked. Neither ever blocks or mutates the assignment itself.
import { randomUUID } from 'node:crypto';
import { buildAssignmentId } from './assignment-helpers.mjs';

export const SONG_OUTCOME_CHOICES = ['cruised', 'about_right', 'battle'];
// Statuses worth asking "how did it go?" about.
export const OUTCOME_PROMPT_STATUSES = ['done', 'parked'];
export const OUTCOME_NOTE_MAX_LENGTH = 300;

// Diffs an assignment write against the rows that existed before it and
// returns one log entry per real status transition. Rows that only changed
// sort order produce nothing; a row with no predecessor logs '' → status.
export function buildStatusLogEntries({
  previousRows = [],
  changedRows = [],
  changedBy = '',
  now = new Date(),
  makeId = randomUUID,
} = {}) {
  const previousById = new Map(previousRows.map((row) => [row.assignmentId, row]));
  const timestamp = now.toISOString();

  return changedRows
    .map((row) => ({ row, fromStatus: previousById.get(row.assignmentId)?.status || '' }))
    .filter(({ row, fromStatus }) => (row.status || '') !== fromStatus)
    .map(({ row, fromStatus }) => ({
      logId: `sl_${makeId()}`,
      assignmentId: row.assignmentId,
      mmsId: row.mmsId,
      songId: row.songId,
      fromStatus,
      toStatus: row.status || '',
      changedBy: `${changedBy}`.trim(),
      changedAt: timestamp,
    }));
}

// Validates an outcome submission against the student's assignments and
// returns the row to append, or { error }. At least one of outcome/note is
// required; recordedBy comes from the verified token payload, never the body.
export function buildSongOutcomeRow({
  mmsId = '',
  songId = '',
  outcome = '',
  note = '',
  recordedBy = '',
  existingRows = [],
  now = new Date(),
  makeId = randomUUID,
} = {}) {
  const cleanMmsId = `${mmsId}`.trim();
  const cleanSongId = `${songId}`.trim();
  const cleanOutcome = `${outcome}`.trim();
  const cleanNote = `${note}`.trim().slice(0, OUTCOME_NOTE_MAX_LENGTH);

  const assignmentId = buildAssignmentId(cleanMmsId, cleanSongId);
  const assignment = existingRows.find((row) => row.assignmentId === assignmentId);
  if (!assignment) {
    return { error: 'unknown_assignment' };
  }
  if (cleanOutcome && !SONG_OUTCOME_CHOICES.includes(cleanOutcome)) {
    return { error: 'invalid_outcome' };
  }
  if (!cleanOutcome && !cleanNote) {
    return { error: 'empty_outcome' };
  }

  return {
    row: {
      outcomeId: `so_${makeId()}`,
      assignmentId,
      mmsId: cleanMmsId,
      songId: cleanSongId,
      songTitle: assignment.songTitle || '',
      atStatus: assignment.status || '',
      outcome: cleanOutcome,
      note: cleanNote,
      recordedBy: `${recordedBy}`.trim(),
      recordedAt: now.toISOString(),
    },
  };
}
