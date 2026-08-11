import {
  buildPracticeChatSessionSheetRow,
  normalisePracticeChatSessionRow,
} from '../practice-chat-session-helpers.mjs';
import {
  ensureManagedSheet,
  getSheetValues,
  getSheetsClient,
  getSheetsEnv,
  mapRowsToObjectsWithRowNumbers,
  PRACTICE_CHAT_SESSIONS_HEADERS,
  PRACTICE_CHAT_SESSIONS_SHEET,
  upsertManagedSheetRow,
} from './core.mjs';

export async function getPracticeChatSessionRows({ studentMmsId = '', tutor = '' } = {}) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PRACTICE_CHAT_SESSIONS_SHEET,
    requiredHeaders: PRACTICE_CHAT_SESSIONS_HEADERS,
  });

  const values = await getSheetValues(PRACTICE_CHAT_SESSIONS_SHEET);
  return mapRowsToObjectsWithRowNumbers(values)
    .map((row) => ({
      rowNumber: row.__rowNumber,
      ...normalisePracticeChatSessionRow(row),
    }))
    .filter((row) => (
      (!studentMmsId || row.studentMmsId === studentMmsId)
      && (!tutor || row.tutor === tutor)
    ))
    .sort((a, b) => (
      new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()
    ));
}

/**
 * Upsert one session row, keyed on `session_id`.
 *
 * A session is written three times as it progresses (opened → note_generated →
 * finished), so this must be an upsert or the same lesson would land three
 * times. `upsertManagedSheetRow` bypasses the read cache before targeting a
 * row, which is what makes the second write reliably find the first.
 *
 * Every write carries the **whole** session: the PWA accumulates state in
 * memory and re-sends all of it, and the rating routes read the existing row
 * first (`getPracticeChatSessionRows`) and write it back with one field
 * changed. There is deliberately no partial-write path. A merge that skipped
 * "empty" values could not tell a field this write had nothing to say about
 * from one it meant to clear — and booleans serialise to the non-empty string
 * `FALSE`, so such a merge would silently overwrite a `TRUE`. That is the same
 * trap `setPracticeNoteFollowUpHandled` documents next door, avoided here by
 * never constructing a partial row in the first place.
 */
export async function upsertPracticeChatSessionRow(session) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const sessionId = `${session?.sessionId || ''}`.trim();
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: PRACTICE_CHAT_SESSIONS_SHEET,
    requiredHeaders: PRACTICE_CHAT_SESSIONS_HEADERS,
    valuesByHeader: buildPracticeChatSessionSheetRow(session),
    matchesRow: (entry, headers) => (
      `${entry[headers.indexOf('session_id')] || ''}`.trim() === sessionId
    ),
  });

  return { upserted: true, sessionId };
}
