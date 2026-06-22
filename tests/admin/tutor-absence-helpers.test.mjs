import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoverTutorOptions,
  buildTutorAbsenceMessage,
  formatTutorAbsenceDate,
  isTutorAbsencePaymentHandled,
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
      paymentMode: 'stripe',
      paymentExpectation: 'stripe_active_expected',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
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
  assert.equal(lesson.paymentMode, 'stripe');
  assert.equal(lesson.paymentExpectation, 'stripe_active_expected');
  assert.equal(lesson.stripeCustomerId, 'cus_123');
  assert.equal(lesson.stripeSubscriptionId, 'sub_123');
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
  const coverMessage = buildTutorAbsenceMessage({
    lesson,
    tutorName: 'Dean Louden',
    absenceDate: '2026-06-04',
    decision: 'cover',
    coverTutorName: 'Tom Walters',
  });
  assert.match(coverMessage, /covered by Tom/);
  assert.match(coverMessage, /Tom is up to speed/);
  assert.doesNotMatch(coverMessage, /Tom Walters/);
  assert.doesNotMatch(coverMessage, /16:30/);
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
  assert.equal(summary.canResolve, false);
});

test('summariseTutorAbsenceState requires cover confirmation and briefing for cover lessons', () => {
  const lessons = [{ eventId: 'evt_1' }, { eventId: 'evt_2' }];

  const incomplete = summariseTutorAbsenceState({
    lessons,
    decision: 'cover',
    coverTutorName: 'Chloe Mak',
    messageState: {
      evt_1: { messaged: true },
      evt_2: { messaged: true },
      __workflow: { coverTutorConfirmed: true },
    },
  });

  assert.equal(incomplete.allMessaged, true);
  assert.equal(incomplete.coverReady, false);
  assert.equal(incomplete.canResolve, false);

  const complete = summariseTutorAbsenceState({
    lessons,
    decision: 'cover',
    coverTutorName: 'Chloe Mak',
    messageState: {
      evt_1: { messaged: true },
      evt_2: { messaged: true },
      __workflow: { coverTutorConfirmed: true, coverTutorBriefed: true },
    },
  });

  assert.equal(complete.coverReady, true);
  assert.equal(complete.canResolve, true);
});

test('summariseTutorAbsenceState requires payment handling for cancelled lessons', () => {
  const lessons = [{ eventId: 'evt_1' }, { eventId: 'evt_2' }];

  assert.equal(isTutorAbsencePaymentHandled(lessons[0], { pauseToolRan: true }), false);
  assert.equal(isTutorAbsencePaymentHandled(lessons[0], { pauseSkipped: true }), true);

  const incomplete = summariseTutorAbsenceState({
    lessons,
    decision: 'cancel_day',
    messageState: {
      evt_1: { messaged: true, pauseToolRan: true, paymentExpectationAligned: true },
      evt_2: { messaged: true },
    },
  });

  assert.equal(incomplete.allMessaged, true);
  assert.equal(incomplete.paymentHandledCount, 1);
  assert.equal(incomplete.remainingPaymentActions, 1);
  assert.equal(incomplete.paymentComplete, false);
  assert.equal(incomplete.canResolve, false);

  const complete = summariseTutorAbsenceState({
    lessons,
    decision: 'cancel_day',
    messageState: {
      evt_1: { messaged: true, pauseToolRan: true, paymentExpectationAligned: true },
      evt_2: { messaged: true, pauseSkipped: true, pauseSkipReason: 'Manual payer' },
    },
  });

  assert.equal(complete.paymentHandledCount, 2);
  assert.equal(complete.remainingPaymentActions, 0);
  assert.equal(complete.paymentComplete, true);
  assert.equal(complete.canResolve, true);
});
