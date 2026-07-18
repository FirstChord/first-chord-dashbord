import {
  buildSheetRange,
  ensureManagedSheet,
  getSheetValues,
  getSheetsClient,
  getSheetsEnv,
  invalidateSheetReadCache,
  mapRowsToObjectsWithRowNumbers,
  SONG_ASSIGNMENTS_HEADERS,
  SONG_ASSIGNMENTS_SHEET,
  SONG_OUTCOMES_HEADERS,
  SONG_OUTCOMES_SHEET,
  SONG_STATUS_LOG_HEADERS,
  SONG_STATUS_LOG_SHEET,
  upsertManagedSheetRow,
  withSheetsRetry,
} from './core.mjs';

export async function getSongAssignmentRows(mmsId = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    // A runtime without Sheets env (e.g. the legacy public Railway service)
    // renders portals with no assigned songs. Warn so an empty "Your Songs"
    // is traceable to env, not mistaken for "nothing assigned".
    console.warn('Song assignments read skipped: Google Sheets credentials are not configured on this runtime.');
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

async function appendRows({ sheetName, requiredHeaders, valuesByHeaderList }) {
  if (!valuesByHeaderList.length) return;

  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({ sheets, spreadsheetId, sheetName, requiredHeaders });
  const values = valuesByHeaderList.map((valuesByHeader) =>
    headers.map((header) => valuesByHeader[header] ?? '')
  );

  await withSheetsRetry(() => sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(sheetName, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  }));
  invalidateSheetReadCache(sheetName);
}

// Append-only status-transition telemetry; one batched append per write.
export async function appendSongStatusLogRows(entries = []) {
  await appendRows({
    sheetName: SONG_STATUS_LOG_SHEET,
    requiredHeaders: SONG_STATUS_LOG_HEADERS,
    valuesByHeaderList: entries.map((entry) => ({
      log_id: entry.logId || '',
      assignment_id: entry.assignmentId || '',
      mms_id: entry.mmsId || '',
      song_id: entry.songId || '',
      from_status: entry.fromStatus || '',
      to_status: entry.toStatus || '',
      changed_by: entry.changedBy || '',
      changed_at: entry.changedAt || '',
    })),
  });
}

// Append-only tutor outcome ("how did it go?") rows.
export async function appendSongOutcomeRow(row) {
  await appendRows({
    sheetName: SONG_OUTCOMES_SHEET,
    requiredHeaders: SONG_OUTCOMES_HEADERS,
    valuesByHeaderList: [{
      outcome_id: row.outcomeId || '',
      assignment_id: row.assignmentId || '',
      mms_id: row.mmsId || '',
      song_id: row.songId || '',
      song_title: row.songTitle || '',
      at_status: row.atStatus || '',
      outcome: row.outcome || '',
      note: row.note || '',
      recorded_by: row.recordedBy || '',
      recorded_at: row.recordedAt || '',
    }],
  });
}
