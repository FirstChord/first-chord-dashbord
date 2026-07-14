import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveScheduleContextFromMms,
  enrichScheduleContextsWithSharedSlots,
} from '../../lib/admin/schedule-context-helpers.mjs';

test('deriveScheduleContextFromMms derives usual slot from upcoming MMS calendar events', () => {
  const context = deriveScheduleContextFromMms({
    checkedAt: '2026-05-14T12:00:00.000Z',
    student: {
      ID: 'sdt_test',
      FullName: 'Tabitha Example',
      NextEventDate: '2026-05-19T16:00:00',
      BillingProfiles: [{
        Active: true,
        TeacherID: 'tch_chloe',
        LessonDuration: 30,
      }],
    },
    events: [
      {
        StartDate: '2026-05-26T16:00:00',
        Duration: 30,
        TeacherID: 'tch_chloe',
        OriginalTeacherID: 'tch_chloe',
        Teacher: { Name: 'Chloe Mak' },
        EventCategory: { Name: 'Chloe' },
        SeriesID: 'series_1',
      },
      {
        StartDate: '2026-05-19T16:00:00',
        Duration: 30,
        TeacherID: 'tch_chloe',
        OriginalTeacherID: 'tch_chloe',
        Teacher: { Name: 'Chloe Mak' },
        EventCategory: { Name: 'Chloe' },
        SeriesID: 'series_1',
      },
    ],
  });

  assert.equal(context.status, 'found');
  assert.equal(context.nextLessonAt, '2026-05-19T16:00:00');
  assert.equal(context.usualWeekday, 'Tuesday');
  assert.equal(context.usualTime, '16:00');
  assert.equal(context.durationMinutes, '30');
  assert.equal(context.teacherName, 'Chloe Mak');
  assert.equal(context.confidence, 'high');
  assert.equal(context.warnings.length, 0);
});

test('deriveScheduleContextFromMms falls back to low-confidence missing schedule context', () => {
  const context = deriveScheduleContextFromMms({
    checkedAt: '2026-05-14T12:00:00.000Z',
    student: {
      ID: 'sdt_missing',
      FullName: 'Missing Schedule',
      BillingProfiles: [{
        Active: true,
        TeacherID: 'tch_finn',
        LessonDuration: 45,
      }],
    },
    events: [],
  });

  assert.equal(context.status, 'not_found');
  assert.equal(context.confidence, 'low');
  assert.equal(context.durationMinutes, '45');
  assert.match(context.warnings.join(' '), /No upcoming MMS calendar events/);
});

test('deriveScheduleContextFromMms preserves MMS wall-clock day and time across host timezones', () => {
  const context = deriveScheduleContextFromMms({
    student: { ID: 'sdt_late', FullName: 'Late Lesson' },
    events: [{
      StartDate: '2026-05-31T23:30:00',
      Duration: 30,
      TeacherID: 'tch_test',
    }],
  });

  assert.equal(context.usualWeekday, 'Sunday');
  assert.equal(context.usualTime, '23:30');
});

test('enrichScheduleContextsWithSharedSlots marks students sharing the same MMS lesson slot', () => {
  const byMmsId = enrichScheduleContextsWithSharedSlots([
    {
      mmsId: 'sdt_emily',
      studentName: 'Emily Grifa',
      status: 'found',
      nextLessonAt: '2026-05-18 15:15:00',
      durationMinutes: '45',
      teacherId: 'tch_shared',
    },
    {
      mmsId: 'sdt_nina',
      studentName: 'Nina Gavlin',
      status: 'found',
      nextLessonAt: '2026-05-18 15:15:00',
      durationMinutes: '45',
      teacherId: 'tch_shared',
    },
    {
      mmsId: 'sdt_solo',
      studentName: 'Solo Student',
      status: 'found',
      nextLessonAt: '2026-05-18 16:00:00',
      durationMinutes: '45',
      teacherId: 'tch_shared',
    },
  ]);

  assert.equal(byMmsId.get('sdt_emily').sharedStudentCount, 2);
  assert.deepEqual(byMmsId.get('sdt_emily').sharedStudentNames, ['Emily Grifa', 'Nina Gavlin']);
  assert.equal(byMmsId.get('sdt_solo').sharedStudentCount, 1);
});
