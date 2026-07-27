import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearNotesUnlockFailures,
  clientKeyFromRequest,
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

// --- who gets limited ---------------------------------------------------
// The limiter above was well covered; the function deciding *which bucket a
// request falls into* was not covered at all. That function is what makes the
// limiter meaningful: the notes code is one of 120 words plus two digits —
// 10,800 combinations, ~5,400 tries on average. At 5 attempts per 15 minutes
// that is about four months. Per-request, it is seconds.

const requestWith = (headers = {}) => ({
  headers: {
    get: (name) => headers[name.toLowerCase()] ?? null,
  },
});

test('the client key prefers x-forwarded-for, then x-real-ip, then a shared fallback', () => {
  assert.equal(clientKeyFromRequest(requestWith({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9');
  assert.equal(
    clientKeyFromRequest(requestWith({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '198.51.100.7' })),
    '203.0.113.9',
    'x-forwarded-for wins when both are present',
  );
  assert.equal(clientKeyFromRequest(requestWith({ 'x-real-ip': '198.51.100.7' })), '198.51.100.7');
  assert.equal(clientKeyFromRequest(requestWith({})), 'unknown-client');
});

test('a blank or whitespace forwarded header falls through rather than becoming its own bucket', () => {
  // '' as a client key would be a single shared bucket for every header-less
  // caller — same outcome as the fallback, but by accident rather than choice.
  assert.equal(clientKeyFromRequest(requestWith({ 'x-forwarded-for': '' })), 'unknown-client');
  assert.equal(clientKeyFromRequest(requestWith({ 'x-forwarded-for': '   ' })), 'unknown-client');
  assert.equal(clientKeyFromRequest(requestWith({ 'x-forwarded-for': '  ,  ' })), 'unknown-client');
  assert.equal(
    clientKeyFromRequest(requestWith({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.7' })),
    '198.51.100.7',
  );
});

test('the leftmost forwarded hop is used, and it is the caller-supplied one', () => {
  // KNOWN GAP, pinned deliberately rather than asserted as correct.
  //
  // X-Forwarded-For is "client, proxy1, proxy2" — appended left to right. The
  // leftmost entry is whatever the caller sent; Railway appends the real
  // source to the right of it. So this reads the one value an attacker fully
  // controls, and the test below shows what that buys them.
  //
  // Fixing it means taking the Nth-from-right entry, which depends on how many
  // trusted proxies sit in front of the app — a deployment fact, not a code
  // fact, so it is a decision rather than a patch. See CURRENT_STATUS
  // "Next choices".
  assert.equal(
    clientKeyFromRequest(requestWith({ 'x-forwarded-for': '198.51.100.50, 203.0.113.1, 70.41.3.18' })),
    '198.51.100.50',
  );
});

test('rotating the forwarded header resets the attempt budget', () => {
  // The concrete consequence of the above: five failures, then a new header
  // value, then five more — indefinitely, against a 10,800-value keyspace.
  const studentMmsId = 'sdt_bruteforce';
  const now = Date.parse('2026-07-27T12:00:00.000Z');
  let totalAttempts = 0;

  for (let spoof = 0; spoof < 20; spoof += 1) {
    const clientKey = clientKeyFromRequest(
      requestWith({ 'x-forwarded-for': `198.51.100.${spoof}, 203.0.113.1` }),
    );
    clearNotesUnlockFailures({ studentMmsId, clientKey });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordNotesUnlockFailure({ studentMmsId, clientKey, now });
      totalAttempts += 1;
    }
    assert.equal(
      notesUnlockRateLimitState({ studentMmsId, clientKey, now }).allowed,
      false,
      'each individual bucket does still lock after five',
    );
  }

  // 100 attempts inside one 15-minute window against a student whose per-IP
  // budget is 5. The limiter is working exactly as written; the input is the
  // problem.
  assert.equal(totalAttempts, 100);
});
