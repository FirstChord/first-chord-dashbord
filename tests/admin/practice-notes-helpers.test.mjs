import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPracticeNoteLogSheetRow,
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
});

test('buildPracticeNoteLogSheetRow serialises booleans for Sheets', () => {
  const row = buildPracticeNoteLogSheetRow({
    noteId: 'practice_note:sdt_123:test',
    studentMmsId: 'sdt_123',
    studentName: 'Ada Student',
    tutorName: 'Dean',
    whatWeDid: 'Worked on rhythm.',
    copiedToClipboard: true,
    attendanceStepOpened: false,
    source: 'practice_chat_pwa',
    createdAt: '2026-06-11T12:00:00Z',
  });

  assert.equal(row.note_id, 'practice_note:sdt_123:test');
  assert.equal(row.student_mms_id, 'sdt_123');
  assert.equal(row.copied_to_clipboard, 'TRUE');
  assert.equal(row.attendance_step_opened, 'FALSE');
});
