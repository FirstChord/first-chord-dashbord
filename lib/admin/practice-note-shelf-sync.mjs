import {
  appendSongStatusLogRows,
  getSongAssignmentRows,
  upsertSongAssignmentRow,
} from './sheets.js';
import { buildNoteSongAssignments } from '../songs/assignment-helpers.mjs';
import { buildStatusLogEntries } from '../songs/outcome-helpers.mjs';

/**
 * Puts the songs a tutor confirmed in a Practice Note onto that student's
 * shelf, for songs they do not already have.
 *
 * Runs as a side effect of saving a note and is **best-effort throughout**: the
 * note is the record that matters, and no shelf problem may cost a tutor the
 * note they just spent a lesson making. Every failure is logged and swallowed.
 *
 * `assignedBy` here is the note's self-attested tutor name, not a verified
 * identity — the Practice Chat route is guarded by a shared app secret rather
 * than a per-tutor token. That is why the rows are stamped `assigned_via =
 * note`: the weaker guarantee stays visible in the data instead of being
 * blurred into rows the Song Browser wrote from a verified token.
 */
export async function syncNoteSongsToShelf({
  studentMmsId = '',
  songIds = [],
  tutorName = '',
} = {}) {
  const mmsId = `${studentMmsId || ''}`.trim();
  const ids = (Array.isArray(songIds) ? songIds : []).filter(Boolean);
  if (!mmsId || !ids.length) return { created: 0 };

  try {
    const existingRows = await getSongAssignmentRows(mmsId);
    const { rows } = buildNoteSongAssignments({
      mmsId,
      songIds: ids,
      assignedBy: `${tutorName || ''}`.trim(),
      existingRows,
    });
    if (!rows.length) return { created: 0 };

    for (const row of rows) {
      await upsertSongAssignmentRow(row);
    }

    // Same telemetry a shelf assignment produces, so the status log does not
    // develop a blind spot for songs that arrived through a note.
    try {
      await appendSongStatusLogRows(
        buildStatusLogEntries({
          previousRows: existingRows,
          changedRows: rows,
          changedBy: `${tutorName || ''}`.trim(),
        }),
      );
    } catch (error) {
      console.error('Note-to-shelf status log append failed:', error.message);
    }

    return { created: rows.length };
  } catch (error) {
    console.error('Note-to-shelf sync failed; the note is unaffected:', error.message);
    return { created: 0 };
  }
}
