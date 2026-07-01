import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIncomingMessageRecord,
  buildWhatsappGroupMapRecord,
  classifyIncomingMessage,
  groupIncomingMessages,
  isWhatsappGroupChatId,
  matchIncomingMessageToStudent,
  normaliseIncomingMessagePayload,
  normalisePhone,
} from '../../lib/admin/incoming-message-helpers.mjs';

const students = [
  {
    mmsId: 'sdt_alex',
    firstName: 'Alex',
    lastName: 'Chang',
    fullName: 'Alex Chang',
    parentFirstName: 'Mina',
    parentLastName: 'Chang',
    contactNumber: '07788 626616',
  },
  {
    mmsId: 'sdt_sam',
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

test('groupIncomingMessages sorts newest first and normalises status/category', () => {
  const grouped = groupIncomingMessages([
    { incomingId: 'old', capturedAt: '2026-06-01T10:00:00Z', status: 'weird', suspectedCategory: 'wat' },
    { incomingId: 'new', capturedAt: '2026-06-30T10:00:00Z', status: 'converted', suspectedCategory: 'payment' },
  ]);

  assert.deepEqual(grouped.map((row) => row.incomingId), ['new', 'old']);
  assert.equal(grouped[1].status, 'inbox');
  assert.equal(grouped[1].suspectedCategory, 'general');
});
