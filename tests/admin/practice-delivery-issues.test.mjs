import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPracticeDeliveryIssueDetail,
  buildPracticeDeliveryIssues,
  PRACTICE_DELIVERY_ISSUE_SOURCE,
  PRACTICE_DELIVERY_ISSUE_TYPE,
} from '../../lib/admin/practice-delivery-issues.mjs';

function flaggedRow(overrides = {}) {
  return {
    noteId: 'note_1',
    deliveryKey: 'sdt_ABC|att_1|hash1',
    studentMmsId: 'sdt_ABC',
    studentName: 'Ada Lovelace',
    lessonDate: '2026-06-20',
    recipientName: 'Grace Lovelace',
    recipientEmail: 'grace@example.com',
    emailSendStatus: 'failed',
    emailError: 'Gmail send failed: quota',
    manualFollowUpNeeded: true,
    ...overrides,
  };
}

test('turns flagged delivery rows into practice_delivery issues', () => {
  const issues = buildPracticeDeliveryIssues([flaggedRow()]);
  assert.equal(issues.length, 1);
  const [issue] = issues;
  assert.equal(issue.source, PRACTICE_DELIVERY_ISSUE_SOURCE);
  assert.equal(issue.type, PRACTICE_DELIVERY_ISSUE_TYPE);
  assert.equal(issue.mmsId, 'sdt_ABC');
  assert.equal(issue.studentName, 'Ada Lovelace');
  assert.equal(issue.active, true);
  assert.equal(issue.severity, 'Needs action');
  assert.match(issue.detail, /Grace Lovelace/);
  assert.match(issue.detail, /quota/);
  assert.equal(issue.practiceNote.deliveryKey, 'sdt_ABC|att_1|hash1');
});

test('ignores rows without the follow-up flag or without a student id', () => {
  assert.equal(buildPracticeDeliveryIssues([flaggedRow({ manualFollowUpNeeded: false })]).length, 0);
  assert.equal(buildPracticeDeliveryIssues([flaggedRow({ manualFollowUpNeeded: undefined })]).length, 0);
  assert.equal(buildPracticeDeliveryIssues([flaggedRow({ studentMmsId: '' })]).length, 0);
});

test('excludes test students', () => {
  const issues = buildPracticeDeliveryIssues([flaggedRow()], { testStudentIds: new Set(['sdt_ABC']) });
  assert.equal(issues.length, 0);
});

test('distinct delivery keys give distinct issues; duplicates collapse', () => {
  const issues = buildPracticeDeliveryIssues([
    flaggedRow(),
    flaggedRow({ deliveryKey: 'sdt_ABC|att_2|hash2', noteId: 'note_2' }),
    flaggedRow(), // exact duplicate delivery key
  ]);
  assert.equal(issues.length, 2);
  assert.notEqual(issues[0].issueId, issues[1].issueId);
});

test('falls back to note id when there is no delivery key', () => {
  const issues = buildPracticeDeliveryIssues([flaggedRow({ deliveryKey: '' })]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].issueId, /note_1/);
});

test('attaches sheet-student context when available', () => {
  const sheetByMmsId = new Map([['sdt_ABC', { fullName: 'Ada Lovelace', tutor: 'Kenny', instrument: 'Piano', email: 'ada@example.com' }]]);
  const [issue] = buildPracticeDeliveryIssues([flaggedRow({ studentName: '' })], { sheetByMmsId });
  assert.equal(issue.studentName, 'Ada Lovelace');
  assert.equal(issue.hasSheetRow, true);
  assert.equal(issue.sheetTutor, 'Kenny');
  assert.equal(issue.adminStudentPath, '/admin/students/sdt_ABC');
});

test('builds a readable detail line without an error message', () => {
  const detail = buildPracticeDeliveryIssueDetail(flaggedRow({ emailError: '' }));
  assert.equal(detail, 'Lesson 2026-06-20: parent note email to Grace Lovelace needs manual follow-up');
});
