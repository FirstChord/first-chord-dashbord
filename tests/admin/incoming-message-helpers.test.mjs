import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePauseWindowsFromPlanning } from '../../lib/admin/pause-forecast.mjs';
import {
  applyIncomingMessageTextUpdate,
  buildGroupSyncPlan,
  extractIncomingMessageDates,
  buildIncomingMessageId,
  buildIncomingMessageRecord,
  buildIncomingPlanningDraft,
  buildIncomingReplyTemplate,
  buildWhatsappGroupMapRecord,
  classifyIncomingMessage,
  decideAutoCaptureStatus,
  decideSyncedGroupStatus,
  detectInstrumentInName,
  groupIncomingMessages,
  isIncomingPlaceholderText,
  isOneTapConvertEligible,
  isSchoolStaffMessage,
  isWhatsappGroupChatId,
  matchGroupToStudent,
  matchIncomingMessageToStudent,
  mergeIncomingCapture,
  normaliseIncomingMessagePayload,
  normalisePhone,
} from '../../lib/admin/incoming-message-helpers.mjs';

const students = [
  {
    mmsId: 'sdt_alex',
    fcStudentId: 'fc_alex',
    firstName: 'Alex',
    lastName: 'Chang',
    fullName: 'Alex Chang',
    parentFirstName: 'Mina',
    parentLastName: 'Chang',
    contactNumber: '07788 626616',
    tutor: 'Dean Louden',
    instrument: 'Guitar',
  },
  {
    mmsId: 'sdt_sam',
    fcStudentId: 'fc_sam',
    firstName: 'Sam',
    lastName: 'Reid',
    fullName: 'Sam Reid',
    parentFirstName: 'Laura',
    parentLastName: 'Reid',
    contactNumber: '07800 111222',
  },
];

test('normalisePhone makes UK mobile forms comparable', () => {
  assert.equal(normalisePhone('+44 7788 626616'), '07788626616');
  assert.equal(normalisePhone('447788626616'), '07788626616');
  assert.equal(normalisePhone('07788 626616'), '07788626616');
});

test('normaliseIncomingMessagePayload accepts bridge and manual field names', () => {
  const row = normaliseIncomingMessagePayload({
    source: 'whatsapp_starred',
    message_id: 'abc',
    message_text: 'Alex is away next week',
    sender_phone: '+44 7788 626616',
  }, { now: new Date('2026-06-30T10:00:00Z') });

  assert.equal(row.source, 'whatsapp_starred');
  assert.equal(row.externalMessageId, 'abc');
  assert.equal(row.messageText, 'Alex is away next week');
  assert.equal(row.senderPhone, '+44 7788 626616');
  assert.equal(row.capturedAt, '2026-06-30T10:00:00.000Z');
  assert.match(row.incomingId, /^incoming_/u);
});

test('classifyIncomingMessage detects absence/pause before general', () => {
  assert.equal(classifyIncomingMessage('Alex cannot make his lesson on Friday').category, 'one_off_absence');
  assert.equal(classifyIncomingMessage('Can we pause Sam for two weeks?').category, 'extended_absence');
  assert.equal(classifyIncomingMessage('We need to stop lessons after July').category, 'leaving');
  assert.equal(classifyIncomingMessage('The Stripe payment failed').category, 'payment');
});

test('classifyIncomingMessage treats summer last-lesson wording as a break, not leaving', () => {
  const result = classifyIncomingMessage('Yahya will be away for 1 week camp then going away for holiday so last lessons will be 15 of July');
  assert.equal(result.category, 'summer_break');
  assert.match(result.reasons.join(' '), /summer|holiday/u);
});

test('matchIncomingMessageToStudent prefers phone matches', () => {
  const match = matchIncomingMessageToStudent({
    senderPhone: '+44 7788 626616',
    messageText: 'Away next Friday',
  }, students);

  assert.equal(match.matchedMmsId, 'sdt_alex');
  assert.equal(match.matchConfidence, 'high');
  assert.match(match.matchReasons, /phone/u);
});

test('matchIncomingMessageToStudent can match by full name and unique first name', () => {
  const full = matchIncomingMessageToStudent({ messageText: 'Alex Chang is away next week' }, students);
  assert.equal(full.matchedMmsId, 'sdt_alex');
  assert.equal(full.matchConfidence, 'high');

  const first = matchIncomingMessageToStudent({ messageText: 'Sam is sick today' }, students);
  assert.equal(first.matchedMmsId, 'sdt_sam');
  assert.equal(first.matchConfidence, 'low');
});

test('buildIncomingMessageRecord adds category, match, and raw payload', () => {
  const record = buildIncomingMessageRecord({
    source: 'manual_paste',
    messageText: 'Mina here, Alex Chang is on holiday next week',
  }, { students, now: new Date('2026-06-30T10:00:00Z') });

  assert.equal(record.suspectedCategory, 'extended_absence');
  assert.equal(record.matchedMmsId, 'sdt_alex');
  assert.equal(record.status, 'inbox');
  assert.match(record.matchReasons, /attendance|pause|lesson cover/u);
  assert.match(record.rawJson, /Alex Chang/u);
});

test('buildWhatsappGroupMapRecord stores only WhatsApp group chats', () => {
  assert.equal(isWhatsappGroupChatId('120363400087109552@g.us'), true);
  assert.equal(isWhatsappGroupChatId('19980372422675@lid'), false);

  const record = buildIncomingMessageRecord({
    source: 'whatsapp_starred',
    external_message_id: 'abc',
    chat_id: '120363400087109552@g.us',
    chat_name: 'Alex small group',
    sender_name: 'Mina',
    sender_phone: '+44 7788 626616',
    message_text: 'Alex is away next Friday',
    message_at: '2026-06-30T09:00:00Z',
  }, { students, now: new Date('2026-06-30T10:00:00Z') });

  const map = buildWhatsappGroupMapRecord(record);
  assert.equal(map.chatId, '120363400087109552@g.us');
  assert.equal(map.chatName, 'Alex small group');
  assert.equal(map.lastIncomingId, record.incomingId);
  assert.equal(map.matchedMmsId, 'sdt_alex');
  assert.equal(map.status, 'review');

  assert.equal(buildWhatsappGroupMapRecord({ ...record, chatId: '19980372422675@lid' }), null);
});

test('buildWhatsappGroupMapRecord stores confirmed student and parent context', () => {
  const map = buildWhatsappGroupMapRecord({
    chatId: '120363400087109552@g.us',
    chatName: 'Alex small group',
    matchedMmsId: 'sdt_alex',
    matchedFcId: 'fc_alex',
    matchedStudentName: 'Alex Chang',
    parentName: 'Mina Chang',
    parentPhone: '07788 626616',
    tutorName: 'Dean Louden',
    instrument: 'Guitar',
    groupMapStatus: 'confirmed',
    confirmedBy: 'finn@example.com',
    confirmedAt: '2026-07-01T10:00:00.000Z',
  });

  assert.equal(map.matchedMmsId, 'sdt_alex');
  assert.equal(map.matchedFcId, 'fc_alex');
  assert.equal(map.parentName, 'Mina Chang');
  assert.equal(map.parentPhone, '07788 626616');
  assert.equal(map.tutorName, 'Dean Louden');
  assert.equal(map.instrument, 'Guitar');
  assert.equal(map.status, 'confirmed');
  assert.equal(map.confirmedBy, 'finn@example.com');
  assert.equal(map.confirmedAt, '2026-07-01T10:00:00.000Z');
});

test('confirmed WhatsApp group map beats weaker text/name guesses', () => {
  const match = matchIncomingMessageToStudent({
    chatId: '120363400087109552@g.us',
    senderName: 'Mariam',
    messageText: 'Aria is mentioned, but this group is actually for Sam',
  }, students, {
    groupMapRows: [{
      chatId: '120363400087109552@g.us',
      matchedMmsId: 'sdt_sam',
      matchedStudentName: 'Sam Reid',
      status: 'confirmed',
    }],
  });

  assert.equal(match.matchedMmsId, 'sdt_sam');
  assert.equal(match.matchConfidence, 'high');
  assert.match(match.matchReasons, /confirmed WhatsApp group/u);
});

test('buildIncomingReplyTemplate produces a per-category parent draft', () => {
  const absence = buildIncomingReplyTemplate({
    category: 'one_off_absence',
    senderName: 'Mina Chang',
    studentName: 'Alex Chang',
    tutorName: 'Dean Louden',
  });
  assert.match(absence, /^Hi Mina/u);
  assert.match(absence, /Alex/u);
  assert.match(absence, /Dean/u);

  const leaving = buildIncomingReplyTemplate({ category: 'leaving', senderName: 'Laura', studentName: 'Sam Reid' });
  assert.match(leaving, /sorry to see Sam go/u);

  // Unknown category still returns a safe acknowledgement.
  assert.match(buildIncomingReplyTemplate({ category: 'wat', senderName: 'Jo' }), /^Hi Jo/u);
});

test('buildIncomingPlanningDraft maps a reviewed message into a planning item', () => {
  const draft = buildIncomingPlanningDraft({
    record: {
      suspectedCategory: 'extended_absence',
      matchedMmsId: 'sdt_alex',
      matchedStudentName: 'Alex Chang',
      senderName: 'Mina Chang',
      senderPhone: '07788 626616',
      messageText: 'Alex is away for two weeks',
      source: 'whatsapp_starred',
    },
    student: { parentFirstName: 'Mina' },
    replyTemplate: 'Hi Mina! Thanks for letting us know.',
  });

  // Duration but no anchor date → stays a generic action, with the duration noted.
  assert.equal(draft.title, 'Extended absence: Alex Chang');
  assert.equal(draft.itemType, 'action');
  assert.equal(draft.status, 'active');
  assert.equal(draft.area, 'workflow');
  assert.deepEqual(draft.linkedStudentIds, ['sdt_alex']);
  assert.match(draft.notes, /Alex is away for two weeks/u);
  assert.match(draft.notes, /Suggested reply/u);
  assert.match(draft.notes, /Dates spotted in message: 2 week/u);
});

test('an extended absence with dates converts to a structured pause plan the forecast can read', () => {
  const draft = buildIncomingPlanningDraft({
    record: {
      suspectedCategory: 'extended_absence',
      matchedMmsId: 'sdt_alex',
      matchedStudentName: 'Alex Chang',
      senderName: 'Mina Chang',
      messageText: 'Alex will be away for holiday from the 24th of June till the 21st of July',
      messageAt: '2026-06-19T10:00:00.000Z',
      source: 'whatsapp_starred',
    },
    student: { parentFirstName: 'Mina' },
    replyTemplate: 'Hi Mina! Thanks for letting us know.',
    now: new Date('2026-06-19T10:00:00Z'),
  });

  assert.match(draft.title, /^Pause Alex Chang from/u);
  assert.equal(draft.area, 'admin');
  assert.deepEqual(draft.linkedStudentIds, ['sdt_alex']);
  assert.match(draft.notes, /First lesson to pause date: 2026-06-24/u);
  assert.match(draft.notes, /Returning from date: 2026-07-21/u);
  // The original message and reply still travel with the plan.
  assert.match(draft.notes, /Alex will be away for holiday/u);
  assert.match(draft.notes, /Suggested reply/u);

  // Round-trip: the pause forecast parses the window from this exact item.
  const { windows, unparsed } = parsePauseWindowsFromPlanning([{
    planningId: 'planning_incoming_1',
    title: draft.title,
    notes: draft.notes,
    status: draft.status,
    linkedStudentId: draft.linkedStudentIds.join(','),
  }]);
  assert.equal(unparsed.length, 0);
  assert.equal(windows.length, 1);
  assert.equal(windows[0].mmsId, 'sdt_alex');
  assert.equal(windows[0].type, 'away');
  assert.equal(windows[0].start.toISOString().slice(0, 10), '2026-06-24');
  assert.equal(windows[0].end.toISOString().slice(0, 10), '2026-07-21');
});

test('a one-off absence with a date converts to a single-lesson pause plan', () => {
  const draft = buildIncomingPlanningDraft({
    record: {
      suspectedCategory: 'one_off_absence',
      matchedMmsId: 'sdt_alex',
      matchedStudentName: 'Alex Chang',
      senderName: 'Mina Chang',
      messageText: 'Alex cannot make his lesson next Friday',
      messageAt: '2026-06-29T08:00:00.000Z',
      source: 'whatsapp_starred',
    },
    now: new Date('2026-06-29T10:00:00Z'),
  });

  assert.match(draft.title, /^Pause Alex Chang lesson on/u);
  assert.match(draft.notes, /Lesson date: 2026-07-03/u);

  const { windows } = parsePauseWindowsFromPlanning([{
    planningId: 'planning_incoming_2',
    title: draft.title,
    notes: draft.notes,
    linkedStudentId: 'sdt_alex',
  }]);
  assert.equal(windows.length, 1);
  assert.equal(windows[0].type, 'single');
});

test('the structured pause path needs a matched student', () => {
  const draft = buildIncomingPlanningDraft({
    record: {
      suspectedCategory: 'extended_absence',
      senderName: 'Mina Chang',
      messageText: 'We are away from the 24th of June till the 21st of July',
      messageAt: '2026-06-19T10:00:00.000Z',
      source: 'whatsapp_starred',
    },
  });

  assert.match(draft.title, /^Extended absence/u);
  assert.match(draft.notes, /Dates spotted in message: from 2026-06-24 · back 2026-07-21/u);
});

test('buildIncomingReplyTemplate confirms extracted dates back to the parent', () => {
  const dated = buildIncomingReplyTemplate({
    category: 'extended_absence',
    senderName: 'Mina Chang',
    studentName: 'Alex Chang',
    tutorName: 'Dean Louden',
    startDate: '2026-06-24',
    returnDate: '2026-07-21',
  });
  assert.match(dated, /away from Wednesday 24 June/u);
  assert.match(dated, /pick back up from Tuesday 21 July/u);

  const oneOff = buildIncomingReplyTemplate({
    category: 'one_off_absence',
    senderName: 'Mina',
    studentName: 'Alex',
    startDate: '2026-07-03',
  });
  assert.match(oneOff, /can’t make it on Friday 3 July/u);

  // No dates → the original ask-for-return-date wording still applies.
  const undated = buildIncomingReplyTemplate({ category: 'extended_absence', senderName: 'Mina', studentName: 'Alex' });
  assert.match(undated, /Whenever you have the return date/u);
});

test('extractIncomingMessageDates resolves relative dates against the message time', () => {
  const result = extractIncomingMessageDates({
    messageText: 'Sam is off sick today',
    messageAt: '2026-07-01T08:00:00.000Z',
    capturedAt: '2026-07-06T16:00:00.000Z',
  });
  assert.equal(result.startDate, '2026-07-01');
});

test('detectInstrumentInName spots FC instruments by whole token, not substring', () => {
  assert.equal(detectInstrumentInName('Alex Chang Guitar Mondays'), 'guitar');
  assert.equal(detectInstrumentInName('Sam Reid — Piano'), 'piano');
  assert.equal(detectInstrumentInName('Ukulele Orchestra 2026', ['Ukulele Orchestra']), 'ukulele');
  // No instrument token → not a First Chord group.
  assert.equal(detectInstrumentInName('Family holiday plans'), '');
  // "bass" as a token matches, but not inside another word like "embassy".
  assert.equal(detectInstrumentInName('British Embassy chat'), '');
});

test('matchGroupToStudent prefers a participant phone match over the title name', () => {
  const byPhone = matchGroupToStudent(
    { chatName: 'Guitar group', participantPhones: ['+44 7788 626616', '+44 7000 000000'] },
    students,
  );
  assert.equal(byPhone.matchedMmsId, 'sdt_alex');
  assert.equal(byPhone.matchConfidence, 'high');
  assert.match(byPhone.matchReasons, /number matches/u);

  const byName = matchGroupToStudent({ chatName: 'Sam Reid Piano', participantPhones: [] }, students);
  assert.equal(byName.matchedMmsId, 'sdt_sam');
});

test('matchGroupToStudent handles the real "{First} {Instrument} Lessons {emoji}" title', () => {
  // First name only + the student's instrument, no phone — the common case.
  const match = matchGroupToStudent({ chatName: 'Alex Guitar Lessons 🎸', participantPhones: [] }, students);
  assert.equal(match.matchedMmsId, 'sdt_alex');
  assert.equal(match.matchConfidence, 'high');
  assert.match(match.matchReasons, /first name and instrument/u);
});

test('buildGroupSyncPlan keeps active FC groups, drops non-FC and stale ones', () => {
  const now = new Date('2026-07-01T00:00:00Z');
  const plan = buildGroupSyncPlan({
    now,
    students,
    groups: [
      { chatId: '111@g.us', chatName: 'Alex Chang Guitar', participantPhones: ['+447788626616'], lastActiveAt: '2026-06-20T00:00:00Z' },
      { chatId: '222@g.us', chatName: 'Family chat', participantPhones: [], lastActiveAt: '2026-06-20T00:00:00Z' },
      { chatId: '333@g.us', chatName: 'Old Piano group', participantPhones: [], lastActiveAt: '2025-01-01T00:00:00Z' },
      { chatId: '444@g.us', chatName: 'Sam Reid Piano', participantPhones: [], lastActiveAt: '' },
      { chatId: '19980372422675@lid', chatName: 'Guitar not-a-group', participantPhones: [], lastActiveAt: '' },
    ],
  });

  assert.equal(plan.summary.kept, 2);
  assert.equal(plan.summary.skippedNoInstrument, 1);
  assert.equal(plan.summary.skippedInactive, 1);
  assert.equal(plan.summary.skippedNotGroup, 1);
  assert.deepEqual(plan.records.map((row) => row.chatId).sort(), ['111@g.us', '444@g.us']);

  const alex = plan.records.find((row) => row.chatId === '111@g.us');
  assert.equal(alex.matchedMmsId, 'sdt_alex');
  assert.equal(alex.instrument, 'guitar');
});

test('decideSyncedGroupStatus buckets matched vs unmatched without downgrading decisions', () => {
  assert.equal(decideSyncedGroupStatus('', true), 'review');
  assert.equal(decideSyncedGroupStatus('', false), 'unmatched');
  assert.equal(decideSyncedGroupStatus('unmatched', true), 'review'); // upgrade once matched
  assert.equal(decideSyncedGroupStatus('review', false), 'unmatched'); // re-bucket auto-review when no longer matched
  assert.equal(decideSyncedGroupStatus('confirmed', false), 'confirmed'); // keep human decision
  assert.equal(decideSyncedGroupStatus('ignored', true), 'ignored'); // keep human decision
});

test('shared sibling group matches by name in the message, flags ambiguous otherwise', () => {
  const groupMapRows = [{
    chatId: '120363400087109552@g.us',
    matchedMmsId: 'sdt_alex',
    matchedStudentName: 'Alex Chang',
    additionalMmsIds: 'sdt_sam',
    status: 'confirmed',
  }];

  const named = matchIncomingMessageToStudent(
    { chatId: '120363400087109552@g.us', messageText: 'Sam is off on Friday' },
    students,
    { groupMapRows },
  );
  assert.equal(named.matchedMmsId, 'sdt_sam');
  assert.equal(named.matchConfidence, 'high');

  const ambiguous = matchIncomingMessageToStudent(
    { chatId: '120363400087109552@g.us', messageText: 'We are away next week' },
    students,
    { groupMapRows },
  );
  assert.equal(ambiguous.matchedMmsId, '');
  assert.equal(ambiguous.matchConfidence, 'none');
  assert.match(ambiguous.matchReasons, /needs manual review/u);
});

test('buildWhatsappGroupMapRecord carries additional_mms_ids for sibling groups', () => {
  const record = buildWhatsappGroupMapRecord({
    chatId: '120363400087109552@g.us',
    additionalMmsIds: 'sdt_sam',
    groupMapStatus: 'confirmed',
  }, { chatId: '120363400087109552@g.us', matchedMmsId: 'sdt_alex', status: 'confirmed' });
  assert.equal(record.additionalMmsIds, 'sdt_sam');
  assert.equal(record.matchedMmsId, 'sdt_alex');
});

test('buildIncomingMessageId is stable across star replays when an external id exists', () => {
  const base = { source: 'whatsapp_starred', externalMessageId: '3A5D3041', chatId: '111@g.us' };
  const placeholderCapture = buildIncomingMessageId({
    ...base,
    messageText: '[Message content unavailable - star update arrived before cache]',
    messageAt: '2026-07-06T15:29:00.000Z',
  });
  const healedCapture = buildIncomingMessageId({
    ...base,
    messageText: 'Alex is away next Friday',
    messageAt: '2026-07-01T09:00:00.000Z',
  });
  assert.equal(placeholderCapture, healedCapture);

  // Same message id in a different chat is a different row.
  assert.notEqual(placeholderCapture, buildIncomingMessageId({ ...base, chatId: '222@g.us' }));

  // Manual pastes have no external id — text still distinguishes them.
  const pasteA = buildIncomingMessageId({ source: 'manual_paste', messageText: 'Alex is away' });
  const pasteB = buildIncomingMessageId({ source: 'manual_paste', messageText: 'Sam is away' });
  assert.notEqual(pasteA, pasteB);
});

test('isIncomingPlaceholderText spots bridge placeholder bodies only', () => {
  assert.equal(isIncomingPlaceholderText('[Message content unavailable - star update arrived before cache]'), true);
  assert.equal(isIncomingPlaceholderText('[Media or unsupported message]'), true);
  assert.equal(isIncomingPlaceholderText('Alex is away next Friday'), false);
  assert.equal(isIncomingPlaceholderText(''), false);
});

test('placeholder captures land as needs_review with a paste hint', () => {
  const record = buildIncomingMessageRecord({
    source: 'whatsapp_starred',
    external_message_id: '3A5D3041',
    chat_id: '111@g.us',
    message_text: '[Message content unavailable - star update arrived before cache]',
  }, { students });

  assert.equal(record.status, 'needs_review');
  assert.equal(record.suspectedCategory, 'general');
  assert.match(record.matchReasons, /paste the original message/iu);
});

test('mergeIncomingCapture skips replays and heals placeholders without losing review state', () => {
  const fresh = buildIncomingMessageRecord({
    source: 'whatsapp_starred',
    external_message_id: '3A5D3041',
    chat_id: '111@g.us',
    message_text: 'Alex Chang is on holiday for two weeks',
  }, { students });

  // New capture inserts.
  assert.equal(mergeIncomingCapture(null, fresh).action, 'insert');

  // Replay over a row that already has text is a no-op.
  const stored = { ...fresh, status: 'converted', reviewNote: 'handled' };
  const replay = mergeIncomingCapture(stored, fresh);
  assert.equal(replay.action, 'skip');
  assert.equal(replay.record, stored);

  // Replay with recovered text heals a placeholder but keeps human decisions.
  const placeholderRow = {
    ...fresh,
    messageText: '[Message content unavailable - star update arrived before cache]',
    suspectedCategory: 'general',
    status: 'converted',
    reviewNote: 'chased on WhatsApp',
    createdPlanningId: 'planning_incoming_1',
    capturedAt: '2026-07-06T15:29:00.000Z',
  };
  const healed = mergeIncomingCapture(placeholderRow, fresh);
  assert.equal(healed.action, 'heal');
  assert.equal(healed.record.messageText, 'Alex Chang is on holiday for two weeks');
  assert.equal(healed.record.suspectedCategory, 'extended_absence');
  assert.equal(healed.record.status, 'converted');
  assert.equal(healed.record.reviewNote, 'chased on WhatsApp');
  assert.equal(healed.record.createdPlanningId, 'planning_incoming_1');
  assert.equal(healed.record.capturedAt, '2026-07-06T15:29:00.000Z');
  assert.match(healed.record.matchReasons, /healed an earlier placeholder/u);

  // A second placeholder replay never overwrites the placeholder row.
  const placeholderReplay = mergeIncomingCapture(placeholderRow, { ...placeholderRow });
  assert.equal(placeholderReplay.action, 'skip');
});

test('applyIncomingMessageTextUpdate re-classifies pasted text and reopens the row', () => {
  const row = {
    incomingId: 'incoming_1',
    chatId: '111@g.us',
    messageText: '[Message content unavailable - star update arrived before cache]',
    suspectedCategory: 'general',
    status: 'needs_review',
  };

  const next = applyIncomingMessageTextUpdate(row, {
    messageText: 'Alex Chang is on holiday for two weeks',
    students,
    actorEmail: 'finn@example.com',
    now: new Date('2026-07-06T17:00:00Z'),
  });

  assert.equal(next.messageText, 'Alex Chang is on holiday for two weeks');
  assert.equal(next.suspectedCategory, 'extended_absence');
  assert.equal(next.matchedMmsId, 'sdt_alex');
  assert.equal(next.status, 'inbox');
  assert.equal(next.reviewedBy, 'finn@example.com');
  assert.match(next.matchReasons, /reviewer supplied the message text/u);

  // Archived rows keep their archive decision.
  assert.equal(applyIncomingMessageTextUpdate({ ...row, status: 'ignored' }, {
    messageText: 'noise',
    students,
  }).status, 'ignored');

  assert.throws(() => applyIncomingMessageTextUpdate(row, { messageText: '   ', students }), /required/u);
});

test('isSchoolStaffMessage spots our own account and staff personal numbers', () => {
  // Bridge marks our own account's messages.
  assert.equal(isSchoolStaffMessage({ from_me: true }), true);
  assert.equal(isSchoolStaffMessage({ fromMe: 'true' }), true);

  // Tom messages from his own number — matched against INCOMING_STAFF_PHONES
  // in any UK format.
  const staff = '+44 7900 111222, 07811 333444';
  assert.equal(isSchoolStaffMessage({ sender_phone: '+447900111222' }, staff), true);
  assert.equal(isSchoolStaffMessage({ senderPhone: '07900 111222' }, staff), true);
  assert.equal(isSchoolStaffMessage({ senderPhone: '07811333444' }, staff), true);

  // Parents are not staff.
  assert.equal(isSchoolStaffMessage({ senderPhone: '07788 626616' }, staff), false);
  assert.equal(isSchoolStaffMessage({ senderPhone: '07788 626616' }, ''), false);
  assert.equal(isSchoolStaffMessage({}, staff), false);
});

test('decideAutoCaptureStatus archives no-signal chatter and keeps work open', () => {
  assert.equal(decideAutoCaptureStatus({ suspectedCategory: 'general', messageText: 'Thanks! See you then' }), 'ignored');
  assert.equal(decideAutoCaptureStatus({ suspectedCategory: 'one_off_absence', messageText: 'Alex is off sick today' }), 'inbox');
  // General wording but a concrete date → keep it open for a human look.
  assert.equal(decideAutoCaptureStatus({
    suspectedCategory: 'general',
    messageText: 'Just to note the 24th of June',
    messageAt: '2026-06-19T10:00:00.000Z',
  }), 'inbox');
});

test('one-tap convert needs a high-confidence match and a specific category', () => {
  const eligible = {
    matchedMmsId: 'sdt_alex',
    matchConfidence: 'high',
    suspectedCategory: 'extended_absence',
    messageText: 'Alex is away for two weeks',
    status: 'inbox',
  };
  assert.equal(isOneTapConvertEligible(eligible), true);
  assert.equal(isOneTapConvertEligible({ ...eligible, status: 'needs_review' }), true);

  // Weak signals keep the full review panel as the only path.
  assert.equal(isOneTapConvertEligible({ ...eligible, matchConfidence: 'medium' }), false);
  assert.equal(isOneTapConvertEligible({ ...eligible, matchedMmsId: '' }), false);
  assert.equal(isOneTapConvertEligible({ ...eligible, suspectedCategory: 'general' }), false);
  assert.equal(isOneTapConvertEligible({ ...eligible, suspectedCategory: 'absence_pause' }), false);
  assert.equal(isOneTapConvertEligible({
    ...eligible,
    messageText: '[Message content unavailable - star update arrived before cache]',
  }), false);
  assert.equal(isOneTapConvertEligible({ ...eligible, status: 'converted' }), false);
});

test('groupIncomingMessages sorts newest first and normalises status/category', () => {
  const grouped = groupIncomingMessages([
    { incomingId: 'old', capturedAt: '2026-06-01T10:00:00Z', status: 'weird', suspectedCategory: 'wat' },
    { incomingId: 'new', capturedAt: '2026-06-30T10:00:00Z', status: 'converted', suspectedCategory: 'payment' },
  ]);

  assert.deepEqual(grouped.map((row) => row.incomingId), ['new', 'old']);
  assert.equal(grouped[1].status, 'inbox');
  assert.equal(grouped[1].suspectedCategory, 'general');
});
