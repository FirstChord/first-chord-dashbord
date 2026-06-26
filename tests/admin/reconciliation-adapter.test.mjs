import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReconciliationInputs, resolvePauseMatchConfidence } from '../../lib/admin/reconciliation-adapter.mjs';
import { parseTutorPay } from '../../lib/admin/cost-helpers.mjs';

test('resolvePauseMatchConfidence: agreement → high, disagreement → low', () => {
  assert.equal(resolvePauseMatchConfidence({ pauseMatchConfidence: 'high', paymentExpectation: 'stripe_paused_expected' }), 'high');
  assert.equal(resolvePauseMatchConfidence({ pauseMatchConfidence: 'high', paymentExpectation: 'stripe_active_expected' }), 'low'); // lane conflict
  assert.equal(resolvePauseMatchConfidence({ pauseMatchConfidence: 'low', paymentExpectation: 'stripe_paused_expected' }), 'low');
  assert.equal(resolvePauseMatchConfidence({ pauseMatchConfidence: 'high', paymentExpectation: 'payment_not_needed' }), 'high');
});

const absenceRow = (overrides = {}) => ({
  absenceId: 'abs1',
  tutorShortName: 'Tom',
  tutorName: 'Tom Walters',
  decision: 'cancel_day',
  coverTutorShortName: '',
  coverTutorName: '',
  affectedLessons: [
    { eventId: 'e1', studentMmsId: 's1', studentName: 'A', instrument: 'Guitar', lessonDate: '2026-07-06', lessonTime: '16:00', durationMinutes: '30', studentCount: 1, paymentExpectation: 'stripe_active_expected' },
  ],
  ...overrides,
});

const salariedTom = parseTutorPay([{ tutor: 'Tom Walters', pay_model: 'salary', monthly_salary: '2400' }]);

test('maps cancel_day → cancel; salaried tutor → £0 tutor pay; prices the lesson', () => {
  const { lessonInstances } = buildReconciliationInputs({ absenceRows: [absenceRow()], pauseRows: [], tutorPay: salariedTom });
  assert.equal(lessonInstances.length, 1);
  const i = lessonInstances[0];
  assert.equal(i.absence.decision, 'cancel');
  assert.equal(i.tutorPayAmount, 0); // Tom salaried
  assert.equal(i.lessonValue, 25); // 30-min 1:1
  assert.equal(i.studentMmsId, 's1');
});

test('hourly tutor → per-slot pay is priced', () => {
  const hourly = parseTutorPay([]); // nobody listed → default £24/hr
  const { lessonInstances } = buildReconciliationInputs({
    absenceRows: [absenceRow({ tutorName: 'Patrick', tutorShortName: 'Patrick' })],
    pauseRows: [],
    tutorPay: hourly,
  });
  assert.equal(lessonInstances[0].tutorPayAmount, 12); // 30 min @ £24/hr
});

test('only includes the requested tutor and cancel/cover decisions', () => {
  const rows = [
    absenceRow(),
    absenceRow({ absenceId: 'abs2', tutorShortName: 'Fennella', tutorName: 'Fennella McCallum' }),
    absenceRow({ absenceId: 'abs3', decision: 'pending' }),
  ];
  const { lessonInstances } = buildReconciliationInputs({ absenceRows: rows, pauseRows: [], tutorPay: salariedTom, tutorFilter: 'tom' });
  assert.equal(lessonInstances.length, 1);
});

test('live student payment_expectation overrides the stale absence snapshot', () => {
  // snapshot in the absence row says active; live record says paused → live wins
  const studentsByMmsId = new Map([['s1', { mmsId: 's1', paymentExpectation: 'stripe_paused_expected' }]]);
  const { lessonInstances } = buildReconciliationInputs({ absenceRows: [absenceRow()], pauseRows: [], tutorPay: salariedTom, studentsByMmsId });
  assert.equal(lessonInstances[0].paymentExpectation, 'stripe_paused_expected');
});

test('group lesson → group kind and per-student instances', () => {
  const row = absenceRow({
    affectedLessons: [
      { eventId: 'eG', studentMmsId: 'g1', studentName: 'G1', instrument: 'Piano', lessonDate: '2026-07-06', lessonTime: '16:00', durationMinutes: '45', studentCount: 2 },
    ],
  });
  const { lessonInstances } = buildReconciliationInputs({ absenceRows: [row], pauseRows: [], tutorPay: salariedTom });
  assert.equal(lessonInstances[0].lessonKind, 'group');
  assert.equal(lessonInstances[0].lessonValue, 20); // group per-student price
});
