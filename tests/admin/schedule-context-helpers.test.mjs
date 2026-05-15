import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveScheduleContextFromMms } from '../../lib/admin/schedule-context-helpers.mjs';

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
