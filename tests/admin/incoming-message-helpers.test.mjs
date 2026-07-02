import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGroupSyncPlan,
  buildIncomingMessageRecord,
  buildIncomingPlanningDraft,
  buildIncomingReplyTemplate,
  buildWhatsappGroupMapRecord,
  classifyIncomingMessage,
  decideSyncedGroupStatus,
  detectInstrumentInName,
  groupIncomingMessages,
  isWhatsappGroupChatId,
  matchGroupToStudent,
  matchIncomingMessageToStudent,
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

  assert.equal(draft.title, 'Extended absence: Alex Chang');
  assert.equal(draft.itemType, 'action');
  assert.equal(draft.status, 'active');
  assert.equal(draft.area, 'workflow');
  assert.deepEqual(draft.linkedStudentIds, ['sdt_alex']);
  assert.match(draft.notes, /Alex is away for two weeks/u);
  assert.match(draft.notes, /Suggested reply/u);
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
  assert.equal(decideSyncedGroupStatus('review', false), 'review'); // never downgrade a review
  assert.equal(decideSyncedGroupStatus('confirmed', false), 'confirmed');
  assert.equal(decideSyncedGroupStatus('ignored', true), 'ignored');
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
