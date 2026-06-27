import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTutorPay } from '../../lib/admin/cost-helpers.mjs';
import {
  buildPayrollPeriod,
  buildPayrollPreview,
  buildPayrollRunId,
  nextWednesday,
  normalisePayrollRunRow,
  resolveTutorPayrollWindow,
  overlapsPaidRun,
} from '../../lib/admin/payroll-helpers.mjs';

function attendance(overrides = {}) {
  return {
    ID: overrides.attendanceId || `atn_${overrides.EventID || '1'}`,
    EventID: overrides.EventID || 'evt_1',
    TeacherID: overrides.TeacherID || 'tch_zMX5Jc', // Calum
    OriginalTeacherID: overrides.OriginalTeacherID || overrides.TeacherID || 'tch_zMX5Jc',
    AttendanceStatus: overrides.AttendanceStatus || 'Present',
    EventStartDate: overrides.EventStartDate || '2026-06-24T16:00:00',
    EventDuration: overrides.EventDuration ?? 30,
    StudentID: overrides.StudentID || 'sdt_1',
    Student: { ID: overrides.StudentID || 'sdt_1', Name: overrides.StudentName || 'Student One' },
    Teacher: { ID: overrides.TeacherID || 'tch_zMX5Jc', Name: overrides.TeacherName || 'Calum Steel' },
  };
}

test('nextWednesday returns today when today is Wednesday and the next Wednesday otherwise', () => {
  assert.equal(nextWednesday(new Date('2026-06-24T10:00:00Z')), '2026-06-24');
  assert.equal(nextWednesday(new Date('2026-06-25T10:00:00Z')), '2026-07-01');
});

test('buildPayrollPeriod uses Wednesday pay date with weekly and biweekly windows', () => {
  assert.deepEqual(buildPayrollPeriod({ payDate: '2026-07-01', cadence: 'weekly' }), {
    payDate: '2026-07-01',
    periodStart: '2026-06-24',
    periodEnd: '2026-06-30',
    days: 7,
    cadence: 'weekly',
  });
  assert.equal(buildPayrollPeriod({ payDate: '2026-07-01', cadence: 'biweekly' }).periodStart, '2026-06-17');
});

test('buildPayrollPeriod supports a three-week window per tutor', () => {
  const p = buildPayrollPeriod({ payDate: '2026-07-01', cadence: 'three-weekly' });
  assert.equal(p.days, 21);
  assert.equal(p.periodStart, '2026-06-10');
  assert.equal(p.cadence, 'three-weekly');
});

test('a paid run shows £0 owed but keeps finalAmount as the record', () => {
  const preview = buildPayrollPreview({
    payDate: '2026-07-01',
    tutorPay: parseTutorPay([{ tutor: 'Calum', hourly_rate: '24', pay_model: 'hourly' }]),
    attendanceRows: [attendance({ EventID: 'evt_1', EventStartDate: '2026-06-24T16:00:00', EventDuration: 30 })],
    savedRuns: [{ payroll_id: 'payroll_calum_2026-06-24_2026-06-30', status: 'paid', final_amount: '50', expected_amount: '12' }],
  });
  const calum = preview.rows.find((row) => row.tutorShortName === 'Calum');
  assert.equal(calum.status, 'paid');
  assert.equal(calum.owedAmount, 0);
  assert.equal(calum.finalAmount, 50);
  assert.equal(preview.totals.outstandingAmount, 0);
});

test('resolveTutorPayrollWindow anchors to since-last-paid, falls back, caps, and detects empty', () => {
  // since last paid: window starts the day after the last paid period end
  const sincePaid = resolveTutorPayrollWindow({ payDate: '2026-07-01', lastPaidThrough: '2026-06-23' });
  assert.equal(sincePaid.periodStart, '2026-06-24');
  assert.equal(sincePaid.periodEnd, '2026-06-30');
  assert.equal(sincePaid.basis, 'since_paid');

  // first run: cadence length back from the pay date
  const firstRun = resolveTutorPayrollWindow({ payDate: '2026-07-01', cadence: 'weekly' });
  assert.equal(firstRun.periodStart, '2026-06-24');
  assert.equal(firstRun.basis, 'first_run');

  // override beats everything
  const override = resolveTutorPayrollWindow({ payDate: '2026-07-01', lastPaidThrough: '2026-06-23', overrideStart: '2026-06-17' });
  assert.equal(override.periodStart, '2026-06-17');
  assert.equal(override.basis, 'override');

  // very old anchor → capped at maxLookbackDays
  const capped = resolveTutorPayrollWindow({ payDate: '2026-07-01', lastPaidThrough: '2026-01-01', maxLookbackDays: 35 });
  assert.equal(capped.periodStart, '2026-05-27');
  assert.equal(capped.capped, true);

  // already paid through the window end → empty (nothing to pay)
  const empty = resolveTutorPayrollWindow({ payDate: '2026-07-01', lastPaidThrough: '2026-06-30' });
  assert.equal(empty.empty, true);
});

test('overlapsPaidRun flags windows that re-include an already-paid period', () => {
  const paid = [{ periodStart: '2026-06-17', periodEnd: '2026-06-23' }];
  assert.ok(overlapsPaidRun({ periodStart: '2026-06-17', periodEnd: '2026-06-30' }, paid));
  assert.equal(overlapsPaidRun({ periodStart: '2026-06-24', periodEnd: '2026-06-30' }, paid), null);
});

test('buildPayrollPreview anchors a tutor to since-last-paid from their paid runs', () => {
  const preview = buildPayrollPreview({
    payDate: '2026-07-01',
    tutorPay: parseTutorPay([{ tutor: 'Calum', hourly_rate: '24', pay_model: 'hourly' }]),
    attendanceRows: [attendance({ EventID: 'evt_1', EventStartDate: '2026-06-24T16:00:00', EventDuration: 30 })],
    savedRuns: [{ payroll_id: 'payroll_calum_2026-06-10_2026-06-16', tutor_short_name: 'Calum', status: 'paid', period_start: '2026-06-10', period_end: '2026-06-16', final_amount: '24' }],
  });
  const calum = preview.rows.find((row) => row.tutorShortName === 'Calum');
  assert.equal(calum.periodStart, '2026-06-17'); // day after last paid
  assert.equal(calum.windowBasis, 'since_paid');
  assert.equal(calum.lessonCount, 1);
});

test('buildPayrollRunId is stable by tutor and period', () => {
  assert.equal(
    buildPayrollRunId({ tutorKey: 'Calum Steel', periodStart: '2026-06-24', periodEnd: '2026-06-30' }),
    'payroll_calum_steel_2026-06-24_2026-06-30',
  );
});

test('buildPayrollPreview dedupes group attendances and pays once per event slot', () => {
  const preview = buildPayrollPreview({
    payDate: '2026-07-01',
    tutorPay: parseTutorPay([{ tutor: 'Calum', hourly_rate: '24', pay_model: 'hourly' }]),
    attendanceRows: [
      attendance({ EventID: 'evt_group', StudentID: 'a', StudentName: 'A', EventDuration: 45 }),
      attendance({ EventID: 'evt_group', StudentID: 'b', StudentName: 'B', EventDuration: 45 }),
    ],
  });
  const calum = preview.rows.find((row) => row.tutorShortName === 'Calum');
  assert.equal(calum.lessonCount, 1);
  assert.equal(calum.expectedAmount, 20);
  assert.equal(calum.payableSlots[0].studentCount, 2);
});

test('buildPayrollPreview flags unrecorded lessons for review instead of paying them', () => {
  const preview = buildPayrollPreview({
    payDate: '2026-07-01',
    attendanceRows: [
      attendance({ EventID: 'evt_present', AttendanceStatus: 'Present' }),
      attendance({ EventID: 'evt_unrecorded', AttendanceStatus: 'Unrecorded', EventStartDate: '2026-06-25T16:00:00' }),
    ],
  });
  const calum = preview.rows.find((row) => row.tutorShortName === 'Calum');
  assert.equal(calum.lessonCount, 1);
  assert.equal(calum.reviewLessonCount, 1);
  assert.equal(calum.expectedAmount, 12);
});

test('AbsentNoMakeup is payable (invoiced); AbsentNotice is excluded (£0); only Unrecorded needs review', () => {
  const preview = buildPayrollPreview({
    payDate: '2026-07-01',
    tutorPay: parseTutorPay([{ tutor: 'Calum', hourly_rate: '24', pay_model: 'hourly' }]),
    attendanceRows: [
      attendance({ EventID: 'evt_makeup', AttendanceStatus: 'AbsentNoMakeup', EventStartDate: '2026-06-24T16:00:00' }),
      attendance({ EventID: 'evt_notice', AttendanceStatus: 'AbsentNotice', EventStartDate: '2026-06-25T16:00:00' }),
      attendance({ EventID: 'evt_unrec', AttendanceStatus: 'Unrecorded', EventStartDate: '2026-06-26T16:00:00' }),
    ],
  });
  const calum = preview.rows.find((row) => row.tutorShortName === 'Calum');
  // AbsentNoMakeup → payable, paid
  assert.equal(calum.lessonCount, 1);
  assert.equal(calum.expectedAmount, 12);
  // AbsentNotice → excluded, not in review
  assert.equal(calum.excludedLessonCount, 1);
  // only the genuinely unrecorded lesson needs review
  assert.equal(calum.reviewLessonCount, 1);
  // the payable absence is flagged as a paid-absence slot
  assert.equal(calum.payableSlots[0].isPaidAbsence, true);
});

test('a mixed group with AbsentNotice + Unrecorded still needs review', () => {
  const preview = buildPayrollPreview({
    payDate: '2026-07-01',
    tutorPay: parseTutorPay([{ tutor: 'Calum', hourly_rate: '24', pay_model: 'hourly' }]),
    attendanceRows: [
      attendance({ EventID: 'evt_grp', StudentID: 'a', StudentName: 'A', AttendanceStatus: 'AbsentNotice' }),
      attendance({ EventID: 'evt_grp', StudentID: 'b', StudentName: 'B', AttendanceStatus: 'Unrecorded' }),
    ],
  });
  const calum = preview.rows.find((row) => row.tutorShortName === 'Calum');
  assert.equal(calum.reviewLessonCount, 1);
  assert.equal(calum.lessonCount, 0);
});

test('resolveTutorPayrollWindow lets an overrideEnd pull the window end earlier, never later', () => {
  // invoice closed Sunday: end pulled back from Tue 30 Jun to Sun 28 Jun
  const earlier = resolveTutorPayrollWindow({ payDate: '2026-07-01', lastPaidThrough: '2026-06-23', overrideEnd: '2026-06-28' });
  assert.equal(earlier.periodEnd, '2026-06-28');
  assert.equal(earlier.endCustom, true);
  // an end later than the default is ignored (those lessons belong to the next run)
  const later = resolveTutorPayrollWindow({ payDate: '2026-07-01', lastPaidThrough: '2026-06-23', overrideEnd: '2026-07-05' });
  assert.equal(later.periodEnd, '2026-06-30');
  assert.equal(later.endCustom, false);
});

test('buildPayrollPreview applies a per-tutor window end override and excludes later lessons', () => {
  const preview = buildPayrollPreview({
    payDate: '2026-07-01',
    tutorPay: parseTutorPay([{ tutor: 'Calum', hourly_rate: '24', pay_model: 'hourly' }]),
    attendanceRows: [
      attendance({ EventID: 'evt_in', EventStartDate: '2026-06-26T16:00:00' }),
      attendance({ EventID: 'evt_out', EventStartDate: '2026-06-30T16:00:00' }),
    ],
    overrides: { Calum: { end: '2026-06-28' } },
  });
  const calum = preview.rows.find((row) => row.tutorShortName === 'Calum');
  assert.equal(calum.periodEnd, '2026-06-28');
  assert.equal(calum.windowEndCustom, true);
  assert.equal(calum.lessonCount, 1); // the 30 Jun lesson falls outside the window
});

test('buildPayrollPreview uses biweekly cadence per tutor', () => {
  const tutorPay = parseTutorPay([{ tutor: 'Calum', hourly_rate: '24', pay_model: 'hourly', invoice_cadence: 'biweekly' }]);
  const preview = buildPayrollPreview({
    payDate: '2026-07-01',
    tutorPay,
    attendanceRows: [
      attendance({ EventID: 'evt_old', EventStartDate: '2026-06-18T16:00:00' }),
      attendance({ EventID: 'evt_new', EventStartDate: '2026-06-25T16:00:00' }),
    ],
  });
  const calum = preview.rows.find((row) => row.tutorShortName === 'Calum');
  assert.equal(calum.periodStart, '2026-06-17');
  assert.equal(calum.periodEnd, '2026-06-30');
  assert.equal(calum.lessonCount, 2);
  assert.equal(calum.expectedAmount, 24);
});

test('buildPayrollPreview overlays saved reviewed/paid state', () => {
  const preview = buildPayrollPreview({
    payDate: '2026-07-01',
    attendanceRows: [attendance()],
    savedRuns: [{
      payroll_id: 'payroll_calum_2026-06-24_2026-06-30',
      status: 'paid',
      adjustment_amount: '3',
      final_amount: '15',
      invoice_status: 'received',
      paid_at: '2026-07-01T12:00:00Z',
    }],
  });
  const calum = preview.rows.find((row) => row.tutorShortName === 'Calum');
  assert.equal(calum.status, 'paid');
  assert.equal(calum.adjustmentAmount, 3);
  assert.equal(calum.finalAmount, 15);
  assert.equal(calum.invoiceStatus, 'received');
});

test('normalisePayrollRunRow parses sheet rows', () => {
  const row = normalisePayrollRunRow({
    payroll_id: 'p1',
    pay_date: '2026-07-01',
    expected_amount: '£12',
    status: 'Paid',
  });
  assert.equal(row.payrollId, 'p1');
  assert.equal(row.expectedAmount, 12);
  assert.equal(row.status, 'paid');
});

