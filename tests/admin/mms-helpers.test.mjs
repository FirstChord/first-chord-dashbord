import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBillingProfilePayload,
  buildCalendarEventPayload,
  buildCalendarEventSearchPayload,
  buildWeeklyRepeatDetails,
  findMatchingCalendarEvent,
  formatMmsErrorBody,
  parseLessonDateTime,
  parseNoteFields,
} from '../../lib/admin/mms-helpers.mjs';

test('parseNoteFields extracts useful onboarding answers and skips placeholders', () => {
  const note = `Students Age: 27
What instruments are they interested in learning?: Guitar
Do they already have some music background/experience?: yes i am grade 4
Favourite genres of music?: Pop, Indie
Which song(s) would you love to learn?: fast car
Please use the below box to voice any questions or concerns: (Not Provided)`;

  assert.deepEqual(parseNoteFields(note), {
    age: '27',
    instrument: 'Guitar',
    experience: 'yes i am grade 4',
    genres: 'Pop, Indie',
    songs: 'fast car',
  });
});

test('parseLessonDateTime creates a valid ISO timestamp from structured inputs', () => {
  assert.equal(parseLessonDateTime('2026-05-03', '13:00'), '2026-05-03T12:00:00.000Z');
});

test('buildBillingProfilePayload matches the observed MMS write shape', () => {
  assert.deepEqual(
    buildBillingProfilePayload({
      studentId: 'sdt_test',
      teacherId: 'tch_test',
      lessonDuration: 45,
      billingRate: 30,
      eventCategoryId: 'ect_test',
    }),
    {
      BillingRate: 30,
      DefaultBillingMode: 'PerLesson',
      EventCategoryID: 'ect_test',
      LessonDuration: 45,
      MakeUpMinutes: 0,
      StudentID: 'sdt_test',
      TeacherID: 'tch_test',
    },
  );
});

test('buildCalendarEventPayload falls back to the billing profile event category', () => {
  const billingProfile = {
    EventCategoryID: 'ect_profile',
    TeacherID: 'tch_profile',
  };

  const payload = buildCalendarEventPayload({
    studentId: 'sdt_test',
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
    durationMinutes: 30,
    billingProfile,
  });

  assert.equal(payload.EventCategoryID, 'ect_profile');
  assert.equal(payload.TeacherID, 'tch_test');
  assert.equal(payload.OriginalTeacherID, 'tch_test');
  assert.deepEqual(payload.StudentIDs, ['sdt_test']);
  assert.deepEqual(payload.RepeatDetails, buildWeeklyRepeatDetails('2026-05-03'));
  assert.equal(payload.biller, billingProfile);
});

test('buildCalendarEventPayload supports group lessons with multiple student IDs', () => {
  const payload = buildCalendarEventPayload({
    studentIds: ['sdt_one', 'sdt_two'],
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
    durationMinutes: 45,
    eventCategoryId: 'ect_group',
  });

  assert.deepEqual(payload.StudentIDs, ['sdt_one', 'sdt_two']);
  assert.equal(payload.MaximumNumberOfParticipants, 2);
  assert.equal(payload.Duration, 45);
});

test('buildWeeklyRepeatDetails creates a weekly series on the selected weekday only', () => {
  const repeat = buildWeeklyRepeatDetails('2026-05-03');

  assert.equal(repeat.Frequency, 'Weekly');
  assert.equal(repeat.Interval, 1);
  assert.equal(repeat.EndDate, null);
  assert.equal(repeat.DaySelection.Sunday, true);
  assert.equal(repeat.DaySelection.Monday, false);
  assert.equal(repeat.DaySelection.Tuesday, false);
});

test('buildCalendarEventPayload can still create a one-off lesson when recurring is disabled', () => {
  const payload = buildCalendarEventPayload({
    studentId: 'sdt_test',
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
    durationMinutes: 30,
    eventCategoryId: 'ect_single',
    isRecurring: false,
  });

  assert.equal(payload.RepeatDetails, null);
  assert.equal(payload.EventCategoryID, 'ect_single');
});

test('buildCalendarEventSearchPayload builds the MMS search payload shape for dedupe checks', () => {
  assert.deepEqual(
    buildCalendarEventSearchPayload({
      studentId: 'sdt_test',
      teacherId: 'tch_test',
      lessonDate: '2026-05-03',
    }),
    {
      AllDay: null,
      AttendanceStatuses: [],
      EndDate: '2026-05-03',
      EndTime: null,
      EventCategoryIDs: [],
      EventIDs: [],
      EventLocationIDs: [],
      HideEmptyEvents: false,
      HideFullEvents: false,
      HideUnscheduledTeachersAndLocations: false,
      HoldTimeSlot: null,
      MakeUpCreditRequired: null,
      MaxDuration: null,
      MinDuration: null,
      OriginalTeacherIDs: [],
      SeriesIDs: [],
      ShowEventsWithSubstituteTeachersOnly: false,
      ShowMakeupEventsOnly: false,
      ShowOpenLessonSlots: false,
      StartDate: '2026-05-03',
      StartTime: null,
      StudentIDs: ['sdt_test'],
      TeacherIDs: ['tch_test'],
    },
  );
});

test('buildCalendarEventSearchPayload supports group lesson dedupe checks', () => {
  const payload = buildCalendarEventSearchPayload({
    studentIds: ['sdt_one', 'sdt_two'],
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
  });

  assert.deepEqual(payload.StudentIDs, ['sdt_one', 'sdt_two']);
});

test('findMatchingCalendarEvent returns a matching existing lesson by teacher, student, and start date', () => {
  const match = findMatchingCalendarEvent({
    events: [
      {
        ID: 'evt_existing',
        StartDate: '2026-05-03T12:00:00',
        TeacherID: 'tch_test',
        Attendances: [{ StudentID: 'sdt_test' }],
      },
    ],
    studentId: 'sdt_test',
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
  });

  assert.equal(match?.ID, 'evt_existing');
});

test('findMatchingCalendarEvent ignores non-matching events', () => {
  const match = findMatchingCalendarEvent({
    events: [
      {
        ID: 'evt_other',
        StartDate: '2026-05-03T12:00:00',
        TeacherID: 'tch_other',
        Attendances: [{ StudentID: 'sdt_test' }],
      },
    ],
    studentId: 'sdt_test',
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
  });

  assert.equal(match, null);
});

test('findMatchingCalendarEvent requires all group students to be present', () => {
  const match = findMatchingCalendarEvent({
    events: [
      {
        ID: 'evt_group',
        StartDate: '2026-05-03T12:00:00',
        TeacherID: 'tch_test',
        Attendances: [{ StudentID: 'sdt_one' }, { StudentID: 'sdt_two' }],
      },
    ],
    studentIds: ['sdt_one', 'sdt_two'],
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
  });

  assert.equal(match?.ID, 'evt_group');
});

test('formatMmsErrorBody prefers structured MMS error messages', () => {
  assert.equal(formatMmsErrorBody({ ErrorMessage: 'bad event' }), 'bad event');
  assert.equal(formatMmsErrorBody({ Message: 'fallback message' }), 'fallback message');
});
