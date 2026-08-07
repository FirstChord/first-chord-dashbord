// Pure helpers for song assignments (Song_Assignments sheet rows).
// Status vocabulary is fixed here; buildAssignmentUpdate is the slice-4
// transitions/ordering logic (the API route just persists what it returns).
import { SONGS_CATALOGUE } from '../config/songs-catalogue.mjs';
import { PATH_TEMPLATES } from '../config/path-templates.mjs';

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
  // `via` and `initialStatus` describe how a row is *born* and are ignored for
  // a song the student already has. An existing assignment's status is the
  // tutor's, and no amount of later evidence may quietly overwrite it.
  via = 'shelf',
  initialStatus = 'assigned',
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
      status: existing?.status || initialStatus,
      sortOrder: existing?.sortOrder || maxSortOrder + 1,
      pathId: existing?.pathId || '',
      stepLabel: existing?.stepLabel || '',
      tutorNoteOverride: existing?.tutorNoteOverride || '',
      updatedAt: timestamp,
      assignedVia: existing?.assignedVia || via,
    },
    created: !existing,
  };
}

// Instantiates a path template into assignment rows for one student.
// Each step reuses buildAssignmentUpsert (so existing assignments keep their
// history and re-instantiating is idempotent), then gains path_id and a
// step_label. New steps append to the student's sequence in template order;
// a song the student already had keeps its current position and status —
// the path adopts it rather than resetting it.
export function buildPathAssignments({
  mmsId = '',
  pathId = '',
  assignedBy = '',
  existingRows = [],
  templates = PATH_TEMPLATES,
  catalogue = SONGS_CATALOGUE,
  now = new Date(),
} = {}) {
  const template = templates[`${pathId}`.trim()];
  if (!template) {
    return { error: 'unknown_path' };
  }

  const rows = [];
  let createdCount = 0;
  const rowsSoFar = [...existingRows];
  for (const [index, songId] of template.steps.entries()) {
    const result = buildAssignmentUpsert({
      mmsId,
      songId,
      assignedBy,
      existingRows: rowsSoFar,
      catalogue,
      now,
    });
    if (result.error) {
      return { error: result.error, songId };
    }
    const row = {
      ...result.row,
      pathId: `${pathId}`.trim(),
      stepLabel: `${index + 1} of ${template.steps.length}`,
    };
    rows.push(row);
    const soFarIndex = rowsSoFar.findIndex((r) => r.assignmentId === row.assignmentId);
    if (soFarIndex >= 0) rowsSoFar[soFarIndex] = row;
    else rowsSoFar.push(row);
    if (result.created) createdCount += 1;
  }

  return { rows, createdCount };
}

// The songs a tutor confirmed in a Practice Note, turned into shelf rows.
//
// Until this existed the shelf fed the note (a student's assigned songs are the
// note's picker and its transcription prompt) but the note never fed the shelf,
// so a tutor saying "we worked on this" produced a link no shelf reflected —
// both of the first two linked notes named songs the student had never been
// assigned. Note-taking is the lower-friction capture path, so it has to be
// able to create the fact, not just reference one.
//
// Two deliberate limits:
//   - **Create only.** A song the student already has keeps its status, order
//     and provenance untouched. Prose-adjacent evidence may add a row; it may
//     never restate a tutor's own status (a `done` song named in a recap is not
//     back in progress).
//   - **Confirmed catalogue ids only.** Callers must never pass
//     `unlistedSongTitles` here: those are explicitly not Song facts.
//
// New rows are born `working` rather than `assigned` — the note is evidence the
// song was in front of the student this lesson — which also puts them into the
// next lesson's transcription prompt.
export function buildNoteSongAssignments({
  mmsId = '',
  songIds = [],
  assignedBy = '',
  existingRows = [],
  catalogue = SONGS_CATALOGUE,
  now = new Date(),
} = {}) {
  const rows = [];
  const rowsSoFar = [...existingRows];
  const seen = new Set();

  for (const songId of songIds) {
    const cleanSongId = `${songId || ''}`.trim();
    if (!cleanSongId || seen.has(cleanSongId)) continue;
    seen.add(cleanSongId);

    const result = buildAssignmentUpsert({
      mmsId,
      songId: cleanSongId,
      assignedBy,
      existingRows: rowsSoFar,
      catalogue,
      now,
      via: 'note',
      initialStatus: 'working',
    });
    // A song that fails validation is skipped, not fatal: this runs as a side
    // effect of saving a note, and the note is the thing that must survive.
    if (result.error || !result.created) continue;

    rows.push(result.row);
    rowsSoFar.push(result.row);
  }

  return { rows };
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
