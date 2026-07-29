import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLifecycleRow,
  summariseLifecycle,
  survivalByCohort,
  yearsBetween,
} from '../../lib/admin/student-lifecycle.mjs';

const TODAY = '2026-07-28';

function lesson(date, status = 'Present') {
  return { EventStartDate: `${date}T15:00:00`, AttendanceStatus: status };
}

test('yearsBetween measures whole elapsed years', () => {
  assert.equal(yearsBetween('2024-07-28', '2026-07-28'), 2);
  assert.equal(yearsBetween('2026-01-28', '2026-07-28'), 0.5);
  assert.equal(yearsBetween('', '2026-07-28'), null);
  assert.equal(yearsBetween('not-a-date', '2026-07-28'), null);
});

test('future scheduled lessons do not become the last lesson', () => {
  // The bug this pins: MMS returns booked future lessons in the same list, so a
  // naive max() puts every active student's "last lesson" years ahead and makes
  // them look long departed.
  const row = buildLifecycleRow({
    student: { ID: 'sdt_a', FullName: 'Active Ada', Active: true },
    lessons: [lesson('2025-09-01'), lesson('2026-07-20'), lesson('2028-08-28')],
    today: TODAY,
  });

  assert.equal(row.lastLesson, '2026-07-20');
  assert.equal(row.nextLesson, '2028-08-28');
  assert.equal(row.lessonsPast, 2);
  assert.equal(row.lessonsFuture, 1);
});

test('an active student gets a tenure and no lifetime', () => {
  const row = buildLifecycleRow({
    student: { ID: 'sdt_a', Active: true },
    lessons: [lesson('2024-07-28'), lesson('2026-07-20')],
    today: TODAY,
  });

  assert.equal(row.departed, 'FALSE');
  assert.equal(row.tenureYears, 2);
  assert.equal(row.lifetimeYears, null);
});

test('a departed student gets a lifetime and no tenure', () => {
  const row = buildLifecycleRow({
    student: { ID: 'sdt_b', Active: false },
    lessons: [lesson('2023-07-28'), lesson('2024-07-28')],
    today: TODAY,
  });

  assert.equal(row.departed, 'TRUE');
  assert.equal(row.lifetimeYears, 1);
  assert.equal(row.tenureYears, null);
});

test('inactive but with lessons booked is not treated as departed', () => {
  // Usually a pause or an admin lag. Counting it as a departure would inflate
  // churn and, worse, tell a workflow that a current family has left.
  const row = buildLifecycleRow({
    student: { ID: 'sdt_c', Active: false },
    lessons: [lesson('2026-06-01'), lesson('2026-09-01')],
    today: TODAY,
  });

  assert.equal(row.departed, 'FALSE');
  assert.equal(row.lifetimeYears, null);
});

test('only genuine attendance counts as a lesson taught', () => {
  const row = buildLifecycleRow({
    student: { ID: 'sdt_d', Active: true },
    lessons: [
      lesson('2026-01-05', 'Present'),
      lesson('2026-01-12', 'AbsentNotice'),
      lesson('2026-01-19', 'Attended'),
      lesson('2026-01-26', 'Unrecorded'),
    ],
    today: TODAY,
  });

  assert.equal(row.lessonsPast, 4);
  assert.equal(row.attended, 2);
});

test('a student booked but not yet started has no tenure, not a negative one', () => {
  // Found live: enrolled students with only future lessons were getting a
  // firstLesson in the future and a tenure of -0.1y, pulling the school-wide
  // median tenure down by nearly three months.
  const row = buildLifecycleRow({
    student: { ID: 'sdt_new', Active: true },
    lessons: [lesson('2026-09-01', null)],
    today: TODAY,
  });

  assert.equal(row.firstLesson, '');
  assert.equal(row.tenureYears, null);
  assert.equal(row.nextLesson, '2026-09-01');
  assert.equal(row.lessonsPast, 0);
  assert.equal(row.lessonsFuture, 1);
});

test('summary excludes not-yet-started students from the tenure median', () => {
  const rows = [
    { firstLesson: '', lastLesson: '', departed: 'FALSE', tenureYears: null, attended: 0 },
    { firstLesson: '2024-07-28', lastLesson: '2026-07-20', departed: 'FALSE', tenureYears: 2, attended: 60 },
    { firstLesson: '2022-07-28', lastLesson: '2026-07-20', departed: 'FALSE', tenureYears: 4, attended: 120 },
  ];

  const summary = summariseLifecycle(rows, { today: TODAY });

  assert.equal(summary.studentsWithHistory, 2);
  assert.equal(summary.activeStudents, 2);
  assert.equal(summary.medianTenureYears, 3);
});

test('a student with no lessons at all produces a blank, not a crash', () => {
  const row = buildLifecycleRow({ student: { ID: 'sdt_e', Active: false }, lessons: [], today: TODAY });

  assert.equal(row.firstLesson, '');
  assert.equal(row.lastLesson, '');
  assert.equal(row.tenureYears, null);
  assert.equal(row.lifetimeYears, null);
});

test('survival excludes students whose cohort has not had the full window', () => {
  // THE regression. Comparing average lifetime-of-leavers across cohorts shows a
  // fake collapse, because a student who started three months ago cannot have
  // lasted a year. A cohort that has not had N months must be reported as
  // unmeasurable (null), never as a failure.
  const rows = [
    // 2026 cohort: started four months ago, all still here. Past the three-month
    // horizon, nowhere near the twelve-month one.
    ...Array.from({ length: 6 }, (_, i) => ({
      firstLesson: '2026-03-20', lastLesson: '2026-07-20', departed: 'FALSE', attended: 10 + i,
    })),
  ];

  const [cohort] = survivalByCohort(rows, { today: TODAY, horizonsMonths: [3, 12] });

  const threeMonth = cohort.horizons.find((h) => h.months === 3);
  const twelveMonth = cohort.horizons.find((h) => h.months === 12);

  assert.equal(threeMonth.rate, 100, 'they have had three months and all survived');
  assert.equal(twelveMonth.rate, null, 'they cannot yet be judged at twelve months');
  assert.equal(twelveMonth.eligible, 0);
});

test('survival counts a leaver who passed the horizon as survived', () => {
  const rows = [
    ...Array.from({ length: 5 }, () => ({
      firstLesson: '2022-01-01', lastLesson: '2024-01-01', departed: 'TRUE', attended: 50,
    })),
    ...Array.from({ length: 5 }, () => ({
      firstLesson: '2022-01-01', lastLesson: '2022-02-01', departed: 'TRUE', attended: 3,
    })),
  ];

  const [cohort] = survivalByCohort(rows, { today: TODAY, horizonsMonths: [12] });
  const twelve = cohort.horizons.find((h) => h.months === 12);

  // Five lasted two years, five lasted one month.
  assert.equal(twelve.eligible, 10);
  assert.equal(twelve.rate, 50);
});

test('small cohorts are dropped rather than reported as noise', () => {
  const rows = [{ firstLesson: '2019-01-01', lastLesson: '2019-02-01', departed: 'TRUE', attended: 2 }];
  assert.deepEqual(survivalByCohort(rows, { today: TODAY }), []);
});

test('summary separates never-started leavers from real departures', () => {
  const rows = [
    // Signed up, never really came.
    { firstLesson: '2026-01-05', lastLesson: '2026-01-05', departed: 'TRUE', lifetimeYears: 0, attended: 0 },
    { firstLesson: '2026-01-05', lastLesson: '2026-01-12', departed: 'TRUE', lifetimeYears: 0.02, attended: 1 },
    // Came for a term, then left.
    { firstLesson: '2026-01-05', lastLesson: '2026-03-20', departed: 'TRUE', lifetimeYears: 0.2, attended: 9 },
    // Still here, four years in.
    { firstLesson: '2022-07-28', lastLesson: '2026-07-20', departed: 'FALSE', tenureYears: 4, attended: 120 },
  ];

  const summary = summariseLifecycle(rows, { today: TODAY });

  assert.equal(summary.departedStudents, 3);
  assert.equal(summary.departuresWithinThreeMonths, 3);
  assert.equal(summary.departuresNeverStarted, 2, 'zero- and one-lesson leavers');
  assert.equal(summary.activeStudents, 1);
  assert.equal(summary.tenureThreeYearsPlus, 1);
  assert.equal(summary.longestTenureYears, 4);
});

test('summary is empty-safe', () => {
  const summary = summariseLifecycle([], { today: TODAY });

  assert.equal(summary.studentsWithHistory, 0);
  assert.equal(summary.medianTenureYears, null);
  assert.equal(summary.medianLifetimeYears, null);
});
