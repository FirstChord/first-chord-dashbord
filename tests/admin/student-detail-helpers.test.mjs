import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STUDENT_INSTRUMENT_OPTIONS,
  formatDateTime,
  formatTargetDate,
  lifecycleClasses,
  paymentExpectationLabel,
  noteStatusLabel,
  noteStatusClasses,
  notePreview,
} from '../../lib/admin/student-detail-helpers.mjs';

test('student profile offers electric guitar as a distinct registry instrument', () => {
  assert.ok(STUDENT_INSTRUMENT_OPTIONS.includes('Electric Guitar'));
  assert.ok(STUDENT_INSTRUMENT_OPTIONS.includes('Guitar'));
});

test('formatDateTime: blank → em dash, invalid → input, valid → includes year', () => {
  assert.equal(formatDateTime(''), '—');
  assert.equal(formatDateTime('not-a-date'), 'not-a-date');
  assert.match(formatDateTime('2026-07-06T16:00:00Z'), /2026/);
});

test('formatTargetDate: blank → "No date", invalid → input, valid → readable', () => {
  assert.equal(formatTargetDate(''), 'No date');
  assert.equal(formatTargetDate('nope'), 'nope');
  assert.match(formatTargetDate('2026-07-06'), /Jul/);
});

test('lifecycleClasses maps statuses (with an amber default)', () => {
  assert.match(lifecycleClasses('active'), /emerald/);
  assert.match(lifecycleClasses('paused'), /violet/);
  assert.match(lifecycleClasses('stopped'), /slate/);
  assert.match(lifecycleClasses('something-else'), /amber/);
});

test('paymentExpectationLabel resolves known values and falls back', () => {
  assert.equal(paymentExpectationLabel('stripe_active_expected'), 'Stripe active expected');
  assert.equal(paymentExpectationLabel(''), 'Not set');
  assert.equal(paymentExpectationLabel('weird_value'), 'weird_value');
});

test('noteStatusLabel distinguishes delivery evidence from a logged note', () => {
  assert.equal(noteStatusLabel({ emailSendStatus: 'sent' }), 'Sent');
  assert.equal(noteStatusLabel({ emailSendStatus: 'failed' }), 'Email follow-up needed');
  assert.equal(noteStatusLabel({ emailSendStatus: 'not_sent_absent' }), 'Attendance-only (no email)');
  assert.equal(noteStatusLabel({ operationStatus: 'in_progress' }), 'Delivery in progress');
  assert.equal(noteStatusLabel({ mmsAttendanceSaved: true }), 'Saved to MMS — delivery untracked');
  assert.equal(noteStatusLabel({}), 'Logged — delivery not tracked');
});

test('noteStatusClasses colours by state', () => {
  assert.match(noteStatusClasses({ emailSendStatus: 'sent' }), /emerald/);
  assert.match(noteStatusClasses({ manualFollowUpNeeded: true }), /amber/);
  assert.match(noteStatusClasses({ mmsAttendanceSaved: true }), /blue/);
  assert.match(noteStatusClasses({}), /slate/);
});

test('notePreview prefers the richest field and truncates long text', () => {
  assert.equal(notePreview({}), 'No note preview stored.');
  assert.equal(notePreview({ whatWeDid: 'scales' }), 'scales');
  assert.equal(notePreview({ practiceGoals: 'goals' }), 'goals'); // practiceGoals wins
  const long = notePreview({ rawNoteText: 'x'.repeat(300) });
  assert.equal(long.length, 223); // 220 + '...'
});
