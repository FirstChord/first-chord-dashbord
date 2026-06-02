import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoverTutorOptions,
  buildTutorAbsenceMessage,
  formatTutorAbsenceDate,
  normaliseTutorAbsenceEvent,
  summariseTutorAbsenceState,
} from '../../lib/admin/tutor-absence-helpers.mjs';

test('normaliseTutorAbsenceEvent preserves MMS wall-clock lesson time', () => {
  const studentByMmsId = new Map([
    ['sdt_1', {
      fullName: 'Ada Neocleous',
      parentFirstName: 'Parent',
      parentLastName: 'Ada',
      instrument: 'Piano',
      email: 'parent@example.com',
      contactNumber: '07123456789',
    }],
  ]);

  const lesson = normaliseTutorAbsenceEvent({
    ID: 'evt_1',
    StudentID: 'sdt_1',
    StartDate: '2026-06-04T18:30:00',
    Duration: 30,
  }, studentByMmsId);

  assert.equal(lesson.lessonTime, '18:30');
  assert.equal(lesson.studentName, 'Ada Neocleous');
  assert.equal(lesson.parentName, 'Parent Ada');
});

test('buildCoverTutorOptions only suggests tutors with matching instruments', () => {
  const options = buildCoverTutorOptions({
    absentTutor: { teacherId: 'tch_dean' },
    lessons: [
      { instrument: 'Guitar' },
      { instrument: 'Bass' },
    ],
    tutors: [
      { shortName: 'Dean', fullName: 'Dean Louden', teacherId: 'tch_dean', instruments: ['guitar', 'bass'] },
      { shortName: 'Tom', fullName: 'Tom Walters', teacherId: 'tch_tom', instruments: ['guitar', 'bass'] },
      { shortName: 'Chloe', fullName: 'Chloe Mak', teacherId: 'tch_chloe', instruments: ['singing', 'piano'] },
    ],
  });

  assert.deepEqual(options.map((tutor) => tutor.shortName), ['Tom']);
  assert.deepEqual(options[0].matchedInstruments, ['guitar', 'bass']);
});

test('buildTutorAbsenceMessage creates cancellation and cover parent copy', () => {
  const lesson = {
    parentName: 'Rachel Slocombe',
    studentName: 'Tabitha Slocombe',
    lessonTime: '16:30',
  };

  assert.match(formatTutorAbsenceDate('2026-06-04'), /Thursday 4th June/);
  assert.match(buildTutorAbsenceMessage({
    lesson,
    tutorName: 'Dean Louden',
    absenceDate: '2026-06-04',
    decision: 'cancel_day',
  }), /won’t be going ahead/);
  assert.match(buildTutorAbsenceMessage({
    lesson,
    tutorName: 'Dean Louden',
    absenceDate: '2026-06-04',
    decision: 'cover',
    coverTutorName: 'Tom Walters',
  }), /Tom Walters to cover/);
});

test('summariseTutorAbsenceState counts parent messages left', () => {
  const summary = summariseTutorAbsenceState({
    lessons: [{ eventId: 'evt_1' }, { eventId: 'evt_2' }],
    messageState: { evt_1: { messaged: true } },
  });

  assert.equal(summary.totalLessons, 2);
  assert.equal(summary.messagedCount, 1);
  assert.equal(summary.remainingMessages, 1);
  assert.equal(summary.allMessaged, false);
});
