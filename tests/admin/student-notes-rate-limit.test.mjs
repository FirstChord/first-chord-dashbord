import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearNotesUnlockFailures,
  notesUnlockRateLimitState,
  recordNotesUnlockFailure,
} from '../../lib/student-notes-rate-limit.mjs';

test('blocks the sixth code attempt for a student and client during the window', () => {
  const key = { studentMmsId: 'sdt_limit', clientKey: '192.0.2.1' };
  clearNotesUnlockFailures(key);
  const now = Date.parse('2026-07-23T12:00:00.000Z');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert.equal(recordNotesUnlockFailure({ ...key, now }).allowed, true);
  }
  const fifth = recordNotesUnlockFailure({ ...key, now });
  assert.equal(fifth.allowed, false);
  assert.equal(fifth.retryAfterSeconds, 900);
  assert.equal(notesUnlockRateLimitState({ ...key, now }).allowed, false);
  assert.equal(notesUnlockRateLimitState({ ...key, now: now + (15 * 60 * 1000) }).allowed, true);
});

test('limits are isolated between students and clients and clear on success', () => {
  const first = { studentMmsId: 'sdt_a', clientKey: '198.51.100.1' };
  const second = { studentMmsId: 'sdt_b', clientKey: '198.51.100.1' };
  clearNotesUnlockFailures(first);
  clearNotesUnlockFailures(second);
  recordNotesUnlockFailure(first);
  assert.equal(notesUnlockRateLimitState(first).remaining, 4);
  assert.equal(notesUnlockRateLimitState(second).remaining, 5);
  clearNotesUnlockFailures(first);
  assert.equal(notesUnlockRateLimitState(first).remaining, 5);
});
