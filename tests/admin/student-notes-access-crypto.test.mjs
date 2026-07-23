import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStudentNotesVerifier,
  createStudentNotesSession,
  decryptStudentNotesCode,
  encryptStudentNotesCode,
  generateStudentNotesCode,
  studentNotesCookieName,
  verifyStudentNotesCode,
  verifyStudentNotesSession,
} from '../../lib/admin/student-notes-access-crypto.mjs';

const ORIGINAL_SECRET = process.env.STUDENT_PORTAL_NOTES_SECRET;
process.env.STUDENT_PORTAL_NOTES_SECRET = 'test-secret-that-is-at-least-thirty-two-bytes-long';

test.after(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.STUDENT_PORTAL_NOTES_SECRET;
  else process.env.STUDENT_PORTAL_NOTES_SECRET = ORIGINAL_SECRET;
});

test('generates one friendly lowercase word and two digits', () => {
  for (let index = 0; index < 20; index += 1) {
    assert.match(generateStudentNotesCode(), /^[a-z]+-[1-9][0-9]$/);
  }
});

test('verifies equivalent code formatting and rejects the wrong code', () => {
  const stored = buildStudentNotesVerifier('otter-27');
  assert.equal(verifyStudentNotesCode(' OTTER 27 ', stored), true);
  assert.equal(verifyStudentNotesCode('otter-28', stored), false);
});

test('encrypts codes for admin handover without storing plaintext', () => {
  const encrypted = encryptStudentNotesCode('otter-27');
  assert.doesNotMatch(encrypted, /otter/);
  assert.equal(decryptStudentNotesCode(encrypted), 'otter-27');
});

test('student sessions are scoped by student, credential version, and expiry', () => {
  const now = Date.parse('2026-07-23T12:00:00.000Z');
  const token = createStudentNotesSession({
    studentMmsId: 'sdt_123',
    credentialVersion: 2,
    now,
  });
  assert.equal(verifyStudentNotesSession(token, {
    studentMmsId: 'sdt_123',
    credentialVersion: 2,
    now: now + 1000,
  }), true);
  assert.equal(verifyStudentNotesSession(token, {
    studentMmsId: 'sdt_other',
    credentialVersion: 2,
    now: now + 1000,
  }), false);
  assert.equal(verifyStudentNotesSession(token, {
    studentMmsId: 'sdt_123',
    credentialVersion: 3,
    now: now + 1000,
  }), false);
  assert.equal(verifyStudentNotesSession(token, {
    studentMmsId: 'sdt_123',
    credentialVersion: 2,
    now: now + (366 * 24 * 60 * 60 * 1000),
  }), false);
});

test('cookie names do not expose raw MMS identifiers', () => {
  const name = studentNotesCookieName('sdt_private');
  assert.match(name, /^fc_notes_[a-f0-9]{16}$/);
  assert.doesNotMatch(name, /sdt_private/);
});
