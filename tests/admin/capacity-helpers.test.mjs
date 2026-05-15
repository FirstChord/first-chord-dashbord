import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFreeSlotSummary,
  buildScheduleCacheSummary,
  buildWaitingCapacityMatches,
  isFreeCalendarEvent,
  normaliseFreeCalendarSlot,
} from '../../lib/admin/capacity-helpers.mjs';

test('isFreeCalendarEvent only matches the MMS Free category', () => {
  assert.equal(isFreeCalendarEvent({ EventCategory: { Name: 'Free' } }), true);
  assert.equal(isFreeCalendarEvent({ EventCategoryName: 'free' }), true);
  assert.equal(isFreeCalendarEvent({ EventCategory: { Name: 'Free trial' } }), false);
  assert.equal(isFreeCalendarEvent({ EventCategory: { Name: 'Lesson' } }), false);
});

test('normaliseFreeCalendarSlot extracts tutor, time, and duration', () => {
  const slot = normaliseFreeCalendarSlot({
    ID: 'evt_1',
    StartDate: '2026-05-18T16:30:00',
    Duration: 45,
    TeacherID: 'tch_1',
    Teacher: { DisplayName: 'Scott Brice' },
    EventCategory: { Name: 'Free' },
    Students: [],
  });

  assert.equal(slot.eventId, 'evt_1');
  assert.equal(slot.teacherName, 'Scott Brice');
  assert.equal(slot.teacherId, 'tch_1');
  assert.equal(slot.durationMinutes, '45');
  assert.equal(slot.eventCategory, 'Free');
  assert.equal(slot.studentCount, 0);
});

test('buildFreeSlotSummary counts usual weekly slots by tutor', () => {
  const summary = buildFreeSlotSummary([
    { teacherName: 'Scott Brice', weekday: 'Monday', startTime: '16:00', durationMinutes: '30' },
    { teacherName: 'Scott Brice', weekday: 'Monday', startTime: '16:00', durationMinutes: '30' },
    { teacherName: 'Scott Brice', weekday: 'Monday', startTime: '16:30', durationMinutes: '30' },
    { teacherName: 'Chloe Mak', weekday: 'Tuesday', startTime: '17:00', durationMinutes: '30' },
  ]);

  assert.equal(summary.totalEvents, 4);
  assert.equal(summary.totalWeeklySlots, 3);
  assert.equal(summary.tutorCount, 2);
  assert.deepEqual(summary.byTeacher, [
    { teacherName: 'Scott Brice', weeklySlotCount: 2 },
    { teacherName: 'Chloe Mak', weeklySlotCount: 1 },
  ]);
  assert.equal(summary.weeklySlots.find((slot) => slot.teacherName === 'Scott Brice' && slot.startTime === '16:00').occurrenceCount, 2);
});

test('buildScheduleCacheSummary highlights stale, missing, and shared slots', () => {
  const now = new Date().toISOString();
  const summary = buildScheduleCacheSummary([
    {
      status: 'found',
      teacherId: 'tch_1',
      nextLessonAt: '2026-05-18T16:30:00',
      durationMinutes: '45',
      confidence: 'high',
      checkedAt: now,
    },
    {
      status: 'found',
      teacherId: 'tch_1',
      nextLessonAt: '2026-05-18T16:30:00',
      durationMinutes: '45',
      confidence: 'high',
      checkedAt: now,
    },
    {
      status: 'missing',
      confidence: 'low',
      checkedAt: '',
    },
    {
      status: 'found',
      teacherId: '',
      nextLessonAt: '2026-05-19T17:00:00',
      durationMinutes: '',
      confidence: 'low',
      checkedAt: now,
    },
  ]);

  assert.equal(summary.totalCached, 4);
  assert.equal(summary.found, 3);
  assert.equal(summary.missing, 1);
  assert.equal(summary.stale, 1);
  assert.equal(summary.lowConfidence, 2);
  assert.equal(summary.missingTeacher, 1);
  assert.equal(summary.missingDuration, 1);
  assert.equal(summary.sharedSlotGroups, 1);
  assert.equal(summary.sharedStudents, 2);
});

test('buildWaitingCapacityMatches suggests only instrument-compatible free slots', () => {
  const [guitarSlot, pianoSlot] = [
    normaliseFreeCalendarSlot({
      ID: 'evt_guitar',
      StartDate: '2026-05-18T16:30:00',
      Duration: 30,
      TeacherID: 'tch_guitar',
      Teacher: { DisplayName: 'Scott Brice' },
      EventCategory: { Name: 'Free' },
    }),
    normaliseFreeCalendarSlot({
      ID: 'evt_piano',
      StartDate: '2026-05-19T17:00:00',
      Duration: 30,
      TeacherID: 'tch_piano',
      Teacher: { DisplayName: 'Chloe Mak' },
      EventCategory: { Name: 'Free' },
    }),
  ];

  const [student] = buildWaitingCapacityMatches({
    waitingStudents: [{ mmsId: 'sdt_1', instruments: ['Piano'] }],
    freeSlots: [guitarSlot, pianoSlot],
    tutors: [
      { fullName: 'Scott Brice', teacherId: 'tch_guitar', instruments: ['guitar'] },
      { fullName: 'Chloe Mak', teacherId: 'tch_piano', instruments: ['singing', 'piano'] },
    ],
  });

  assert.equal(student.capacityMatchStatus, 'matched');
  assert.equal(student.capacityMatches.length, 1);
  assert.equal(student.capacityMatches[0].teacherName, 'Chloe Mak');
  assert.deepEqual(student.capacityMatches[0].matchedInstruments, ['piano']);
});

test('buildWaitingCapacityMatches refuses to guess when instrument is unknown', () => {
  const [student] = buildWaitingCapacityMatches({
    waitingStudents: [{ mmsId: 'sdt_1', instruments: [] }],
    freeSlots: [],
    tutors: [],
  });

  assert.equal(student.capacityMatchStatus, 'instrument_unknown');
  assert.deepEqual(student.capacityMatches, []);
});
