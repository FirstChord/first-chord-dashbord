import { buildPracticeNoteLogSheetRow, normalisePracticeNoteLogRow } from '../practice-notes-helpers.mjs';
import { buildSheetRange, ensureManagedSheet, getSheetValues, getSheetsClient, getSheetsEnv, invalidateSheetReadCache, mapRowsToObjectsWithRowNumbers, PRACTICE_NOTES_LOG_HEADERS, PRACTICE_NOTES_LOG_SHEET, upsertManagedSheetRow } from './core.mjs';

export async function getPracticeNoteLogRows(studentMmsId = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PRACTICE_NOTES_LOG_SHEET,
    requiredHeaders: PRACTICE_NOTES_LOG_HEADERS,
  });

  const values = await getSheetValues(PRACTICE_NOTES_LOG_SHEET);
  return mapRowsToObjectsWithRowNumbers(values)
    .map((row) => ({
      rowNumber: row.__rowNumber,
      ...normalisePracticeNoteLogRow(row),
    }))
    .filter((row) => (!studentMmsId || row.studentMmsId === studentMmsId))
    .sort((a, b) => {
      const aTime = new Date(a.emailSentAt || a.createdAt || a.lessonDate || '').getTime();
      const bTime = new Date(b.emailSentAt || b.createdAt || b.lessonDate || '').getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
}

export async function appendPracticeNoteLogRow(note) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PRACTICE_NOTES_LOG_SHEET,
    requiredHeaders: PRACTICE_NOTES_LOG_HEADERS,
  });
  const valuesByHeader = buildPracticeNoteLogSheetRow(note);

  if (valuesByHeader.note_id) {
    const values = await getSheetValues(PRACTICE_NOTES_LOG_SHEET);
    const existingHeaders = values[0] || [];
    const noteIdIndex = existingHeaders.indexOf('note_id');
    if (noteIdIndex >= 0) {
      const duplicate = values.slice(1).some((row) => row[noteIdIndex] === valuesByHeader.note_id);
      if (duplicate) {
        return {
          skipped: true,
          reason: 'duplicate_note_id',
          noteId: valuesByHeader.note_id,
        };
      }
    }
  }

  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(PRACTICE_NOTES_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(PRACTICE_NOTES_LOG_SHEET);
  return {
    skipped: false,
    noteId: valuesByHeader.note_id,
  };
}

export async function upsertPracticeNoteLogRow(note) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildPracticeNoteLogSheetRow(note);
  const deliveryKey = `${valuesByHeader.delivery_key || ''}`.trim();

  if (!deliveryKey) {
    return appendPracticeNoteLogRow(note);
  }

  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: PRACTICE_NOTES_LOG_SHEET,
    requiredHeaders: PRACTICE_NOTES_LOG_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('delivery_key')] || ''}`.trim() === deliveryKey,
  });

  return {
    skipped: false,
    upserted: true,
    noteId: valuesByHeader.note_id,
    deliveryKey,
  };
}

