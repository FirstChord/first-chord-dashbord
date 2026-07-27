import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addStudentNotesTokens,
  buildStudentNotesToken,
  getTutorSurfaceTokenSecret,
  signTutorSurfaceToken,
  verifyStudentNotesToken,
} from '../../lib/tutor-surface-token.mjs';

test('student notes token verifies only for the intended student', () => {
  const secret = 'test-secret';
  const now = Date.parse('2026-07-03T10:00:00Z');
  const token = buildStudentNotesToken({
    studentId: 'sdt_abc',
    tutor: 'Finn',
    secret,
    now,
  });

  const payload = verifyStudentNotesToken(token, {
    studentId: 'sdt_abc',
    secret,
    now: now + 1000,
  });

  assert.equal(payload.sid, 'sdt_abc');
  assert.equal(payload.tutor, 'Finn');
  assert.equal(verifyStudentNotesToken(token, { studentId: 'sdt_other', secret, now: now + 1000 }), null);
});

test('student notes token expires', () => {
  const secret = 'test-secret';
  const now = Date.parse('2026-07-03T10:00:00Z');
  const token = buildStudentNotesToken({
    studentId: 'sdt_abc',
    secret,
    now,
    ttlMs: 1000,
  });

  assert.equal(verifyStudentNotesToken(token, {
    studentId: 'sdt_abc',
    secret,
    now: now + 2000,
  }), null);
});

test('addStudentNotesTokens adds camel and snake case tokens without mutating source students', () => {
  const source = [{ mms_id: 'sdt_abc', name: 'Ada' }];
  const result = addStudentNotesTokens(source, {
    tutor: 'Finn',
    secret: 'test-secret',
    now: Date.parse('2026-07-03T10:00:00Z'),
  });

  assert.equal(source[0].noteAccessToken, undefined);
  assert.equal(typeof result[0].noteAccessToken, 'string');
  assert.equal(result[0].noteAccessToken, result[0].note_access_token);
});

test('getTutorSurfaceTokenSecret prefers explicit tutor dashboard secret', () => {
  assert.equal(getTutorSurfaceTokenSecret({
    TUTOR_DASHBOARD_TOKEN_SECRET: ' tutor-secret ',
    NEXTAUTH_SECRET: 'nextauth-secret',
  }), 'tutor-secret');
  assert.equal(getTutorSurfaceTokenSecret({
    NEXTAUTH_SECRET: 'nextauth-secret',
  }), 'nextauth-secret');
  assert.equal(getTutorSurfaceTokenSecret({
    MMS_BEARER_TOKEN: 'mms-token-secret',
  }), 'mms-token-secret');
});

// --- forgery ------------------------------------------------------------
// The wrong-student and expiry cases above prove the token carries the right
// claims. These prove the signature is what makes those claims trustworthy —
// without them, a verifier that never checked the HMAC would still pass every
// test in this file. verifyStatementToken already has this triad; these two
// verifiers did not.

const SECRET = 'test-secret';
const NOW = Date.parse('2026-07-03T10:00:00Z');
const validToken = () => buildStudentNotesToken({
  studentId: 'sdt_abc',
  tutor: 'Finn',
  secret: SECRET,
  now: NOW,
});
const verify = (token, overrides = {}) => verifyStudentNotesToken(token, {
  studentId: 'sdt_abc',
  secret: SECRET,
  now: NOW + 1000,
  ...overrides,
});

test('a re-written payload keeps the old signature and is rejected', () => {
  const [, signature] = validToken().split('.');
  // The attacker rewrites the claims to point at another student and replays
  // the signature they were legitimately given.
  const forgedBody = Buffer.from(JSON.stringify({
    scope: 'student_notes',
    sid: 'sdt_victim',
    tutor: 'Finn',
    exp: NOW + 60_000,
  })).toString('base64url');

  assert.equal(verify(`${forgedBody}.${signature}`, { studentId: 'sdt_victim' }), null);
});

test('a token signed with a different secret is rejected', () => {
  const attackerToken = signTutorSurfaceToken({
    scope: 'student_notes',
    sid: 'sdt_abc',
    exp: NOW + 60_000,
  }, 'attacker-secret');

  assert.equal(verify(attackerToken), null);
});

test('a genuine token does not verify under a rotated secret', () => {
  assert.equal(verify(validToken(), { secret: 'rotated-secret' }), null);
});

test('a flipped signature byte is rejected', () => {
  const [body, signature] = validToken().split('.');
  const flipped = signature.slice(0, -1) + (signature.endsWith('A') ? 'B' : 'A');

  assert.equal(verify(`${body}.${flipped}`), null);
});

test('a truncated token with no signature segment is rejected', () => {
  const [body] = validToken().split('.');

  assert.equal(verify(body), null);
  assert.equal(verify(`${body}.`), null);
  assert.equal(verify(''), null);
});

test('a validly-signed token from another scope cannot be used as a notes token', () => {
  // Scope separation: the same HMAC secret signs other tutor-surface tokens,
  // so the scope claim is the only thing stopping cross-surface reuse.
  const otherScope = signTutorSurfaceToken({
    scope: 'tutor_statement',
    sid: 'sdt_abc',
    exp: NOW + 60_000,
  }, SECRET);

  assert.equal(verify(otherScope), null);
});
