import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPracticeNoteAttendancePayload,
  buildPracticeNoteEmailPayload,
  buildPracticeNoteEmailRecipients,
  formatPracticeNoteHtml,
  selectPracticeNoteAttendanceTarget,
} from '../../lib/admin/practice-notes-mms-helpers.mjs';

test('selectPracticeNoteAttendanceTarget prefers latest unrecorded attendance before today', () => {
  const target = selectPracticeNoteAttendanceTarget([
    {
      ID: 'atn_present',
      EventID: 'evt_present',
      StudentID: 'sdt_test',
      AttendanceStatus: 'Present',
      EventStartDate: '2026-06-10T13:30:00',
    },
    {
      ID: 'atn_unrecorded',
      EventID: 'evt_unrecorded',
      StudentID: 'sdt_test',
      AttendanceStatus: 'Unrecorded',
      EventStartDate: '2026-06-03T13:30:00',
    },
  ], new Date('2026-06-11T12:00:00Z'));

  assert.equal(target.attendanceId, 'atn_unrecorded');
  assert.equal(target.eventId, 'evt_unrecorded');
});

test('buildPracticeNoteEmailRecipients uses active email-capable MMS parent profiles', () => {
  const recipients = buildPracticeNoteEmailRecipients({
    Family: {
      Parents: [
        {
          ID: 'prt_valid',
          FormalName: 'Valid Parent',
          IsActive: true,
          HasEmailAddress: true,
          Email: { EmailAddress: 'parent@example.com' },
        },
        {
          ID: 'prt_no_email',
          FormalName: 'No Email',
          HasEmailAddress: false,
          Email: { EmailAddress: '' },
        },
      ],
    },
  });

  assert.deepEqual(recipients, [{
    recipientProfileId: 'prt_valid',
    name: 'Valid Parent',
    email: 'parent@example.com',
  }]);
});

test('formatPracticeNoteHtml escapes note text and preserves paragraphs', () => {
  assert.equal(
    formatPracticeNoteHtml('[What we did]\nA <scale> & rhythm.\n\n[Practice Goals]\nPlay "slowly".'),
    '<p>[What we did]<br>A &lt;scale&gt; &amp; rhythm.</p><p>[Practice Goals]<br>Play &quot;slowly&quot;.</p>',
  );
});

test('buildPracticeNoteAttendancePayload preserves MMS price context', () => {
  const payload = buildPracticeNoteAttendancePayload({
    attendance: {
      teacherNote: '',
      parentNote: '',
      originalChargeAmount: 30,
      chargeWithTax: 25,
    },
    noteHtml: '<p>Test</p>',
  });

  assert.deepEqual(payload, {
    TeacherNote: '',
    ParentNote: '',
    StudentNote: '<p>Test</p>',
    AttendanceStatus: 'Present',
    PriceOverride: 30,
  });
});

test('buildPracticeNoteEmailPayload serialises recipient IDs for MMS emailnotes', () => {
  assert.deepEqual(buildPracticeNoteEmailPayload([
    { recipientProfileId: 'prt_one' },
    { recipientProfileId: 'prt_two' },
  ]), {
    RecipientProfileIDs: ['prt_one', 'prt_two'],
  });
});
