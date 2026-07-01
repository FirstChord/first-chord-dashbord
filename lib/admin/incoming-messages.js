import {
  deleteIncomingMessageInboxRow,
  getIncomingMessageInboxRows,
  getWhatsappGroupMapRows,
  upsertIncomingMessageInboxRow,
  upsertWhatsappGroupMapRow,
} from '@/lib/admin/sheets';
import { getOperationalAdminStudents } from './students';
import {
  buildIncomingMessageRecord,
  buildWhatsappGroupMapRecord,
  groupIncomingMessages,
  normaliseIncomingMessagePayload,
} from './incoming-message-helpers.mjs';

export async function getIncomingMessageInbox() {
  const rows = await getIncomingMessageInboxRows();
  return groupIncomingMessages(rows);
}

export async function getWhatsappGroupMap() {
  const rows = await getWhatsappGroupMapRows();
  return rows.sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());
}

export async function captureIncomingMessage(payload = {}, { actorEmail = '' } = {}) {
  const normalised = normaliseIncomingMessagePayload({
    ...payload,
    capturedBy: payload?.capturedBy || payload?.captured_by || actorEmail,
  });

  if (!normalised.messageText) {
    throw new Error('Incoming message text is required');
  }

  const students = await getOperationalAdminStudents();
  const record = buildIncomingMessageRecord({
    ...payload,
    capturedBy: payload?.capturedBy || payload?.captured_by || actorEmail,
  }, { students });

  await upsertIncomingMessageInboxRow(record);

  const firstPassGroupMapRecord = buildWhatsappGroupMapRecord(record);
  if (firstPassGroupMapRecord) {
    const groupRows = await getWhatsappGroupMapRows();
    const existingGroup = groupRows.find((entry) => entry.chatId === record.chatId);
    const groupMapRecord = buildWhatsappGroupMapRecord(record, existingGroup);
    await upsertWhatsappGroupMapRow(groupMapRecord);
  }

  return record;
}

export async function updateIncomingMessageReview({ incomingId, status = '', reviewNote = '', createdPlanningId = '' }) {
  const existing = await getIncomingMessageInboxRows();
  const row = existing.find((entry) => entry.incomingId === incomingId);
  if (!row) {
    throw new Error(`Incoming message ${incomingId} was not found`);
  }

  const next = {
    ...row,
    status: status || row.status || 'inbox',
    reviewNote: typeof reviewNote === 'string' ? reviewNote : row.reviewNote,
    createdPlanningId: typeof createdPlanningId === 'string' ? createdPlanningId : row.createdPlanningId,
  };

  await upsertIncomingMessageInboxRow(next);
  return next;
}

export async function deleteIncomingMessage({ incomingId = '' } = {}) {
  const incomingKey = `${incomingId || ''}`.trim();
  if (!incomingKey) {
    throw new Error('incomingId is required');
  }

  return deleteIncomingMessageInboxRow(incomingKey);
}
