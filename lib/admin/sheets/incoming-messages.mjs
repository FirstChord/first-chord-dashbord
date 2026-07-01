import {
  ensureManagedSheet,
  getSheetValues,
  getSheetsClient,
  getSheetsEnv,
  INCOMING_MESSAGE_INBOX_HEADERS,
  INCOMING_MESSAGE_INBOX_SHEET,
  invalidateSheetReadCache,
  mapRowsToObjectsWithRowNumbers,
  upsertManagedSheetRow,
  WHATSAPP_GROUP_MAP_HEADERS,
  WHATSAPP_GROUP_MAP_SHEET,
} from './core.mjs';

export async function getIncomingMessageInboxRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: INCOMING_MESSAGE_INBOX_SHEET,
    requiredHeaders: INCOMING_MESSAGE_INBOX_HEADERS,
  });

  const values = await getSheetValues(INCOMING_MESSAGE_INBOX_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    incomingId: row.incoming_id || '',
    source: row.source || '',
    externalMessageId: row.external_message_id || '',
    capturedAt: row.captured_at || '',
    messageAt: row.message_at || '',
    chatId: row.chat_id || '',
    chatName: row.chat_name || '',
    senderName: row.sender_name || '',
    senderPhone: row.sender_phone || '',
    messageText: row.message_text || '',
    capturedBy: row.captured_by || '',
    suspectedCategory: row.suspected_category || '',
    matchedMmsId: row.matched_mms_id || '',
    matchedStudentName: row.matched_student_name || '',
    matchConfidence: row.match_confidence || '',
    matchReasons: row.match_reasons || '',
    status: row.status || '',
    reviewNote: row.review_note || '',
    reviewedBy: row.reviewed_by || '',
    reviewedAt: row.reviewed_at || '',
    createdPlanningId: row.created_planning_id || '',
    rawJson: row.raw_json || '',
  }));
}

function buildIncomingMessageSheetRow(row) {
  return {
    incoming_id: row.incomingId || '',
    source: row.source || '',
    external_message_id: row.externalMessageId || '',
    captured_at: row.capturedAt || '',
    message_at: row.messageAt || '',
    chat_id: row.chatId || '',
    chat_name: row.chatName || '',
    sender_name: row.senderName || '',
    sender_phone: row.senderPhone || '',
    message_text: row.messageText || '',
    captured_by: row.capturedBy || '',
    suspected_category: row.suspectedCategory || '',
    matched_mms_id: row.matchedMmsId || '',
    matched_student_name: row.matchedStudentName || '',
    match_confidence: row.matchConfidence || '',
    match_reasons: row.matchReasons || '',
    status: row.status || '',
    review_note: row.reviewNote || '',
    reviewed_by: row.reviewedBy || '',
    reviewed_at: row.reviewedAt || '',
    created_planning_id: row.createdPlanningId || '',
    raw_json: row.rawJson || '',
  };
}

export async function upsertIncomingMessageInboxRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildIncomingMessageSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: INCOMING_MESSAGE_INBOX_SHEET,
    requiredHeaders: INCOMING_MESSAGE_INBOX_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('incoming_id')] || ''}`.trim() === row.incomingId,
  });
}

export async function deleteIncomingMessageInboxRow(incomingId = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const incomingKey = `${incomingId || ''}`.trim();
  if (!incomingKey) return { deleted: false };

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: INCOMING_MESSAGE_INBOX_SHEET,
    requiredHeaders: INCOMING_MESSAGE_INBOX_HEADERS,
  });
  const values = await getSheetValues(INCOMING_MESSAGE_INBOX_SHEET);
  const [, ...rows] = values;
  const idIdx = headers.indexOf('incoming_id');
  const rowIndex = rows.findIndex((entry) => `${entry[idIdx] || ''}`.trim() === incomingKey);
  if (rowIndex === -1) return { deleted: false };

  const metadata = await sheets.spreadsheets.get({ spreadsheetId, ranges: [INCOMING_MESSAGE_INBOX_SHEET], includeGridData: false });
  const sheet = metadata.data.sheets?.find((entry) => entry.properties?.title === INCOMING_MESSAGE_INBOX_SHEET);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId !== 'number') {
    throw new Error('Could not resolve Incoming_Message_Inbox sheet metadata');
  }

  const targetRowNumber = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: targetRowNumber - 1, endIndex: targetRowNumber },
          },
        },
      ],
    },
  });

  invalidateSheetReadCache(INCOMING_MESSAGE_INBOX_SHEET);
  return { deleted: true, rowNumber: targetRowNumber };
}

export async function getWhatsappGroupMapRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: WHATSAPP_GROUP_MAP_SHEET,
    requiredHeaders: WHATSAPP_GROUP_MAP_HEADERS,
  });

  const values = await getSheetValues(WHATSAPP_GROUP_MAP_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    chatId: row.chat_id || '',
    chatName: row.chat_name || '',
    firstSeenAt: row.first_seen_at || '',
    lastSeenAt: row.last_seen_at || '',
    lastIncomingId: row.last_incoming_id || '',
    lastMessageAt: row.last_message_at || '',
    lastSenderName: row.last_sender_name || '',
    lastSenderPhone: row.last_sender_phone || '',
    matchedMmsId: row.matched_mms_id || '',
    matchedFcId: row.matched_fc_id || '',
    matchedStudentName: row.matched_student_name || '',
    parentName: row.parent_name || '',
    parentPhone: row.parent_phone || '',
    tutorName: row.tutor_name || '',
    instrument: row.instrument || '',
    matchConfidence: row.match_confidence || '',
    matchReasons: row.match_reasons || '',
    status: row.status || '',
    confirmedBy: row.confirmed_by || '',
    confirmedAt: row.confirmed_at || '',
    notes: row.notes || '',
    rawJson: row.raw_json || '',
  }));
}

function buildWhatsappGroupMapSheetRow(row) {
  return {
    chat_id: row.chatId || '',
    chat_name: row.chatName || '',
    first_seen_at: row.firstSeenAt || '',
    last_seen_at: row.lastSeenAt || '',
    last_incoming_id: row.lastIncomingId || '',
    last_message_at: row.lastMessageAt || '',
    last_sender_name: row.lastSenderName || '',
    last_sender_phone: row.lastSenderPhone || '',
    matched_mms_id: row.matchedMmsId || '',
    matched_fc_id: row.matchedFcId || '',
    matched_student_name: row.matchedStudentName || '',
    parent_name: row.parentName || '',
    parent_phone: row.parentPhone || '',
    tutor_name: row.tutorName || '',
    instrument: row.instrument || '',
    match_confidence: row.matchConfidence || '',
    match_reasons: row.matchReasons || '',
    status: row.status || '',
    confirmed_by: row.confirmedBy || '',
    confirmed_at: row.confirmedAt || '',
    notes: row.notes || '',
    raw_json: row.rawJson || '',
  };
}

export async function upsertWhatsappGroupMapRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildWhatsappGroupMapSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: WHATSAPP_GROUP_MAP_SHEET,
    requiredHeaders: WHATSAPP_GROUP_MAP_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('chat_id')] || ''}`.trim() === row.chatId,
  });
}
