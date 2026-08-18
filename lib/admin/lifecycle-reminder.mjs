/** @fileoverview Self-renewing planning prompt that books its own next lifecycle refresh, deliberately human-run rather than scheduled. */
// The self-renewing prompt that makes the lifecycle ritual actually recur.
//
// Lifecycle_Snapshot only becomes a retention trend if the refresh runs more
// than once. Nothing schedules it: a cron or GitHub Action would keep the tab
// fresh but defeat the point, because the value is in someone READING the
// report, and an unattended nightly job would fill the snapshot lane with 365
// rows a year of noise instead of a handful of measurements that meant
// something. It would also need the MMS token as a CI secret for no gain.
//
// So the same shape as the Sheets backup: the human runs the command, and the
// command books its own next prompt in Planning. This works here only because
// tenure ages one day per day — a figure reading "4 years 2 months" being six
// weeks stale changes no decision, so one termly run serves both the per-student
// tab and the trend.

import { formatDateInput } from './backup-helpers.mjs';

export const LIFECYCLE_PLANNING_ID = 'planning_student_lifecycle_review';

// Roughly a school term. Four-monthly gives three measurements a year, which is
// enough to see a retention trend and few enough that each one gets read.
export const DEFAULT_LIFECYCLE_INTERVAL_DAYS = 120;

export function calculateNextLifecycleDate(completedAt = new Date(), intervalDays = DEFAULT_LIFECYCLE_INTERVAL_DAYS) {
  const date = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  next.setDate(next.getDate() + intervalDays);
  return formatDateInput(next);
}

export function buildLifecyclePlanningItem({
  completedAt = new Date(),
  existingItem = {},
  actorEmail = 'local_lifecycle_script',
  intervalDays = DEFAULT_LIFECYCLE_INTERVAL_DAYS,
} = {}) {
  const completedDate = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const timestamp = Number.isNaN(completedDate.getTime()) ? new Date().toISOString() : completedDate.toISOString();

  return {
    planningId: LIFECYCLE_PLANNING_ID,
    title: 'Review student retention (termly)',
    notes:
      'Termly read of how long students stay. Run npm run lifecycle:refresh -- --apply '
      + 'from the repo, then read the printed report. Compare cohorts DOWN a column '
      + '(same horizon), never across a row.',
    itemType: 'action',
    owner: 'Finn',
    status: 'waiting',
    area: 'admin',
    linkedWorkflowId: 'operational_hygiene',
    linkedStudentId: '',
    linkedTutorId: '',
    parentPlanningId: '',
    outcome: 'Keep a running record of tenure, lifetime and cohort survival so retention is answerable.',
    nextAction: 'Run npm run lifecycle:refresh -- --apply and read the cohort survival table.',
    targetDate: calculateNextLifecycleDate(completedDate, intervalDays),
    createdAt: existingItem.createdAt || timestamp,
    updatedAt: timestamp,
    createdBy: existingItem.createdBy || actorEmail,
    lastUpdatedBy: actorEmail,
  };
}

/**
 * The progress note is the bit a human actually reads later, so it carries the
 * headline figures rather than just "done". A note saying only that the job ran
 * would send the next person back to the raw tab to find out whether anything
 * moved.
 */
export function buildLifecycleProgressNote(summary = {}, { unreadable = 0 } = {}) {
  const parts = [
    `Student lifecycle refreshed: ${summary.studentsWithHistory ?? 0} students with lesson history`,
    `${summary.activeStudents ?? 0} attending (median tenure ${summary.medianTenureYears ?? '—'}y,`
      + ` ${summary.tenureThreeYearsPlus ?? 0} past three years)`,
    `${summary.departedStudents ?? 0} departed (median lifetime ${summary.medianLifetimeYears ?? '—'}y)`,
    `${summary.departuresWithinThreeMonths ?? 0} left within three months,`
      + ` ${summary.departuresNeverStarted ?? 0} of those after 0-1 lessons`,
  ];

  if (unreadable > 0) {
    parts.push(`${unreadable} students could not be read from MMS`);
  }

  return `${parts.join('. ')}.`;
}
