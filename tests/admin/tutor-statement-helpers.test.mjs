import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTutorStatement,
  renderTutorStatementText,
  signStatementToken,
  verifyStatementToken,
  buildStatementToken,
} from '../../lib/admin/tutor-statement-helpers.mjs';

const savedRow = {
  tutor: 'David Husz',
  tutorShortName: 'David',
  periodStart: '2026-06-16',
  periodEnd: '2026-07-01',
  invoiceCadence: 'weekly',
  finalAmount: 211.42,
  status: 'reviewed',
};

const previewRow = {
  lessonCount: 2,
  teachingMinutes: 60,
  reviewPastCount: 0,
  payableSlots: [
    { startAt: '2026-06-18T15:00:00Z', students: [{ studentName: 'Alice' }], durationMinutes: 30, amount: 16, studentCount: 1, isCover: false },
    { startAt: '2026-06-25T15:00:00Z', students: [{ studentName: 'Bea' }], durationMinutes: 30, amount: 16, studentCount: 1, isCover: false },
  ],
};

test('buildTutorStatement uses the frozen total from the saved row and lines from the preview', () => {
  const statement = buildTutorStatement({ savedRow, previewRow });
  assert.equal(statement.tutor, 'David Husz');
  assert.equal(statement.total, 211.42); // frozen, not the sum of lines
  assert.equal(statement.lines.length, 2);
  assert.equal(statement.lines[0].student, 'Alice');
  assert.equal(statement.lessonCount, 2);
  assert.equal(statement.hasUnrecorded, false);
});

test('buildTutorStatement flags unrecorded lessons in the window', () => {
  const statement = buildTutorStatement({ savedRow, previewRow: { ...previewRow, reviewPastCount: 1 } });
  assert.equal(statement.hasUnrecorded, true);
});

test('renderTutorStatementText includes the tutor, period and frozen total', () => {
  const text = renderTutorStatementText(buildTutorStatement({ savedRow, previewRow }));
  assert.match(text, /David Husz/);
  assert.match(text, /£211\.42/);
  assert.match(text, /Alice/);
});

test('statement token round-trips and carries the payroll id', () => {
  const secret = 'test-secret';
  const token = buildStatementToken({ payrollId: 'payroll_david_x', tutorShortName: 'David', secret });
  const payload = verifyStatementToken(token, secret);
  assert.equal(payload.pid, 'payroll_david_x');
  assert.equal(payload.t, 'David');
});

test('verifyStatementToken rejects a tampered token, wrong secret, and expiry', () => {
  const secret = 'test-secret';
  const token = signStatementToken({ pid: 'p1', exp: Date.now() + 10000 }, secret);
  assert.equal(verifyStatementToken(token, 'other-secret'), null);
  assert.equal(verifyStatementToken(`${token}x`, secret), null);
  const expired = signStatementToken({ pid: 'p1', exp: Date.now() - 1 }, secret);
  assert.equal(verifyStatementToken(expired, secret), null);
});
