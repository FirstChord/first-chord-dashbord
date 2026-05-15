import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFreeSlotSummary,
  buildScheduleCacheSummary,
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

test('buildFreeSlotSummary counts slots by tutor', () => {
  const summary = buildFreeSlotSummary([
    { teacherName: 'Scott Brice', weekday: 'Monday' },
    { teacherName: 'Scott Brice', weekday: 'Monday' },
    { teacherName: 'Chloe Mak', weekday: 'Tuesday' },
  ]);

  assert.equal(summary.totalSlots, 3);
  assert.equal(summary.tutorCount, 2);
  assert.deepEqual(summary.byTeacher, [
    { teacherName: 'Scott Brice', count: 2 },
    { teacherName: 'Chloe Mak', count: 1 },
  ]);
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
