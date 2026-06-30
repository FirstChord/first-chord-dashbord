import { columnNumberToLetter } from '../sheets-helpers.mjs';
import { buildSheetRange, EVENT_LOG_HEADERS, EVENT_LOG_SHEET, getCachedSheetValues, getSheetObjects, getSheetValues, getSheetsClient, getSheetsEnv, ISSUE_QUEUE_HEADERS, ISSUE_QUEUE_SHEET, invalidateSheetReadCache, mapRowsToObjectsWithRowNumbers, setCachedSheetValues, ensureManagedSheet, upsertManagedSheetRow, withSheetsRetry } from './core.mjs';

export async function getReviewFlagsRows() {
  return getSheetObjects('Review_Flags');
}

export async function getPauseHistoryRows() {
  return getSheetObjects("'Pause History'");
}

export async function getIssueQueueRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: ISSUE_QUEUE_SHEET,
    requiredHeaders: ISSUE_QUEUE_HEADERS,
  });

  // Cache the raw read (TTL) so repeat reads within the window — e.g. the overview
  // and the flags page — don't each re-fetch and burn the per-minute read quota.
  // Issue writes go through upsertManagedSheetRow/upsertIssueQueueRows, both of which
  // invalidate this sheet's cache, so a resolve/update is reflected immediately.
  const range = buildSheetRange(ISSUE_QUEUE_SHEET);
  let values = getCachedSheetValues({ spreadsheetId, range });
  if (!values) {
    const response = await withSheetsRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    }));
    values = response.data.values || [];
    setCachedSheetValues({ spreadsheetId, range, values });
  }

  const rows = mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    issueId: row.issue_id || '',
    source: row.source || '',
    issueType: row.issue_type || '',
    mmsId: row.mms_id || '',
    contextKey: row.context_key || '',
    studentName: row.student_name || '',
    severity: row.severity || '',
    status: row.status || '',
    owner: row.owner || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    resolvedAt: row.resolved_at || '',
    ignoredAt: row.ignored_at || '',
    acknowledgedAt: row.acknowledged_at || '',
    lastSeenAt: row.last_seen_at || '',
    sourcePresent: normaliseBooleanCell(row.source_present),
    summary: row.summary || '',
    detail: row.detail || '',
    recommendedAction: row.recommended_action || '',
    systemsAffected: row.systems_affected || '',
    resolutionNote: row.resolution_note || '',
  }));

  return dedupeIssueQueueRows(rows);
}

function buildIssueQueueSheetRow(row) {
  return {
    issue_id: row.issueId || '',
    source: row.source || '',
    issue_type: row.issueType || '',
    mms_id: row.mmsId || '',
    context_key: row.contextKey || '',
    student_name: row.studentName || '',
    severity: row.severity || '',
    status: row.status || '',
    owner: row.owner || '',
    created_at: row.createdAt || '',
    updated_at: row.updatedAt || '',
    resolved_at: row.resolvedAt || '',
    ignored_at: row.ignoredAt || '',
    acknowledged_at: row.acknowledgedAt || '',
    last_seen_at: row.lastSeenAt || '',
    source_present: row.sourcePresent || '',
    summary: row.summary || '',
    detail: row.detail || '',
    recommended_action: row.recommendedAction || '',
    systems_affected: row.systemsAffected || '',
    resolution_note: row.resolutionNote || '',
  };
}

function normaliseBooleanCell(value) {
  return `${value || ''}`.trim().toLowerCase() === 'true' ? 'true' : 'false';
}

function dedupeIssueQueueRows(rows = []) {
  const byIssueId = new Map();
  const passthroughRows = [];

  for (const row of rows) {
    if (!row.issueId) {
      passthroughRows.push(row);
      continue;
    }

    const existing = byIssueId.get(row.issueId);
    if (!existing || Number(row.rowNumber || 0) >= Number(existing.rowNumber || 0)) {
      byIssueId.set(row.issueId, row);
    }
  }

  return [
    ...passthroughRows,
    ...byIssueId.values(),
  ].sort((a, b) => Number(a.rowNumber || 0) - Number(b.rowNumber || 0));
}

export async function upsertIssueQueueRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildIssueQueueSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: ISSUE_QUEUE_SHEET,
    requiredHeaders: ISSUE_QUEUE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('issue_id')] || ''}`.trim() === row.issueId,
  });
}

export async function upsertIssueQueueRows(rowsToSync = []) {
  if (!rowsToSync.length) {
    return;
  }

  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: ISSUE_QUEUE_SHEET,
    requiredHeaders: ISSUE_QUEUE_HEADERS,
  });

  const values = await getSheetValues(ISSUE_QUEUE_SHEET);
  const [, ...existingRows] = values;
  const issueIdIndex = headers.findIndex((header) => header === 'issue_id');
  const existingRowMap = new Map(
    existingRows.map((row, index) => [`${row[issueIdIndex] || ''}`.trim(), index + 2]),
  );
  const endColumn = columnNumberToLetter(headers.length);
  const updates = [];
  const appends = [];

  for (const row of rowsToSync) {
    const valuesByHeader = buildIssueQueueSheetRow(row);
    const nextRow = headers.map((header) => valuesByHeader[header] ?? '');
    const existingRowNumber = existingRowMap.get(row.issueId);

    if (existingRowNumber) {
      updates.push({
        range: buildSheetRange(ISSUE_QUEUE_SHEET, `A${existingRowNumber}:${endColumn}${existingRowNumber}`),
        values: [nextRow],
      });
    } else {
      appends.push(nextRow);
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates,
      },
    });
  }

  if (appends.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: buildSheetRange(ISSUE_QUEUE_SHEET, 'A:A'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: appends,
      },
    });
  }

  invalidateSheetReadCache(ISSUE_QUEUE_SHEET);
}

export async function updateIssueQueueRow(issueId, updates) {
  const rows = await getIssueQueueRows();
  const existingRow = rows.find((row) => row.issueId === issueId);

  if (!existingRow) {
    throw new Error(`Issue queue row ${issueId} was not found`);
  }

  await upsertIssueQueueRow({
    ...existingRow,
    ...updates,
    issueId,
  });
}

function buildEventLogSheetRow(row) {
  return {
    event_id: row.eventId || '',
    occurred_at: row.occurredAt || '',
    actor_email: row.actorEmail || '',
    entity_type: row.entityType || '',
    entity_id: row.entityId || '',
    event_type: row.eventType || '',
    mms_id: row.mmsId || '',
    student_name: row.studentName || '',
    issue_id: row.issueId || '',
    payload_json: row.payloadJson || '',
  };
}

export async function appendEventLogRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: EVENT_LOG_SHEET,
    requiredHeaders: EVENT_LOG_HEADERS,
  });
  const valuesByHeader = buildEventLogSheetRow(row);
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(EVENT_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(EVENT_LOG_SHEET);
}

export async function appendEventLogRows(rows = []) {
  if (!rows.length) {
    return;
  }

  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: EVENT_LOG_SHEET,
    requiredHeaders: EVENT_LOG_HEADERS,
  });
  const values = rows.map((row) => {
    const valuesByHeader = buildEventLogSheetRow(row);
    return headers.map((header) => valuesByHeader[header] ?? '');
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(EVENT_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values,
    },
  });
  invalidateSheetReadCache(EVENT_LOG_SHEET);
}

