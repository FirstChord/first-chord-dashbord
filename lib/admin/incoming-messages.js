import {
  batchUpsertWhatsappGroupMapRows,
  deleteIncomingMessageInboxRow,
  getBridgeStatusRows,
  getIncomingMessageInboxRows,
  getTutorPhoneRows,
  getWhatsappGroupMapRows,
  upsertBridgeStatusRow,
  upsertIncomingMessageInboxRow,
  upsertWhatsappGroupMapRow,
} from '@/lib/admin/sheets';
import { getOperationalAdminStudents } from './students';
import { savePlanningItem } from './planning.js';
import {
  applyIncomingMessageTextUpdate,
  buildGroupSyncPlan,
  buildIncomingMessageRecord,
  buildIncomingPlanningDraft,
  buildIncomingReplyTemplate,
  buildTutorPhoneLookup,
  buildWhatsappGroupMapRecord,
  decideAutoCaptureStatus,
  decideSyncedGroupStatus,
  deriveIncomingMessageResolutionType,
  extractIncomingMessageDates,
  groupIncomingMessages,
  INCOMING_MESSAGE_CATEGORIES,
  isSchoolStaffMessage,
  isWhatsappGroupChatId,
  matchTutorPhone,
  matchTutorSenderName,
  mergeIncomingCapture,
  normaliseIncomingMessagePayload,
} from './incoming-message-helpers.mjs';

export const AUTO_CAPTURE_SOURCE = 'whatsapp_group_auto';

// Chat ids the bridge is allowed to auto-capture from — human-confirmed FC
// lesson groups only. Served to the bridge via GET ?mode=confirmed_groups.
export async function getConfirmedGroupChatIds() {
  const rows = await getWhatsappGroupMapRows();
  return rows.filter((row) => row.status === 'confirmed' && row.chatId).map((row) => row.chatId);
}

// Bridge heartbeat (mode: bridge_status, every ~30min + on connect). One row
// per bridge id so the dashboard can tell "down" and "alive but capturing
// nothing" apart from an ordinary quiet day.
export async function recordBridgeStatus(payload = {}) {
  const row = {
    bridgeId: `${payload.bridgeId || payload.bridge_id || 'primary'}`.trim() || 'primary',
    lastHeartbeatAt: new Date().toISOString(),
    connectedAt: `${payload.connectedAt || payload.connected_at || ''}`.trim(),
    startedAt: `${payload.startedAt || payload.started_at || ''}`.trim(),
    confirmedGroups: Number(payload.confirmedGroups ?? payload.confirmed_groups) || 0,
    cachedMessages: Number(payload.cachedMessages ?? payload.cached_messages) || 0,
    bridgeVersion: `${payload.bridgeVersion || payload.bridge_version || ''}`.trim(),
    rawJson: '',
  };
  await upsertBridgeStatusRow(row);
  return row;
}

export async function getBridgeStatus({ bridgeId = 'primary' } = {}) {
  const rows = await getBridgeStatusRows();
  return rows.find((row) => row.bridgeId === bridgeId) || null;
}

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

  const [students, groupMapRows, existingRows, tutorPhoneRows] = await Promise.all([
    getOperationalAdminStudents(),
    getWhatsappGroupMapRows(),
    getIncomingMessageInboxRows(),
    getTutorPhoneRows(),
  ]);
  const tutorPhoneLookup = buildTutorPhoneLookup(tutorPhoneRows);

  // Auto-captured group traffic: only confirmed FC groups get through, staff
  // messages become reply evidence on open items instead of new rows, and
  // no-signal parent messages land pre-archived.
  const isAutoCapture = normalised.source === AUTO_CAPTURE_SOURCE;
  if (isAutoCapture) {
    const confirmedGroup = groupMapRows.find((row) => row.chatId === normalised.chatId && row.status === 'confirmed');
    if (!confirmedGroup) {
      return { skipped: 'not_confirmed_group', incomingId: normalised.incomingId };
    }

    // School-side messages never become inbox rows. Our own account / a staff
    // number, or a tutor replying in the lesson group from their own number
    // (Tutor_Phones) — a tutor's reply is evidence someone from school engaged,
    // not a parent message to classify, and never a "handled" state (only Tom/Finn
    // stamping done marks handled). Stamp open items as reply evidence, naming the
    // tutor when we know them. When the number doesn't resolve (LID-addressed
    // groups can hide it), fall back to the sender's push name against this
    // group's own tutor from the group map.
    const tutorName = matchTutorPhone(payload, tutorPhoneLookup)
      || matchTutorSenderName(normalised.senderName, confirmedGroup.tutorName);
    if (tutorName || isSchoolStaffMessage(payload, process.env.INCOMING_STAFF_PHONES || '')) {
      const openRows = existingRows.filter((row) => (
        row.chatId === normalised.chatId
        && ['inbox', 'needs_review'].includes(row.status)
        && !row.schoolRepliedAt
      ));
      for (const row of openRows) {
        await upsertIncomingMessageInboxRow({
          ...row,
          schoolRepliedAt: normalised.messageAt || normalised.capturedAt,
          schoolRepliedBy: tutorName || normalised.senderName || 'school',
        });
      }
      return { replyEvidence: true, stamped: openRows.length, schoolReplierName: tutorName || normalised.senderName || 'school', incomingId: normalised.incomingId };
    }
  }

  const fresh = buildIncomingMessageRecord({
    ...payload,
    capturedBy: payload?.capturedBy || payload?.captured_by || actorEmail,
  }, { students, groupMapRows });

  if (isAutoCapture && fresh.status === 'inbox') {
    fresh.status = decideAutoCaptureStatus(fresh);
    if (fresh.status === 'ignored') {
      fresh.matchReasons = [fresh.matchReasons, 'auto-archived: no operational signal (auto-captured group message)'].filter(Boolean).join(' | ');
    }
  }

  // Bridge replays (reconnect/restart) re-send the same star event; only write
  // when the capture is new or recovers text for a placeholder row.
  const existing = existingRows.find((entry) => entry.incomingId === fresh.incomingId);
  const { action, record } = mergeIncomingCapture(existing, fresh);
  if (action === 'skip') {
    return record;
  }

  await upsertIncomingMessageInboxRow(record);

  const firstPassGroupMapRecord = buildWhatsappGroupMapRecord(record);
  if (firstPassGroupMapRecord) {
    const existingGroup = groupMapRows.find((entry) => entry.chatId === record.chatId);
    const groupMapRecord = buildWhatsappGroupMapRecord(record, existingGroup);
    await upsertWhatsappGroupMapRow(groupMapRecord);
  }

  return record;
}

// The reviewer pasted the real message text into a placeholder row: re-run
// classification/matching on the real text and reopen the row for action.
export async function updateIncomingMessageText({ incomingId = '', messageText = '', actorEmail = '' } = {}) {
  const incomingKey = `${incomingId || ''}`.trim();
  if (!incomingKey) {
    throw new Error('incomingId is required');
  }

  const [existingRows, students, groupMapRows] = await Promise.all([
    getIncomingMessageInboxRows(),
    getOperationalAdminStudents(),
    getWhatsappGroupMapRows(),
  ]);
  const row = existingRows.find((entry) => entry.incomingId === incomingKey);
  if (!row) {
    throw new Error(`Incoming message ${incomingKey} was not found`);
  }

  const next = applyIncomingMessageTextUpdate(row, { messageText, students, groupMapRows, actorEmail });
  await upsertIncomingMessageInboxRow(next);
  return next;
}

export async function updateIncomingMessageReview({ incomingId, status = '', reviewNote = '', createdPlanningId = '', resolutionType = '', actorEmail = '' }) {
  const existing = await getIncomingMessageInboxRows();
  const row = existing.find((entry) => entry.incomingId === incomingId);
  if (!row) {
    throw new Error(`Incoming message ${incomingId} was not found`);
  }

  const nextStatus = status || row.status || 'inbox';
  const nextPlanningId = typeof createdPlanningId === 'string' ? createdPlanningId : row.createdPlanningId;
  const next = {
    ...row,
    status: nextStatus,
    reviewNote: typeof reviewNote === 'string' ? reviewNote : row.reviewNote,
    createdPlanningId: nextPlanningId,
    resolutionType: deriveIncomingMessageResolutionType({ resolutionType, status: nextStatus, createdPlanningId: nextPlanningId }),
    reviewedBy: actorEmail || row.reviewedBy || '',
    reviewedAt: new Date().toISOString(),
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
  actorEmail = '',
  status = 'needs_review',
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
  const selectedStatus = `${status || 'needs_review'}`.trim();
  const selectedStudent = students.find((student) => student.mmsId === selectedStudentId);
  const correctionReasons = [];

  const next = {
    ...row,
    status: ['inbox', 'needs_review', 'converted', 'ignored'].includes(selectedStatus) ? selectedStatus : 'needs_review',
    reviewedBy: actorEmail || row.reviewedBy || '',
    reviewedAt: new Date().toISOString(),
  };
  next.resolutionType = deriveIncomingMessageResolutionType({ status: next.status, createdPlanningId: next.createdPlanningId });

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
    const groupStudent = selectedStudent || students.find((student) => student.mmsId === next.matchedMmsId);
    const existingGroup = groupRows.find((entry) => entry.chatId === next.chatId);
    const groupMapRecord = buildWhatsappGroupMapRecord({
      ...next,
      groupMapStatus: 'confirmed',
      matchedFcId: groupStudent?.fcStudentId || '',
      parentName: [groupStudent?.parentFirstName, groupStudent?.parentLastName].filter(Boolean).join(' ').trim(),
      parentPhone: groupStudent?.contactNumber || '',
      tutorName: groupStudent?.tutor || groupStudent?.registryTutor || '',
      instrument: groupStudent?.instrument || '',
      confirmedBy: actorEmail,
      confirmedAt: new Date().toISOString(),
    }, existingGroup);
    if (groupMapRecord) {
      await upsertWhatsappGroupMapRow(groupMapRecord);
    }
  }

  return next;
}

// Closes the loop: apply any final correction, then create a linked Planning_Item
// and hand back a copy-paste WhatsApp reply. The planning id is derived from the
// incoming id so re-converting upserts the same task instead of duplicating.
export async function convertIncomingMessageToPlanning({
  incomingId,
  category = '',
  matchedMmsId = '',
  reviewNote = '',
  confirmGroupMap = false,
  actorEmail = '',
} = {}) {
  const incomingKey = `${incomingId || ''}`.trim();
  if (!incomingKey) {
    throw new Error('incomingId is required');
  }

  const corrected = await correctIncomingMessage({
    incomingId: incomingKey,
    category,
    matchedMmsId,
    reviewNote,
    confirmGroupMap,
    actorEmail,
    status: 'converted',
  });

  const students = await getOperationalAdminStudents();
  const student = students.find((entry) => entry.mmsId === corrected.matchedMmsId) || {};

  // One extraction pass feeds both the reply (dates confirmed back to the
  // parent) and the plan (absence categories become a structured pause item).
  const extraction = extractIncomingMessageDates(corrected);
  const replyTemplate = buildIncomingReplyTemplate({
    category: corrected.suspectedCategory,
    senderName: corrected.senderName,
    parentName: [student.parentFirstName, student.parentLastName].filter(Boolean).join(' ').trim(),
    studentName: corrected.matchedStudentName || student.fullName || '',
    tutorName: student.tutor || student.registryTutor || '',
    startDate: extraction.startDate,
    returnDate: extraction.returnDate,
  });

  const planningId = `${corrected.createdPlanningId || ''}`.trim() || `planning_${corrected.incomingId}`;
  const draft = buildIncomingPlanningDraft({ record: corrected, student, replyTemplate, extraction });
  const planningItem = await savePlanningItem({
    planningId,
    item: draft,
    actorEmail,
    progressNote: `Created from incoming WhatsApp message ${corrected.incomingId}.`,
  });

  await upsertIncomingMessageInboxRow({
    ...corrected,
    status: 'converted',
    createdPlanningId: planningItem.planningId,
    resolutionType: 'planning_task',
  });

  return {
    row: { ...corrected, status: 'converted', createdPlanningId: planningItem.planningId, resolutionType: 'planning_task' },
    planningId: planningItem.planningId,
    replyTemplate,
  };
}

// Bulk-imports every First Chord group the bridge can see. Metadata only — no
// message content. Confirmed groups are never downgraded; they only get their
// name/last-active refreshed. Everything else lands as a `review` hint for
// human triage in the group map.
export async function syncWhatsappGroups({ groups = [], actorEmail = '' } = {}) {
  const [students, existingRows] = await Promise.all([
    getOperationalAdminStudents(),
    getWhatsappGroupMapRows(),
  ]);

  const { records, summary } = buildGroupSyncPlan({ groups, students });
  const existingByChatId = new Map(existingRows.map((row) => [row.chatId, row]));

  // Build every row in memory, then write them in one batched call — a full
  // sync can touch 100+ groups, and per-row upserts time out the request.
  const rowsToWrite = [];
  for (const record of records) {
    const existing = existingByChatId.get(record.chatId);

    // Don't let a fresh guess overwrite a human-confirmed group — just refresh
    // the display name and last-active timestamp.
    if (existing?.status === 'confirmed') {
      const refreshed = buildWhatsappGroupMapRecord({
        chatId: record.chatId,
        chatName: record.chatName,
        messageAt: record.lastActiveAt,
        groupMapStatus: 'confirmed',
      }, existing);
      if (refreshed) rowsToWrite.push(refreshed);
      continue;
    }

    if (existing?.status === 'ignored') {
      continue;
    }

    const student = record.matchedMmsId
      ? students.find((entry) => entry.mmsId === record.matchedMmsId)
      : null;

    const groupMapRecord = buildWhatsappGroupMapRecord({
      chatId: record.chatId,
      chatName: record.chatName,
      messageAt: record.lastActiveAt,
      matchedMmsId: record.matchedMmsId,
      matchedFcId: student?.fcStudentId || '',
      matchedStudentName: record.matchedStudentName,
      matchConfidence: record.matchConfidence,
      matchReasons: record.matchReasons,
      instrument: student?.instrument || record.instrument || '',
      groupMapStatus: decideSyncedGroupStatus(existing?.status || '', Boolean(record.matchedMmsId)),
    }, existing || {});
    if (groupMapRecord) rowsToWrite.push(groupMapRecord);
  }

  await batchUpsertWhatsappGroupMapRows(rowsToWrite);

  return { summary };
}

// Confirms or ignores a WhatsApp group directly from the group map (no message
// needed). Confirming stores the full student context so future messages from
// the group match at high confidence.
export async function reviewWhatsappGroup({ chatId = '', matchedMmsId = '', status = 'confirmed', actorEmail = '' } = {}) {
  const chatKey = `${chatId || ''}`.trim();
  if (!isWhatsappGroupChatId(chatKey)) {
    throw new Error('Only WhatsApp group chats can be reviewed in the group map');
  }

  const nextStatus = ['confirmed', 'ignored', 'review'].includes(status) ? status : 'confirmed';
  const [students, groupRows] = await Promise.all([
    getOperationalAdminStudents(),
    getWhatsappGroupMapRows(),
  ]);
  const existing = groupRows.find((row) => row.chatId === chatKey) || {};

  if (nextStatus === 'confirmed') {
    const student = students.find((entry) => entry.mmsId === `${matchedMmsId}`.trim());
    if (!student) {
      throw new Error('A matched student is required to confirm a group');
    }
    const record = buildWhatsappGroupMapRecord({
      chatId: chatKey,
      chatName: existing.chatName || '',
      matchedMmsId: student.mmsId || '',
      matchedFcId: student.fcStudentId || '',
      matchedStudentName: student.fullName || '',
      parentName: [student.parentFirstName, student.parentLastName].filter(Boolean).join(' ').trim(),
      parentPhone: student.contactNumber || '',
      tutorName: student.tutor || student.registryTutor || '',
      instrument: student.instrument || existing.instrument || '',
      matchConfidence: 'high',
      matchReasons: 'confirmed from group sync review',
      groupMapStatus: 'confirmed',
      confirmedBy: actorEmail,
      confirmedAt: new Date().toISOString(),
    }, existing);
    await upsertWhatsappGroupMapRow(record);
    return record;
  }

  const record = buildWhatsappGroupMapRecord({
    chatId: chatKey,
    chatName: existing.chatName || '',
    groupMapStatus: nextStatus,
  }, existing);
  await upsertWhatsappGroupMapRow(record);
  return record;
}

// Manually attach an additional student to a group (siblings sharing one chat).
// Stored as a comma list in `additional_mms_ids`; matching then disambiguates
// by the name in each message.
export async function addStudentToGroup({ chatId = '', mmsId = '', actorEmail = '' } = {}) {
  const chatKey = `${chatId || ''}`.trim();
  const studentId = `${mmsId || ''}`.trim();
  if (!isWhatsappGroupChatId(chatKey)) {
    throw new Error('Only WhatsApp group chats can hold multiple students');
  }
  if (!studentId) {
    throw new Error('A student is required');
  }

  const [students, groupRows] = await Promise.all([
    getOperationalAdminStudents(),
    getWhatsappGroupMapRows(),
  ]);
  const existing = groupRows.find((row) => row.chatId === chatKey);
  if (!existing) {
    throw new Error(`Group ${chatKey} was not found`);
  }
  if (!students.find((entry) => entry.mmsId === studentId)) {
    throw new Error(`Student ${studentId} was not found`);
  }

  // Already the primary or already added → no-op.
  const current = `${existing.additionalMmsIds || ''}`.split(',').map((id) => id.trim()).filter(Boolean);
  if (existing.matchedMmsId === studentId || current.includes(studentId)) {
    return existing;
  }

  const record = buildWhatsappGroupMapRecord({
    chatId: chatKey,
    additionalMmsIds: [...current, studentId].join(','),
    groupMapStatus: existing.status || 'confirmed',
    confirmedBy: actorEmail || existing.confirmedBy || '',
    confirmedAt: existing.confirmedAt || new Date().toISOString(),
  }, existing);
  await upsertWhatsappGroupMapRow(record);
  return record;
}

export async function deleteIncomingMessage({ incomingId = '' } = {}) {
  const incomingKey = `${incomingId || ''}`.trim();
  if (!incomingKey) {
    throw new Error('incomingId is required');
  }

  return deleteIncomingMessageInboxRow(incomingKey);
}
