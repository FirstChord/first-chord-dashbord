import {
  ensureManagedSheet,
  getSheetValues,
  getSheetsClient,
  getSheetsEnv,
  mapRowsToObjectsWithRowNumbers,
  SONG_ASSIGNMENTS_HEADERS,
  SONG_ASSIGNMENTS_SHEET,
  upsertManagedSheetRow,
} from './core.mjs';

export async function getSongAssignmentRows(mmsId = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: SONG_ASSIGNMENTS_SHEET,
    requiredHeaders: SONG_ASSIGNMENTS_HEADERS,
  });

  const values = await getSheetValues(SONG_ASSIGNMENTS_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    assignmentId: row.assignment_id || '',
    mmsId: row.mms_id || '',
    songId: row.song_id || '',
    songTitle: row.song_title || '',
    assignedBy: row.assigned_by || '',
    assignedAt: row.assigned_at || '',
    status: row.status || '',
    sortOrder: row.sort_order || '',
    pathId: row.path_id || '',
    stepLabel: row.step_label || '',
    tutorNoteOverride: row.tutor_note_override || '',
    updatedAt: row.updated_at || '',
  })).filter((row) => (!mmsId || row.mmsId === mmsId));
}

function buildSongAssignmentSheetRow(row) {
  return {
    assignment_id: row.assignmentId || '',
    mms_id: row.mmsId || '',
    song_id: row.songId || '',
    song_title: row.songTitle || '',
    assigned_by: row.assignedBy || '',
    assigned_at: row.assignedAt || '',
    status: row.status || '',
    sort_order: `${row.sortOrder ?? ''}`,
    path_id: row.pathId || '',
    step_label: row.stepLabel || '',
    tutor_note_override: row.tutorNoteOverride || '',
    updated_at: row.updatedAt || '',
  };
}

export async function upsertSongAssignmentRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildSongAssignmentSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: SONG_ASSIGNMENTS_SHEET,
    requiredHeaders: SONG_ASSIGNMENTS_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) =>
      `${entry[headers.indexOf('assignment_id')] || ''}`.trim() === row.assignmentId,
  });
}
