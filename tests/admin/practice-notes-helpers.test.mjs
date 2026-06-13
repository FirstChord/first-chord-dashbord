import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPracticeNoteDeliveryKey,
  buildPracticeNoteLogSheetRow,
  findPracticeNoteDeliveryRecord,
  isPracticeNoteDeliveryEmailSent,
  isPracticeNoteDeliveryInProgress,
  normalisePracticeNoteLogRow,
  normalisePracticeNotePayload,
} from '../../lib/admin/practice-notes-helpers.mjs';

test('normalisePracticeNotePayload requires student and note text', () => {
  const note = normalisePracticeNotePayload({}, new Date('2026-06-11T12:00:00Z'));

  assert.deepEqual(note.errors, [
    'studentMmsId is required',
    'note text is required',
  ]);
});

test('normalisePracticeNotePayload accepts structured Practice Chat sections', () => {
  const note = normalisePracticeNotePayload({
    noteId: ' practice_note:sdt_123:2026-06-11:test ',
    studentId: ' sdt_123 ',
    studentName: ' Ada Student ',
    tutor: ' Dean ',
    whatWeDid: 'Worked on rhythm.',
    progressChallenges: 'Counting is stronger.',
    practiceGoals: 'Slow practice.',
    rawNoteText: '[What we did]\nWorked on rhythm.',
    mmsAttendanceId: 'atn_123',
    recipientEmail: 'parent@example.com',
    emailSendStatus: 'sent',
    gmailMessageId: 'msg_123',
    copiedToClipboard: true,
    attendanceStepOpened: true,
    createdAt: '2026-06-11T12:00:00Z',
    userAgent: 'Test Browser',
  });

  assert.equal(note.errors.length, 0);
  assert.equal(note.studentMmsId, 'sdt_123');
  assert.equal(note.studentName, 'Ada Student');
  assert.equal(note.tutorName, 'Dean');
  assert.equal(note.copiedToClipboard, true);
  assert.equal(note.attendanceStepOpened, true);
  assert.equal(note.noteId, 'practice_note:sdt_123:2026-06-11:test');
  assert.equal(note.deliveryKey, '');
  assert.equal(note.mmsAttendanceId, 'atn_123');
  assert.equal(note.recipientEmail, 'parent@example.com');
  assert.equal(note.emailSendStatus, 'sent');
  assert.equal(note.gmailMessageId, 'msg_123');
});

test('buildPracticeNoteLogSheetRow serialises booleans for Sheets', () => {
  const row = buildPracticeNoteLogSheetRow({
    noteId: 'practice_note:sdt_123:test',
    deliveryKey: 'practice_note_delivery:sdt_123:atn_123:abc',
    studentMmsId: 'sdt_123',
    studentName: 'Ada Student',
    tutorName: 'Dean',
    whatWeDid: 'Worked on rhythm.',
    copiedToClipboard: true,
    attendanceStepOpened: false,
    mmsAttendanceSaved: true,
    manualFollowUpNeeded: false,
    emailSendStatus: 'sent',
    operationStatus: 'completed',
    completedAt: '2026-06-11T12:05:00.000Z',
    source: 'practice_chat_pwa',
    createdAt: '2026-06-11T12:00:00Z',
  });

  assert.equal(row.note_id, 'practice_note:sdt_123:test');
  assert.equal(row.delivery_key, 'practice_note_delivery:sdt_123:atn_123:abc');
  assert.equal(row.student_mms_id, 'sdt_123');
  assert.equal(row.copied_to_clipboard, 'TRUE');
  assert.equal(row.attendance_step_opened, 'FALSE');
  assert.equal(row.mms_attendance_saved, 'TRUE');
  assert.equal(row.manual_follow_up_needed, 'FALSE');
  assert.equal(row.email_send_status, 'sent');
  assert.equal(row.operation_status, 'completed');
  assert.equal(row.completed_at, '2026-06-11T12:05:00.000Z');
});

test('normalisePracticeNoteLogRow reads enriched audit fields', () => {
  const row = normalisePracticeNoteLogRow({
    note_id: 'practice_note:sdt_123:test',
    delivery_key: 'practice_note_delivery:sdt_123:atn_123:abc',
    student_mms_id: 'sdt_123',
    tutor_name: 'Dean',
    raw_note_text: 'Lesson note',
    mms_attendance_id: 'atn_123',
    mms_attendance_saved: 'TRUE',
    target_selection_label: 'Selected because it is the latest unrecorded lesson found for this student.',
    recipient_name: 'Ada Parent',
    recipient_email: 'parent@example.com',
    email_channel: 'gmail',
    email_send_status: 'sent',
    email_sent_at: '2026-06-11T12:05:00.000Z',
    gmail_message_id: 'msg_123',
    manual_follow_up_needed: 'FALSE',
    operation_status: 'completed',
    completed_at: '2026-06-11T12:05:00.000Z',
  });

  assert.equal(row.noteId, 'practice_note:sdt_123:test');
  assert.equal(row.deliveryKey, 'practice_note_delivery:sdt_123:atn_123:abc');
  assert.equal(row.mmsAttendanceId, 'atn_123');
  assert.equal(row.mmsAttendanceSaved, true);
  assert.equal(row.recipientName, 'Ada Parent');
  assert.equal(row.emailSendStatus, 'sent');
  assert.equal(row.manualFollowUpNeeded, false);
  assert.equal(row.operationStatus, 'completed');
  assert.equal(row.completedAt, '2026-06-11T12:05:00.000Z');
});

test('buildPracticeNoteDeliveryKey is stable for the same lesson and note text', () => {
  const first = buildPracticeNoteDeliveryKey({
    studentMmsId: 'sdt_123',
    mmsAttendanceId: 'atn_123',
    rawNoteText: 'Scale practice\n\nSlowly.',
  });
  const second = buildPracticeNoteDeliveryKey({
    studentMmsId: 'sdt_123',
    mmsAttendanceId: 'atn_123',
    rawNoteText: 'Scale   practice Slowly.',
  });
  const differentLesson = buildPracticeNoteDeliveryKey({
    studentMmsId: 'sdt_123',
    mmsAttendanceId: 'atn_456',
    rawNoteText: 'Scale practice Slowly.',
  });

  assert.equal(first, second);
  assert.match(first, /^practice_note_delivery:sdt_123:atn_123:/);
  assert.notEqual(first, differentLesson);
});

test('practice note delivery status helpers protect sent and in-progress rows', () => {
  const now = new Date('2026-06-12T10:01:00.000Z');
  const records = [
    {
      deliveryKey: 'old',
      operationStatus: 'email_failed',
      emailSendStatus: 'failed',
      createdAt: '2026-06-12T09:55:00.000Z',
    },
    {
      deliveryKey: 'target',
      operationStatus: 'completed',
      emailSendStatus: 'sent',
      createdAt: '2026-06-12T10:00:00.000Z',
    },
    {
      deliveryKey: 'busy',
      operationStatus: 'in_progress',
      createdAt: '2026-06-12T10:00:30.000Z',
    },
  ];

  assert.equal(findPracticeNoteDeliveryRecord(records, 'target'), records[1]);
  assert.equal(isPracticeNoteDeliveryEmailSent(records[1]), true);
  assert.equal(isPracticeNoteDeliveryEmailSent(records[0]), false);
  assert.equal(isPracticeNoteDeliveryInProgress(records[2], now), true);
  assert.equal(isPracticeNoteDeliveryInProgress(records[0], now), false);
});
