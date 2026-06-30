import { buildSheetRange, COMMUNICATION_LOG_HEADERS, COMMUNICATION_LOG_SHEET, ensureManagedSheet, getSheetValues, getSheetsClient, getSheetsEnv, invalidateSheetReadCache, mapRowsToObjectsWithRowNumbers } from './core.mjs';

export async function getCommunicationLogRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: COMMUNICATION_LOG_SHEET,
    requiredHeaders: COMMUNICATION_LOG_HEADERS,
  });

  const values = await getSheetValues(COMMUNICATION_LOG_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    messageId: row.message_id || '',
    loggedAt: row.logged_at || '',
    category: row.category || '',
    channel: row.channel || '',
    mmsId: row.mms_id || '',
    studentName: row.student_name || '',
    body: row.body || '',
    source: row.source || '',
    actorEmail: row.actor_email || '',
  }));
}

function buildCommunicationLogSheetRow(entry) {
  return {
    message_id: entry.messageId || '',
    logged_at: entry.loggedAt || '',
    category: entry.category || '',
    channel: entry.channel || '',
    mms_id: entry.mmsId || '',
    student_name: entry.studentName || '',
    body: entry.body || '',
    source: entry.source || '',
    actor_email: entry.actorEmail || '',
  };
}

export async function appendCommunicationLogRow(entry) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: COMMUNICATION_LOG_SHEET,
    requiredHeaders: COMMUNICATION_LOG_HEADERS,
  });
  const valuesByHeader = buildCommunicationLogSheetRow(entry);
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(COMMUNICATION_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(COMMUNICATION_LOG_SHEET);
}

