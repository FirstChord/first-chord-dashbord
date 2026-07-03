import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addStudentNotesTokens,
  buildStudentNotesToken,
  getTutorSurfaceTokenSecret,
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
});
