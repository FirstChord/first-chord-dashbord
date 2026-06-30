import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAttendanceSummary,
  buildTutorDaySchedule,
  normaliseTutorScheduleEvent,
} from '../../lib/tutor-schedule-helpers.mjs';

test('normaliseTutorScheduleEvent preserves MMS wall-clock time and student names', () => {
  const lesson = normaliseTutorScheduleEvent({
    ID: 'evt_123',
    StartDate: '2026-07-02T18:30:00',
    Duration: 45,
    TeacherID: 'tch_1',
    EventCategory: { Name: 'Lesson' },
    Attendances: [
      {
        ID: 'atn_1',
        StudentID: 'sdt_1',
        StudentFullName: 'Ada Student',
        AttendanceStatus: 'Unrecorded',
      },
      {
        ID: 'atn_2',
        StudentID: 'sdt_2',
        StudentFullName: 'Ben Student',
        AttendanceStatus: 'Unrecorded',
      },
    ],
  });

  assert.equal(lesson.eventId, 'evt_123');
  assert.equal(lesson.lessonDate, '2026-07-02');
  assert.equal(lesson.lessonTime, '18:30');
  assert.equal(lesson.durationMinutes, 45);
  assert.deepEqual(lesson.studentMmsIds, ['sdt_1', 'sdt_2']);
  assert.deepEqual(lesson.studentNames, ['Ada Student', 'Ben Student']);
  assert.equal(lesson.studentLabel, 'Ada Student, Ben Student');
  assert.deepEqual(lesson.attendanceIds, ['atn_1', 'atn_2']);
  assert.equal(lesson.attendanceSummary.label, 'Expected');
  assert.equal(lesson.attendanceSummary.requiresPracticeVideo, false);
});

test('buildTutorDaySchedule sorts lessons and excludes MMS Free slots', () => {
  const schedule = buildTutorDaySchedule([
    {
      ID: 'evt_late',
      StartDate: '2026-07-02T19:00:00',
      Duration: 30,
      EventCategory: { Name: 'Lesson' },
      Attendances: [{ StudentID: 'sdt_2', StudentFullName: 'Late Student' }],
    },
    {
      ID: 'evt_free',
      StartDate: '2026-07-02T17:00:00',
      Duration: 30,
      EventCategory: { Name: 'Free' },
    },
    {
      ID: 'evt_early',
      StartDate: '2026-07-02T16:30:00',
      Duration: 30,
      EventCategory: { Name: 'Lesson' },
      Attendances: [{ StudentID: 'sdt_1', StudentFullName: 'Early Student' }],
    },
  ]);

  assert.equal(schedule.lessonCount, 2);
  assert.equal(schedule.studentCount, 2);
  assert.equal(schedule.firstLessonTime, '16:30');
  assert.equal(schedule.lastLessonTime, '19:00');
  assert.deepEqual(schedule.lessons.map((lesson) => lesson.eventId), ['evt_early', 'evt_late']);
});

test('buildAttendanceSummary shows absence with notice without implying action', () => {
  const summary = buildAttendanceSummary(['AbsentNotice']);

  assert.equal(summary.label, 'Absent');
  assert.equal(summary.detail, 'Notice given');
  assert.equal(summary.expectedAbsent, true);
  assert.equal(summary.absenceNotice, 'with_notice');
  assert.equal(summary.requiresPracticeVideo, false);
});

test('buildAttendanceSummary distinguishes no-notice absence without adding a tutor action', () => {
  const summary = buildAttendanceSummary(['AbsentNoMakeup']);

  assert.equal(summary.label, 'Absent');
  assert.equal(summary.detail, 'No notice recorded');
  assert.equal(summary.expectedAbsent, true);
  assert.equal(summary.absenceNotice, 'without_notice');
  assert.equal(summary.requiresPracticeVideo, false);
});

test('buildAttendanceSummary treats unrecorded lessons as expected', () => {
  const summary = buildAttendanceSummary(['Unrecorded']);

  assert.equal(summary.label, 'Expected');
  assert.equal(summary.expectedAbsent, false);
  assert.equal(summary.absenceNotice, 'none');
});
