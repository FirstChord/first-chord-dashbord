import {
  ensureManagedSheet,
  getSheetValues,
  getSheetsClient,
  getSheetsEnv,
  INCOMING_MESSAGE_INBOX_HEADERS,
  INCOMING_MESSAGE_INBOX_SHEET,
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
    matchedStudentName: row.matched_student_name || '',
    matchConfidence: row.match_confidence || '',
    matchReasons: row.match_reasons || '',
    status: row.status || '',
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
    matched_student_name: row.matchedStudentName || '',
    match_confidence: row.matchConfidence || '',
    match_reasons: row.matchReasons || '',
    status: row.status || '',
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
