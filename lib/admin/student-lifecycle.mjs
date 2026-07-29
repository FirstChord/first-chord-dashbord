// Student lifecycle: how long each student has been with the school, and how
// long the ones who left actually stayed.
//
// This is derived from MMS lesson history, which is the only place the school's
// own past is recorded — MMS holds attendance back to 2019, but nothing read it
// until 2026-07-28, so tenure and lifetime were simply unavailable as facts.
//
// Two things live here and they answer different questions:
//   per-student rows  — "how long has THIS family been with us", the denominator
//                       that makes every other signal readable (two cancellations
//                       from a four-year family is not two from a new one)
//   cohort survival   — "are we keeping students better than we used to"
//
// Pure functions only. Fetching and writing live in the script and the sheets
// module, so the arithmetic below can be tested without touching MMS or Sheets.

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const DAYS_PER_YEAR = 365.25;

// Attendance statuses that mean the student was actually taught. Anything else
// (absences, cancellations, unrecorded) still marks a scheduled lesson but is
// not evidence of a lesson delivered.
export const ATTENDED_STATUSES = new Set(['Present', 'Attended', 'Completed']);

export function toIsoDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const candidate = text.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/u.test(candidate) ? candidate : '';
}

function dayNumber(isoDate) {
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isFinite(time) ? time / MS_PER_DAY : null;
}

/** Whole years between two ISO dates, or null if either is unusable. */
export function yearsBetween(fromIso, toIso) {
  const a = dayNumber(toIsoDate(fromIso));
  const b = dayNumber(toIsoDate(toIso));
  if (a === null || b === null) return null;
  return Math.round(((b - a) / DAYS_PER_YEAR) * 100) / 100;
}

/**
 * Build one student's lifecycle row from their lesson history.
 *
 * `lessons` is the raw MMS attendance list. Note that MMS returns FUTURE
 * scheduled lessons alongside past ones, so last_lesson must be capped at
 * today — without that, every active student appears to have left in 2028.
 */
export function buildLifecycleRow({ student = {}, lessons = [], today } = {}) {
  const todayIso = toIsoDate(today);
  const dated = lessons
    .map((lesson) => ({ date: toIsoDate(lesson?.EventStartDate), status: lesson?.AttendanceStatus }))
    .filter((lesson) => lesson.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const past = dated.filter((lesson) => lesson.date <= todayIso);
  const future = dated.filter((lesson) => lesson.date > todayIso);
  const attended = past.filter((lesson) => ATTENDED_STATUSES.has(lesson.status)).length;

  // Only a lesson that has actually happened starts the clock. Falling back to
  // a booked future lesson gives a student who has signed up but not yet begun
  // a NEGATIVE tenure, which is meaningless on its own and quietly drags the
  // school-wide median down when a few of them are in the roster.
  const firstLesson = past[0]?.date || '';
  const lastLesson = past[past.length - 1]?.date || '';
  const isActive = student.Active === true || String(student.Active).toUpperCase() === 'TRUE';

  // A student counts as departed when they are inactive AND have nothing booked.
  // Inactive-with-future-lessons is usually a pause or an admin lag, not a leave.
  const departed = !isActive && future.length === 0;

  return {
    mmsId: student.ID || student.mms_id || '',
    studentName: student.FullName || student.name || '',
    status: student.Status || '',
    active: isActive ? 'TRUE' : 'FALSE',
    dateStarted: toIsoDate(student.DateStarted),
    firstLesson,
    lastLesson,
    nextLesson: future[0]?.date || '',
    lessonsPast: past.length,
    lessonsFuture: future.length,
    attended,
    // Tenure is for people still here; lifetime is for people who left. Only one
    // is ever meaningful for a given student, so the other stays blank rather
    // than carrying a number that invites the wrong comparison.
    tenureYears: !departed && firstLesson ? yearsBetween(firstLesson, todayIso) : null,
    lifetimeYears: departed && firstLesson && lastLesson ? yearsBetween(firstLesson, lastLesson) : null,
    departed: departed ? 'TRUE' : 'FALSE',
    refreshedAt: todayIso,
  };
}

/**
 * Survival at a fixed horizon, per start-year cohort.
 *
 * The trap this function exists to avoid: comparing the average lifetime of
 * students who left, by cohort. That number falls every year no matter what,
 * because a student who started six months ago CANNOT have lasted a year — it
 * measures elapsed time, not retention, and reads as a collapse that isn't
 * happening.
 *
 * The fix is to ask a question every cohort can answer equally: of the students
 * who have had at least N months to reach N months, what share did? Students
 * whose cohort has not yet had N months elapsed are excluded, not counted as
 * failures.
 */
export function survivalByCohort(rows = [], { today, horizonsMonths = [3, 6, 12, 24], minCohortSize = 5 } = {}) {
  const todayIso = toIsoDate(today);
  const byYear = new Map();

  for (const row of rows) {
    if (!row.firstLesson) continue;
    const year = row.firstLesson.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(row);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, cohort]) => ({
      cohort: year,
      started: cohort.length,
      stillActive: cohort.filter((row) => row.departed !== 'TRUE').length,
      horizons: horizonsMonths.map((months) => {
        const needed = months / 12;
        // Only students who have had the full window available can be judged.
        const eligible = cohort.filter((row) => {
          const elapsed = yearsBetween(row.firstLesson, todayIso);
          return elapsed !== null && elapsed >= needed;
        });

        if (eligible.length < minCohortSize) {
          return { months, eligible: eligible.length, survived: null, rate: null };
        }

        const survived = eligible.filter((row) => {
          if (row.departed !== 'TRUE') return true;
          const lasted = yearsBetween(row.firstLesson, row.lastLesson);
          return lasted !== null && lasted >= needed;
        }).length;

        return {
          months,
          eligible: eligible.length,
          survived,
          rate: Math.round((survived / eligible.length) * 100),
        };
      }),
    }))
    .filter((entry) => entry.started >= minCohortSize);
}

// A lesson is "marked" when a human made a definite call about it — present,
// absent with notice, teacher absent, anything. A marked absence is a success,
// not a failure: the goal is engagement with the calendar, not attendance rate.
// Same boundary resolveSlotState already uses to gate payroll.
const UNMARKED_STATUSES = new Set(['', 'unrecorded']);

// Recent lessons may legitimately not be marked yet, so counting them would keep
// the figure permanently pessimistic and unimprovable.
export const MARKING_MATURITY_DAYS = 14;

export function isLessonMarked(status) {
  return !UNMARKED_STATUSES.has(`${status ?? ''}`.trim().toLowerCase());
}

/**
 * What share of calendar lessons carry a definite attendance status.
 *
 * This is the dial that validates everything else here. Retention figures depend
 * on knowing when a student stopped, which depends on the register being kept —
 * so if this falls, the numbers next to it degrade silently and nothing else
 * announces it.
 *
 * `lessons` is a flat list of `{ date, status }` across all students.
 */
export function summariseMarking(lessons = [], { today, maturityDays = MARKING_MATURITY_DAYS } = {}) {
  const todayIso = toIsoDate(today);
  const todayDay = todayIso ? Date.parse(`${todayIso}T00:00:00Z`) / MS_PER_DAY : null;
  if (todayDay === null) return { byYear: [], trailingTwelveMonths: null };

  const matureBefore = todayDay - maturityDays;
  const twelveMonthsAgo = todayDay - DAYS_PER_YEAR;

  const byYear = new Map();
  let recentTotal = 0;
  let recentMarked = 0;

  for (const lesson of lessons) {
    const date = toIsoDate(lesson?.date);
    if (!date) continue;
    const day = Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY;
    if (!Number.isFinite(day) || day > matureBefore) continue;

    const marked = isLessonMarked(lesson.status);
    const year = date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, { year, total: 0, marked: 0 });
    const bucket = byYear.get(year);
    bucket.total += 1;
    if (marked) bucket.marked += 1;

    if (day >= twelveMonthsAgo) {
      recentTotal += 1;
      if (marked) recentMarked += 1;
    }
  }

  const rate = (marked, total) => (total ? Math.round((marked / total) * 100) : null);

  return {
    byYear: [...byYear.values()]
      .sort((a, b) => a.year.localeCompare(b.year))
      .map((bucket) => ({ ...bucket, rate: rate(bucket.marked, bucket.total) })),
    trailingTwelveMonths: recentTotal
      ? { total: recentTotal, marked: recentMarked, rate: rate(recentMarked, recentTotal) }
      : null,
  };
}

/**
 * The one line shown on a student record: how long this family has been with us.
 *
 * Deliberately a sentence and not a badge, tier or metric. Tenure never demands
 * an action on its own — nobody should do something *because* a student has been
 * here four years. It changes how the thing you were already looking at should
 * be read: two cancellations from a four-year family are not two from a
 * two-month one. So it has to be present and silent, which is what a line of
 * text is and what a card is not.
 *
 * The lesson count is deliberately omitted. Student_Lifecycle refreshes termly,
 * which is fine for a figure that ages a day per day and visibly wrong for a
 * count that should move every week.
 *
 * Returns '' when there is nothing honest to say — no row yet, or a student who
 * has signed up but not started. Callers render nothing rather than a placeholder.
 */
export function formatTimeWithSchool(row = {}) {
  if (!row || !row.firstLesson) return '';

  const years = row.departed === 'TRUE' ? row.lifetimeYears : row.tenureYears;
  // Number(null) and Number('') are both 0, not NaN, so an absent value would
  // otherwise render as "less than a month" — claiming a leaver barely started.
  if (years === null || years === undefined || years === '') return '';

  const value = Number(years);
  if (!Number.isFinite(value) || value < 0) return '';

  const totalMonths = Math.max(Math.round(value * 12), 0);
  const wholeYears = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  let span;
  if (totalMonths < 1) span = 'less than a month';
  else if (!wholeYears) span = `${months} month${months === 1 ? '' : 's'}`;
  else if (!months) span = `${wholeYears} year${wholeYears === 1 ? '' : 's'}`;
  else span = `${wholeYears} year${wholeYears === 1 ? '' : 's'} ${months} month${months === 1 ? '' : 's'}`;

  return row.departed === 'TRUE' ? `Was with us ${span}` : `With us ${span}`;
}

function median(values = []) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 100) / 100;
}

/** One row's worth of school-level summary, for the append-only snapshot lane. */
export function summariseLifecycle(rows = [], { today } = {}) {
  const todayIso = toIsoDate(today);
  const taught = rows.filter((row) => row.firstLesson);
  const departed = taught.filter((row) => row.departed === 'TRUE' && row.lifetimeYears !== null);
  const current = taught.filter((row) => row.departed !== 'TRUE' && row.tenureYears !== null);

  const lifetimes = departed.map((row) => row.lifetimeYears);
  const tenures = current.map((row) => row.tenureYears);

  // Departures inside the first term, split by whether the student ever really
  // started. Zero-or-one-lesson leavers are a sign-up conversion problem, not a
  // teaching one, and lumping them in with real departures hides both.
  const earlyLeavers = departed.filter((row) => row.lifetimeYears < 0.25);
  const neverStarted = earlyLeavers.filter((row) => row.attended <= 1);

  return {
    snapshotAt: todayIso,
    studentsWithHistory: taught.length,
    activeStudents: current.length,
    departedStudents: departed.length,
    medianTenureYears: median(tenures),
    longestTenureYears: tenures.length ? Math.max(...tenures) : null,
    tenureThreeYearsPlus: tenures.filter((value) => value >= 3).length,
    medianLifetimeYears: median(lifetimes),
    longestLifetimeYears: lifetimes.length ? Math.max(...lifetimes) : null,
    medianLessonsBeforeLeaving: median(departed.map((row) => row.attended)),
    departuresWithinThreeMonths: earlyLeavers.length,
    departuresNeverStarted: neverStarted.length,
  };
}
