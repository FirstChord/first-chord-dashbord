import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAttendanceSearchEndDate,
  buildPracticeNoteAttendancePayload,
  buildPracticeNoteEmailPayload,
  buildPracticeNoteEmailRecipients,
  describePracticeNoteAttendanceSelection,
  formatPracticeNoteHtml,
  isPracticeNotesLevel2PilotStudent,
  isPracticeNotesLevel2PilotTutor,
  listPracticeNoteAttendanceCandidates,
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

test('listPracticeNoteAttendanceCandidates removes future lessons beyond the safety window', () => {
  const candidates = listPracticeNoteAttendanceCandidates([
    {
      ID: 'atn_tomorrow',
      EventID: 'evt_tomorrow',
      StudentID: 'sdt_test',
      AttendanceStatus: 'Unrecorded',
      EventStartDate: '2026-06-12T09:00:00',
    },
    {
      ID: 'atn_far_future',
      EventID: 'evt_far_future',
      StudentID: 'sdt_test',
      AttendanceStatus: 'Unrecorded',
      EventStartDate: '2026-06-20T09:00:00',
    },
  ], new Date('2026-06-11T12:00:00Z'));

  assert.deepEqual(candidates.map((candidate) => candidate.attendanceId), ['atn_tomorrow']);
});

test('buildAttendanceSearchEndDate queries past now so a same-day lesson stays in the MMS window', () => {
  // UK evening write-up: lesson earlier the same day must not fall on/after the EndDate boundary.
  const now = new Date('2026-06-12T20:30:00Z');
  const endDate = buildAttendanceSearchEndDate(now);
  assert.equal(endDate, '2026-06-14');
  // The lesson's own date is strictly before the EndDate, so it cannot be clipped.
  assert.ok(endDate > '2026-06-12');
});

test('listPracticeNoteAttendanceCandidates keeps a lesson taught earlier the same day', () => {
  const candidates = listPracticeNoteAttendanceCandidates([
    {
      ID: 'atn_today',
      EventID: 'evt_today',
      StudentID: 'sdt_test',
      AttendanceStatus: 'Unrecorded',
      EventStartDate: '2026-06-12T15:30:00',
    },
  ], new Date('2026-06-12T20:30:00Z'));

  assert.deepEqual(candidates.map((candidate) => candidate.attendanceId), ['atn_today']);
});

test('selectPracticeNoteAttendanceTarget can target an explicit attendance ID', () => {
  const target = selectPracticeNoteAttendanceTarget([
    {
      ID: 'atn_latest',
      EventID: 'evt_latest',
      StudentID: 'sdt_test',
      AttendanceStatus: 'Unrecorded',
      EventStartDate: '2026-06-10T13:30:00',
    },
    {
      ID: 'atn_requested',
      EventID: 'evt_requested',
      StudentID: 'sdt_test',
      AttendanceStatus: 'Unrecorded',
      EventStartDate: '2026-06-03T13:30:00',
    },
  ], new Date('2026-06-11T12:00:00Z'), { targetAttendanceId: 'atn_requested' });

  assert.equal(target.attendanceId, 'atn_requested');
  assert.equal(target.eventId, 'evt_requested');
});

test('describePracticeNoteAttendanceSelection explains the selected lesson reason', () => {
  const candidates = [
    {
      attendanceId: 'atn_unrecorded',
      attendanceStatus: 'Unrecorded',
    },
    {
      attendanceId: 'atn_present',
      attendanceStatus: 'Present',
    },
  ];

  assert.deepEqual(describePracticeNoteAttendanceSelection({
    target: candidates[0],
    candidates,
  }), {
    reason: 'latest_unrecorded',
    label: 'Selected because it is the latest unrecorded lesson found for this student.',
  });

  assert.deepEqual(describePracticeNoteAttendanceSelection({
    target: candidates[1],
    candidates,
    targetAttendanceId: 'atn_present',
  }), {
    reason: 'explicit_selection',
    label: 'You selected this lesson from the date list.',
  });
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

test('buildPracticeNoteAttendancePayload does not touch MMS billing context', () => {
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
  });
  assert.equal(Object.hasOwn(payload, 'PriceOverride'), false);
});

test('buildPracticeNoteAttendancePayload can mark same-day absence without notes email', () => {
  const payload = buildPracticeNoteAttendancePayload({
    attendance: {
      teacherNote: '',
      parentNote: '',
    },
    noteHtml: '',
    attendanceStatus: 'AbsentNoMakeup',
  });

  assert.deepEqual(payload, {
    TeacherNote: '',
    ParentNote: '',
    StudentNote: '',
    AttendanceStatus: 'AbsentNoMakeup',
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

test('Practice Chat Level 2 pilot gate allows only pilot tutors or Test Studenty', () => {
  assert.equal(isPracticeNotesLevel2PilotTutor('Finn Le Marinel'), true);
  assert.equal(isPracticeNotesLevel2PilotTutor('Tom'), true);
  assert.equal(isPracticeNotesLevel2PilotTutor('Fennella McCallum'), true);
  assert.equal(isPracticeNotesLevel2PilotTutor('Dean'), true);
  assert.equal(isPracticeNotesLevel2PilotTutor('Dean Louden'), true);

  assert.equal(isPracticeNotesLevel2PilotStudent({ mmsId: 'sdt_real', tutor: 'Finn' }), true);
  assert.equal(isPracticeNotesLevel2PilotStudent({ mmsId: 'sdt_real', registryTutor: 'Dean' }), true);
  assert.equal(isPracticeNotesLevel2PilotStudent({ mmsId: 'sdt_fBg9JN', registryTutor: 'Dean' }), true);
});
