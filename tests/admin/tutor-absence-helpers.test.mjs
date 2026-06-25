import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoverTutorOptions,
  buildTutorAbsenceMessage,
  buildTutorAbsencePausePlanningBundle,
  buildTutorAbsencePausePlanningItems,
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

test('buildTutorAbsencePausePlanningItems creates finance-visible structured pause plans', () => {
  const plans = buildTutorAbsencePausePlanningItems({
    absenceId: 'tutor_absence:Dean:2026-06-26',
    tutorName: 'Dean Louden',
    tutorShortName: 'Dean',
    absenceDate: '2026-06-26',
    lessons: [{
      eventId: 'evt_1',
      studentMmsId: 'sdt_1',
      studentName: 'Ada Neocleous',
      lessonDate: '2026-06-26',
      paymentExpectation: 'stripe_active_expected',
    }],
    now: new Date('2026-06-20T10:00:00.000Z'),
  });

  assert.equal(plans.length, 1);
  assert.equal(plans[0].planningId, 'planning_tutor_absence_pause_tutor_absence_dean_2026_06_26_sdt_1_evt_1');
  assert.equal(plans[0].item.status, 'active');
  assert.equal(plans[0].item.linkedStudentId, 'sdt_1');
  assert.equal(plans[0].item.linkedWorkflowId, 'tutor-absence');
  assert.match(plans[0].item.title, /Pause Ada Neocleous lesson/u);
  assert.match(plans[0].item.notes, /Pause type: single lesson/u);
  assert.match(plans[0].item.notes, /Lesson date: 2026-06-26/u);
  assert.match(plans[0].item.notes, /Tutor absence ID: tutor_absence:Dean:2026-06-26/u);
});

test('buildTutorAbsencePausePlanningItems skips already paused or not-needed lessons and marks aligned ones done', () => {
  const plans = buildTutorAbsencePausePlanningItems({
    absenceId: 'tutor_absence:Dean:2026-06-26',
    tutorName: 'Dean Louden',
    tutorShortName: 'Dean',
    absenceDate: '2026-06-26',
    lessons: [
      {
        eventId: 'evt_active',
        studentMmsId: 'sdt_active',
        studentName: 'Active Student',
        lessonDate: '2026-06-26',
        paymentExpectation: 'stripe_active_expected',
      },
      {
        eventId: 'evt_aligned',
        studentMmsId: 'sdt_aligned',
        studentName: 'Aligned Student',
        lessonDate: '2026-06-26',
        paymentExpectation: 'stripe_active_expected',
      },
      {
        eventId: 'evt_paused',
        studentMmsId: 'sdt_paused',
        studentName: 'Paused Student',
        lessonDate: '2026-06-26',
        paymentExpectation: 'stripe_paused_expected',
      },
      {
        eventId: 'evt_manual',
        studentMmsId: 'sdt_manual',
        studentName: 'Manual Student',
        lessonDate: '2026-06-26',
        paymentExpectation: 'stripe_active_expected',
      },
    ],
    messageState: {
      evt_aligned: { paymentExpectationAligned: true },
      evt_manual: { pauseSkipped: true },
    },
    now: new Date('2026-06-20T10:00:00.000Z'),
  });

  assert.deepEqual(plans.map((plan) => plan.item.linkedStudentId), ['sdt_active', 'sdt_aligned']);
  assert.deepEqual(plans.map((plan) => plan.item.status), ['active', 'done']);
});

test('buildTutorAbsencePausePlanningBundle groups repeated cancelled lessons into an away period', () => {
  const bundle = buildTutorAbsencePausePlanningBundle({
    rows: [
      {
        absenceId: 'tutor_absence:Tom:2026-07-03',
        tutorShortName: 'Tom',
        tutorName: 'Tom Walters',
        absenceDate: '2026-07-03',
        decision: 'cancel_day',
        affectedLessons: [{
          eventId: 'evt_1',
          studentMmsId: 'sdt_ada',
          studentName: 'Ada Neocleous',
          lessonDate: '2026-07-03',
          paymentExpectation: 'stripe_active_expected',
        }],
        messageState: {},
      },
      {
        absenceId: 'tutor_absence:Tom:2026-07-10',
        tutorShortName: 'Tom',
        tutorName: 'Tom Walters',
        absenceDate: '2026-07-10',
        decision: 'cancel_day',
        affectedLessons: [{
          eventId: 'evt_2',
          studentMmsId: 'sdt_ada',
          studentName: 'Ada Neocleous',
          lessonDate: '2026-07-10',
          paymentExpectation: 'stripe_active_expected',
        }],
        messageState: {},
      },
      {
        absenceId: 'tutor_absence:Tom:2026-07-17',
        tutorShortName: 'Tom',
        tutorName: 'Tom Walters',
        absenceDate: '2026-07-17',
        decision: 'cancel_day',
        affectedLessons: [{
          eventId: 'evt_3',
          studentMmsId: 'sdt_ada',
          studentName: 'Ada Neocleous',
          lessonDate: '2026-07-17',
          paymentExpectation: 'stripe_active_expected',
        }],
        messageState: {},
      },
    ],
    now: new Date('2026-06-25T10:00:00.000Z'),
  });

  assert.equal(bundle.plans.length, 1);
  assert.equal(
    bundle.plans[0].planningId,
    'planning_tutor_absence_pause_period_tom_sdt_ada_2026_07_03_2026_07_17',
  );
  assert.match(bundle.plans[0].item.title, /Pause Ada Neocleous from Fri, 3 Jul 2026; returning Fri, 24 Jul 2026/u);
  assert.match(bundle.plans[0].item.notes, /Pause type: away period/u);
  assert.match(bundle.plans[0].item.notes, /First lesson to pause date: 2026-07-03/u);
  assert.match(bundle.plans[0].item.notes, /Returning from date: 2026-07-24/u);
  assert.match(bundle.plans[0].item.notes, /Tutor absence missed lesson dates: 2026-07-03, 2026-07-10, 2026-07-17/u);
  assert.deepEqual(bundle.supersededPlanningIds, [
    'planning_tutor_absence_pause_tutor_absence_tom_2026_07_03_sdt_ada_evt_1',
    'planning_tutor_absence_pause_tutor_absence_tom_2026_07_10_sdt_ada_evt_2',
    'planning_tutor_absence_pause_tutor_absence_tom_2026_07_17_sdt_ada_evt_3',
  ]);
});

test('buildTutorAbsencePausePlanningBundle keeps separate absence blocks apart', () => {
  const bundle = buildTutorAbsencePausePlanningBundle({
    rows: [
      {
        absenceId: 'tutor_absence:Tom:2026-07-03',
        tutorShortName: 'Tom',
        tutorName: 'Tom Walters',
        absenceDate: '2026-07-03',
        decision: 'cancel_day',
        affectedLessons: [{
          eventId: 'evt_july',
          studentMmsId: 'sdt_ada',
          studentName: 'Ada Neocleous',
          lessonDate: '2026-07-03',
          paymentExpectation: 'stripe_active_expected',
        }],
        messageState: {},
      },
      {
        absenceId: 'tutor_absence:Tom:2026-09-04',
        tutorShortName: 'Tom',
        tutorName: 'Tom Walters',
        absenceDate: '2026-09-04',
        decision: 'cancel_day',
        affectedLessons: [{
          eventId: 'evt_september',
          studentMmsId: 'sdt_ada',
          studentName: 'Ada Neocleous',
          lessonDate: '2026-09-04',
          paymentExpectation: 'stripe_active_expected',
        }],
        messageState: {},
      },
    ],
    now: new Date('2026-06-25T10:00:00.000Z'),
  });

  assert.equal(bundle.plans.length, 2);
  assert.deepEqual(bundle.plans.map((plan) => plan.item.notes.match(/Pause type: ([^.]+)/u)?.[1]), [
    'single lesson',
    'single lesson',
  ]);
});
