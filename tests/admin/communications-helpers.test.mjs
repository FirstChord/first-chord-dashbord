import test from 'node:test';
import assert from 'node:assert/strict';

import {
  communicationFingerprint,
  groupCommunicationLog,
  isDuplicateCommunication,
  labelCommunicationCategory,
  normaliseCommunicationLogEntry,
} from '../../lib/admin/communications-helpers.mjs';

test('normaliseCommunicationLogEntry trims and defaults enums', () => {
  const entry = normaliseCommunicationLogEntry({
    category: 'PAUSE',
    channel: 'WhatsApp',
    mmsId: ' sdt_a ',
    studentName: ' Lloyd ',
    body: '  hello  ',
  });
  assert.equal(entry.category, 'pause');
  assert.equal(entry.channel, 'whatsapp');
  assert.equal(entry.mmsId, 'sdt_a');
  assert.equal(entry.studentName, 'Lloyd');
  assert.equal(entry.body, 'hello');

  const fallback = normaliseCommunicationLogEntry({ category: 'nope', channel: 'carrier-pigeon' });
  assert.equal(fallback.category, 'general');
  assert.equal(fallback.channel, 'whatsapp');
});

test('communicationFingerprint is whitespace/case stable for the same message + student', () => {
  const a = communicationFingerprint('sdt_a', 'Hi  there,\n confirming');
  const b = communicationFingerprint('SDT_A', 'hi there, confirming');
  assert.equal(a, b);
  assert.notEqual(a, communicationFingerprint('sdt_b', 'hi there, confirming'));
});

test('isDuplicateCommunication catches a recent identical message but not an old or different one', () => {
  const now = new Date('2026-06-21T12:00:00Z');
  const existing = [
    { mmsId: 'sdt_a', body: 'Pause confirmed', loggedAt: '2026-06-21T11:55:00Z' }, // 5 min ago
    { mmsId: 'sdt_b', body: 'Pause confirmed', loggedAt: '2026-06-21T11:55:00Z' }, // different student
    { mmsId: 'sdt_a', body: 'Old note', loggedAt: '2026-06-01T11:55:00Z' }, // weeks ago
  ];
  assert.equal(isDuplicateCommunication({ mmsId: 'sdt_a', body: 'Pause confirmed' }, existing, { now }), true);
  assert.equal(isDuplicateCommunication({ mmsId: 'sdt_c', body: 'Pause confirmed' }, existing, { now }), false);
  assert.equal(isDuplicateCommunication({ mmsId: 'sdt_a', body: 'Old note' }, existing, { now }), false);
  assert.equal(isDuplicateCommunication({ mmsId: 'sdt_a', body: '' }, existing, { now }), false);
});

test('groupCommunicationLog drops empty bodies and sorts newest-first', () => {
  const rows = [
    { messageId: '1', body: 'first', loggedAt: '2026-06-20T10:00:00Z' },
    { messageId: '2', body: '', loggedAt: '2026-06-21T10:00:00Z' },
    { messageId: '3', body: 'latest', loggedAt: '2026-06-21T09:00:00Z' },
  ];
  const grouped = groupCommunicationLog(rows);
  assert.deepEqual(grouped.map((row) => row.messageId), ['3', '1']);
});

test('labelCommunicationCategory maps known and unknown categories', () => {
  assert.equal(labelCommunicationCategory('pause'), 'Pause');
  assert.equal(labelCommunicationCategory('parent'), 'Parent update');
  assert.equal(labelCommunicationCategory('mystery'), 'General');
});
