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
  SONG_REQUESTS_HEADERS,
  SONG_REQUESTS_SHEET,
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

export function buildSongAssignmentSheetRow(row) {
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

export function buildSongStatusLogSheetRow(entry) {
  return {
    log_id: entry.logId || '',
    assignment_id: entry.assignmentId || '',
    mms_id: entry.mmsId || '',
    song_id: entry.songId || '',
    from_status: entry.fromStatus || '',
    to_status: entry.toStatus || '',
    changed_by: entry.changedBy || '',
    changed_at: entry.changedAt || '',
  };
}

// Append-only status-transition telemetry; one batched append per write.
export async function appendSongStatusLogRows(entries = []) {
  await appendRows({
    sheetName: SONG_STATUS_LOG_SHEET,
    requiredHeaders: SONG_STATUS_LOG_HEADERS,
    valuesByHeaderList: entries.map(buildSongStatusLogSheetRow),
  });
}

// Tutor "request this song" queue: the dashboard appends status='new' rows
// only; the add-song skill reads and resolves them.
export function buildSongRequestSheetRow(row) {
  return {
    request_id: row.requestId || '',
    requested_at: row.requestedAt || '',
    requested_by: row.requestedBy || '',
    mms_id: row.mmsId || '',
    instrument: row.instrument || '',
    query_text: row.queryText || '',
    status: row.status || 'new',
    song_id: row.songId || '',
    resolution_note: row.resolutionNote || '',
    resolved_at: row.resolvedAt || '',
    updated_at: row.updatedAt || '',
  };
}

export async function appendSongRequestRow(row) {
  await appendRows({
    sheetName: SONG_REQUESTS_SHEET,
    requiredHeaders: SONG_REQUESTS_HEADERS,
    valuesByHeaderList: [buildSongRequestSheetRow(row)],
  });
}

export async function getSongRequestRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: SONG_REQUESTS_SHEET,
    requiredHeaders: SONG_REQUESTS_HEADERS,
  });

  const values = await getSheetValues(SONG_REQUESTS_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    requestId: row.request_id || '',
    requestedAt: row.requested_at || '',
    requestedBy: row.requested_by || '',
    mmsId: row.mms_id || '',
    instrument: row.instrument || '',
    queryText: row.query_text || '',
    status: row.status || '',
    songId: row.song_id || '',
    resolutionNote: row.resolution_note || '',
    resolvedAt: row.resolved_at || '',
    updatedAt: row.updated_at || '',
  }));
}

export function buildSongOutcomeSheetRow(row) {
  return {
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
  };
}

// Append-only tutor outcome ("how did it go?") rows.
export async function appendSongOutcomeRow(row) {
  await appendRows({
    sheetName: SONG_OUTCOMES_SHEET,
    requiredHeaders: SONG_OUTCOMES_HEADERS,
    valuesByHeaderList: [buildSongOutcomeSheetRow(row)],
  });
}
