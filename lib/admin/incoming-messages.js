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
  INCOMING_MESSAGE_CATEGORIES,
  isWhatsappGroupChatId,
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

  const [students, groupMapRows] = await Promise.all([
    getOperationalAdminStudents(),
    getWhatsappGroupMapRows(),
  ]);
  const record = buildIncomingMessageRecord({
    ...payload,
    capturedBy: payload?.capturedBy || payload?.captured_by || actorEmail,
  }, { students, groupMapRows });

  await upsertIncomingMessageInboxRow(record);

  const firstPassGroupMapRecord = buildWhatsappGroupMapRecord(record);
  if (firstPassGroupMapRecord) {
    const existingGroup = groupMapRows.find((entry) => entry.chatId === record.chatId);
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

export async function correctIncomingMessage({
  incomingId,
  category = '',
  matchedMmsId = '',
  reviewNote = '',
  confirmGroupMap = false,
} = {}) {
  const incomingKey = `${incomingId || ''}`.trim();
  if (!incomingKey) {
    throw new Error('incomingId is required');
  }

  const [existingRows, students, groupRows] = await Promise.all([
    getIncomingMessageInboxRows(),
    getOperationalAdminStudents(),
    getWhatsappGroupMapRows(),
  ]);
  const row = existingRows.find((entry) => entry.incomingId === incomingKey);
  if (!row) {
    throw new Error(`Incoming message ${incomingKey} was not found`);
  }

  const selectedCategory = `${category || ''}`.trim();
  const selectedStudentId = `${matchedMmsId || ''}`.trim();
  const selectedStudent = students.find((student) => student.mmsId === selectedStudentId);
  const correctionReasons = [];

  const next = {
    ...row,
    status: 'needs_review',
  };

  if (selectedCategory) {
    if (!INCOMING_MESSAGE_CATEGORIES.includes(selectedCategory)) {
      throw new Error(`Unknown incoming message category: ${selectedCategory}`);
    }
    next.suspectedCategory = selectedCategory;
    correctionReasons.push(`reviewer corrected category to ${selectedCategory}`);
  }

  if (selectedStudentId) {
    if (!selectedStudent) {
      throw new Error(`Student ${selectedStudentId} was not found`);
    }
    next.matchedMmsId = selectedStudent.mmsId || '';
    next.matchedStudentName = selectedStudent.fullName || '';
    next.matchConfidence = 'high';
    correctionReasons.push('reviewer corrected matched student');
  }

  if (confirmGroupMap && !isWhatsappGroupChatId(next.chatId)) {
    throw new Error('Only WhatsApp group chats can be confirmed in the group map');
  }

  const note = `${reviewNote || ''}`.trim();
  if (note) {
    next.reviewNote = [row.reviewNote, note].filter(Boolean).join(' | ');
  }
  next.matchReasons = [row.matchReasons, ...correctionReasons].filter(Boolean).join(' | ');

  await upsertIncomingMessageInboxRow(next);

  if (confirmGroupMap && next.chatId && next.matchedMmsId) {
    const existingGroup = groupRows.find((entry) => entry.chatId === next.chatId);
    const groupMapRecord = buildWhatsappGroupMapRecord({
      ...next,
      groupMapStatus: 'confirmed',
    }, existingGroup);
    if (groupMapRecord) {
      await upsertWhatsappGroupMapRow(groupMapRecord);
    }
  }

  return next;
}

export async function deleteIncomingMessage({ incomingId = '' } = {}) {
  const incomingKey = `${incomingId || ''}`.trim();
  if (!incomingKey) {
    throw new Error('incomingId is required');
  }

  return deleteIncomingMessageInboxRow(incomingKey);
}
