import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_FREE_SLOT_WEEK_OFFSET,
  addDaysToCalendarDate,
  buildBillingProfilePayload,
  buildCalendarEventPayload,
  buildCalendarEventSearchPayload,
  buildWeeklyRepeatDetails,
  findFreeCalendarOccurrence,
  findMatchingCalendarEvent,
  formatMmsErrorBody,
  parseLessonDateTime,
  parseNoteFields,
  resolveFreeSlotWeekOffset,
  validateMmsFreeCalendarEvent,
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

test('parseLessonDateTime preserves the MMS calendar wall-clock time', () => {
  assert.equal(parseLessonDateTime('2026-05-03', '13:00'), '2026-05-03T13:00:00');
});

test('parseLessonDateTime does not shift summer lesson times back by one hour', () => {
  assert.equal(parseLessonDateTime('2026-06-03', '18:30'), '2026-06-03T18:30:00');
});

test('validateMmsFreeCalendarEvent accepts the exact empty Free event selected for onboarding', () => {
  assert.deepEqual(validateMmsFreeCalendarEvent({
    eventId: 'evt_selected',
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
    durationMinutes: 30,
    event: {
      ID: 'evt_selected',
      StartDate: '2026-05-03T13:00:00',
      Duration: 30,
      TeacherID: 'tch_test',
      EventCategory: { Name: 'Free' },
      Students: [],
      Attendances: [],
      SeriesID: 'series_one',
    },
  }), {
    eventId: 'evt_selected',
    teacherId: 'tch_test',
    startDate: '2026-05-03T13:00:00',
    durationMinutes: 30,
    seriesId: 'series_one',
    slotDate: '2026-05-03',
    weekOffset: 0,
    lessonStartDateTime: '2026-05-03T13:00:00',
  });
});

test('validateMmsFreeCalendarEvent accepts a first lesson bumped whole weeks past the pinned occurrence', () => {
  const slot = validateMmsFreeCalendarEvent({
    eventId: 'evt_selected',
    teacherId: 'tch_test',
    lessonDate: '2026-05-17',
    lessonTime: '13:00',
    durationMinutes: 30,
    event: {
      ID: 'evt_selected',
      StartDate: '2026-05-03T13:00:00',
      Duration: 30,
      TeacherID: 'tch_test',
      EventCategory: { Name: 'Free' },
      Students: [],
      Attendances: [],
      SeriesID: 'series_one',
    },
  });

  assert.equal(slot.weekOffset, 2);
  assert.equal(slot.slotDate, '2026-05-03');
  assert.equal(slot.lessonStartDateTime, '2026-05-17T13:00:00');
});

test('validateMmsFreeCalendarEvent refuses a bump that is not a weekly repeat of the slot', () => {
  const base = {
    eventId: 'evt_selected',
    teacherId: 'tch_test',
    lessonTime: '13:00',
    durationMinutes: 30,
    event: {
      ID: 'evt_selected',
      StartDate: '2026-05-03T13:00:00',
      Duration: 30,
      TeacherID: 'tch_test',
      EventCategory: { Name: 'Free' },
    },
  };

  // A different weekday would book the lesson on a day the tutor never offered.
  assert.throws(() => validateMmsFreeCalendarEvent({ ...base, lessonDate: '2026-05-19' }), /whole number of weeks/);
  assert.throws(() => validateMmsFreeCalendarEvent({ ...base, lessonDate: '2026-04-26' }), /before the selected MMS Free slot/);
  assert.throws(() => validateMmsFreeCalendarEvent({ ...base, lessonDate: '2026-09-06' }), /more than 12 weeks/);
});

test('resolveFreeSlotWeekOffset separates a clean weekly bump from every way it can be wrong', () => {
  assert.deepEqual(resolveFreeSlotWeekOffset({ slotDate: '2026-05-03', lessonDate: '2026-05-03' }), { weekOffset: 0, reason: 'ok' });
  assert.deepEqual(resolveFreeSlotWeekOffset({ slotDate: '2026-05-03', lessonDate: '2026-05-24' }), { weekOffset: 3, reason: 'ok' });
  assert.deepEqual(resolveFreeSlotWeekOffset({ slotDate: '2026-05-03', lessonDate: '2026-05-04' }), { weekOffset: null, reason: 'different_weekday' });
  assert.deepEqual(resolveFreeSlotWeekOffset({ slotDate: '2026-05-03', lessonDate: '2026-04-26' }), { weekOffset: null, reason: 'before_slot' });
  assert.deepEqual(resolveFreeSlotWeekOffset({ slotDate: '2026-05-03', lessonDate: '' }), { weekOffset: null, reason: 'unparsable' });

  const beyondLimit = addDaysToCalendarDate('2026-05-03', (MAX_FREE_SLOT_WEEK_OFFSET + 1) * 7);
  assert.deepEqual(resolveFreeSlotWeekOffset({ slotDate: '2026-05-03', lessonDate: beyondLimit }), { weekOffset: null, reason: 'too_far' });
});

test('addDaysToCalendarDate crosses a month and a British Summer Time change without drifting', () => {
  assert.equal(addDaysToCalendarDate('2026-05-03', 28), '2026-05-31');
  assert.equal(addDaysToCalendarDate('2026-10-18', 21), '2026-11-08');
  assert.throws(() => addDaysToCalendarDate('not-a-date', 7), /Could not parse/);
});

test('findFreeCalendarOccurrence only accepts an empty Free event in the bumped week', () => {
  const events = [
    { ID: 'evt_lesson', StartDate: '2026-05-17T13:00:00', Duration: 30, TeacherID: 'tch_test', EventCategory: { Name: 'Lesson' } },
    { ID: 'evt_other_tutor', StartDate: '2026-05-17T13:00:00', Duration: 30, TeacherID: 'tch_other', EventCategory: { Name: 'Free' } },
    { ID: 'evt_taken', StartDate: '2026-05-17T14:00:00', Duration: 30, TeacherID: 'tch_test', EventCategory: { Name: 'Free' }, Students: [{ ID: 'sdt_x' }] },
    { ID: 'evt_free', StartDate: '2026-05-17T13:00:00', Duration: 30, TeacherID: 'tch_test', EventCategory: { Name: 'Free' }, Students: [] },
  ];
  const match = { events, teacherId: 'tch_test', startDateTime: '2026-05-17T13:00:00', durationMinutes: 30 };

  assert.equal(findFreeCalendarOccurrence(match).ID, 'evt_free');
  assert.equal(findFreeCalendarOccurrence({ ...match, durationMinutes: 45 }), null);
  assert.equal(findFreeCalendarOccurrence({ ...match, startDateTime: '2026-05-17T14:00:00' }), null);
  assert.equal(findFreeCalendarOccurrence({ ...match, events: [] }), null);
});

test('validateMmsFreeCalendarEvent refuses a stale or occupied source event', () => {
  assert.throws(() => validateMmsFreeCalendarEvent({
    eventId: 'evt_selected',
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
    durationMinutes: 30,
    event: {
      ID: 'evt_selected',
      StartDate: '2026-05-03T13:00:00',
      Duration: 30,
      TeacherID: 'tch_test',
      EventCategory: { Name: 'Lesson' },
    },
  }), /no longer marked Free/);

  assert.throws(() => validateMmsFreeCalendarEvent({
    eventId: 'evt_selected',
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
    durationMinutes: 30,
    event: {
      ID: 'evt_selected',
      StartDate: '2026-05-03T13:00:00',
      Duration: 30,
      TeacherID: 'tch_test',
      EventCategory: { Name: 'Free' },
      Students: [{ ID: 'sdt_taken' }],
    },
  }), /now has a student/);
});

test('validateMmsFreeCalendarEvent refuses changed tutor, time, length, and unsafe IDs', () => {
  const base = {
    eventId: 'evt_selected',
    teacherId: 'tch_test',
    lessonDate: '2026-05-03',
    lessonTime: '13:00',
    durationMinutes: 30,
    event: {
      ID: 'evt_selected',
      StartDate: '2026-05-03T13:00:00',
      Duration: 30,
      TeacherID: 'tch_test',
      EventCategory: { Name: 'Free' },
    },
  };

  assert.throws(() => validateMmsFreeCalendarEvent({ ...base, teacherId: 'tch_other' }), /selected tutor/);
  assert.throws(() => validateMmsFreeCalendarEvent({ ...base, lessonTime: '13:30' }), /date and time/);
  assert.throws(() => validateMmsFreeCalendarEvent({ ...base, event: { ...base.event, StartDate: '' } }), /date and time/);
  assert.throws(() => validateMmsFreeCalendarEvent({ ...base, durationMinutes: 45 }), /lesson length/);
  assert.throws(() => validateMmsFreeCalendarEvent({ ...base, eventId: '../students' }), /ID is invalid/);
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
        StartDate: '2026-05-03T13:00:00',
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
        StartDate: '2026-05-03T13:00:00',
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
        StartDate: '2026-05-03T13:00:00',
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
