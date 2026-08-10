import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LESSON_MIRROR_TIME_ZONE,
  makeLessonMirrorId,
  normaliseMmsLessonMirror,
  parseMmsLessonWallClock,
} from '../../lib/admin/lesson-mirror-helpers.mjs';

test('lesson mirror IDs are deterministic, opaque, and distinct by entity grain', () => {
  const event = makeLessonMirrorId('event', 'evt_123');
  assert.equal(event, makeLessonMirrorId('event', 'evt_123'));
  assert.match(event, /^fc_lev_[a-f0-9]{24}$/u);
  assert.notEqual(event, makeLessonMirrorId('series', 'evt_123'));
  assert.doesNotMatch(event, /evt_123/u);
});

test('MMS wall-clock parsing preserves local summer time without UTC coercion', () => {
  assert.deepEqual(parseMmsLessonWallClock('2026-08-10T18:30:00'), {
    localDate: '2026-08-10',
    localTime: '18:30:00',
    source: '2026-08-10T18:30:00',
    timeZone: LESSON_MIRROR_TIME_ZONE,
  });
  assert.equal(parseMmsLessonWallClock('2026-02-30T18:30:00'), null);
});

test('a group calendar event becomes one event and one participation per student', () => {
  const result = normaliseMmsLessonMirror({
    calendarRows: [{
      ID: 'evt_group',
      SeriesID: 'ser_group',
      StartDate: '2026-08-10T18:30:00',
      Duration: 45,
      TeacherID: 'tch_1',
      Recurring: true,
      RepeatDetails: { Frequency: 'Weekly', Interval: 1 },
      EventCategory: { ID: 'cat_1', Name: 'Group' },
      Attendances: [
        { ID: 'att_1', StudentID: 'sdt_1', AttendanceStatus: 'Unrecorded' },
        { ID: 'att_2', StudentID: 'sdt_2', AttendanceStatus: 'Present' },
      ],
    }],
  });

  assert.equal(result.series.length, 1);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].sourceRecurring, true);
  assert.deepEqual(result.events[0].sourceRecurrence, { Frequency: 'Weekly', Interval: 1 });
  assert.equal(result.participations.length, 2);
  assert.equal(new Set(result.participations.map((row) => row.fcEventId)).size, 1);
  assert.deepEqual(result.participations.map((row) => row.studentExternalId).sort(), ['sdt_1', 'sdt_2']);
  assert.equal(result.externalRefs.filter((row) => row.referenceKind === 'attendance').length, 2);
});

test('attendance enriches the matching calendar participation without becoming event status', () => {
  const result = normaliseMmsLessonMirror({
    calendarRows: [{
      ID: 'evt_1',
      SeriesID: 'ser_1',
      StartDate: '2026-08-10T16:00:00',
      Duration: 30,
      Attendances: [{ StudentID: 'sdt_1', AttendanceStatus: 'Unrecorded' }],
    }],
    attendanceRows: [{
      ID: 'att_1',
      EventID: 'evt_1',
      StudentID: 'sdt_1',
      EventStartDate: '2026-08-10T16:00:00',
      EventDuration: 30,
      AttendanceStatus: 'A-New-MMS-Value',
    }],
  });

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].calendarObserved, true);
  assert.equal(result.events[0].attendanceObserved, true);
  assert.equal(result.events[0].sourceStatus, null);
  assert.equal(result.participations.length, 1);
  assert.equal(result.participations[0].rawAttendanceStatus, 'A-New-MMS-Value');
  assert.equal(result.participations[0].attendanceExternalId, 'att_1');
});

test('attendance can create a standalone event observation outside the calendar window', () => {
  const result = normaliseMmsLessonMirror({
    attendanceRows: [{
      ID: 'att_old',
      EventID: 'evt_old',
      EventSeriesID: 'ser_old',
      StudentID: 'sdt_old',
      EventStartDate: '2026-01-05T15:00:00',
      EventDuration: 30,
      AttendanceStatus: 'Present',
    }],
  });

  assert.equal(result.series.length, 1);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].calendarObserved, false);
  assert.equal(result.events[0].attendanceObserved, true);
  assert.equal(result.events[0].fcSeriesId, result.series[0].fcSeriesId);
  assert.equal(result.participations.length, 1);
});

test('normalisation fails loudly for rows that cannot have stable identity or time', () => {
  assert.throws(
    () => normaliseMmsLessonMirror({ calendarRows: [{ StartDate: '2026-08-10T16:00:00' }] }),
    /no event ID/u,
  );
  assert.throws(
    () => normaliseMmsLessonMirror({ calendarRows: [{ ID: 'evt_bad', StartDate: 'not-a-date' }] }),
    /no valid lesson wall-clock/u,
  );
  assert.throws(
    () => normaliseMmsLessonMirror({
      calendarRows: [{ ID: 'evt_bad', StartDate: '2026-08-10T16:00:00', Attendances: [{}] }],
    }),
    /without a student ID/u,
  );
});

test('different MMS event IDs are not heuristically merged even when the slot matches', () => {
  const result = normaliseMmsLessonMirror({
    calendarRows: [
      { ID: 'evt_deleted', StartDate: '2026-08-10T16:00:00', Duration: 30, TeacherID: 'tch_1' },
      { ID: 'evt_replacement', StartDate: '2026-08-10T16:00:00', Duration: 30, TeacherID: 'tch_1' },
    ],
  });
  assert.equal(result.events.length, 2);
  assert.notEqual(result.events[0].fcEventId, result.events[1].fcEventId);
});
