import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLifecyclePlanningItem,
  buildLifecycleProgressNote,
  calculateNextLifecycleDate,
  DEFAULT_LIFECYCLE_INTERVAL_DAYS,
  LIFECYCLE_PLANNING_ID,
} from '../../lib/admin/lifecycle-reminder.mjs';

test('the next review is booked a term ahead', () => {
  assert.equal(calculateNextLifecycleDate(new Date('2026-07-28T10:00:00Z')), '2026-11-25');
  assert.equal(DEFAULT_LIFECYCLE_INTERVAL_DAYS, 120);
});

test('an unusable completion date still books a future review', () => {
  // Never leave the loop without a next date — a reminder that fails to renew
  // is the failure this whole mechanism exists to prevent.
  const item = buildLifecyclePlanningItem({ completedAt: new Date('nonsense') });
  assert.match(item.targetDate, /^\d{4}-\d{2}-\d{2}$/u);
});

test('re-running preserves who created the reminder and when', () => {
  const existingItem = { createdAt: '2026-01-01T09:00:00.000Z', createdBy: 'finn@example.com' };
  const item = buildLifecyclePlanningItem({
    completedAt: new Date('2026-07-28T10:00:00Z'),
    existingItem,
  });

  assert.equal(item.createdAt, existingItem.createdAt);
  assert.equal(item.createdBy, existingItem.createdBy);
  assert.equal(item.lastUpdatedBy, 'local_lifecycle_script');
});

test('the reminder is a stable single row, not a new one each run', () => {
  const first = buildLifecyclePlanningItem({ completedAt: new Date('2026-07-28T10:00:00Z') });
  const second = buildLifecyclePlanningItem({ completedAt: new Date('2026-11-25T10:00:00Z') });

  assert.equal(first.planningId, LIFECYCLE_PLANNING_ID);
  assert.equal(second.planningId, LIFECYCLE_PLANNING_ID);
  assert.notEqual(first.targetDate, second.targetDate, 'the date moves forward');
});

test('the progress note carries the figures, not just "done"', () => {
  const note = buildLifecycleProgressNote({
    studentsWithHistory: 511,
    activeStudents: 195,
    medianTenureYears: 1.52,
    tenureThreeYearsPlus: 62,
    departedStudents: 316,
    medianLifetimeYears: 0.48,
    departuresWithinThreeMonths: 88,
    departuresNeverStarted: 44,
  });

  assert.match(note, /511 students with lesson history/u);
  assert.match(note, /median tenure 1\.52y/u);
  assert.match(note, /62 past three years/u);
  assert.match(note, /median lifetime 0\.48y/u);
  assert.match(note, /44 of those after 0-1 lessons/u);
});

test('the progress note flags unreadable students but stays quiet when there are none', () => {
  const summary = { studentsWithHistory: 10 };

  assert.match(buildLifecycleProgressNote(summary, { unreadable: 3 }), /3 students could not be read/u);
  assert.doesNotMatch(buildLifecycleProgressNote(summary, { unreadable: 0 }), /could not be read/u);
});

test('an empty summary produces a readable note rather than undefineds', () => {
  const note = buildLifecycleProgressNote({});

  assert.doesNotMatch(note, /undefined/u);
  assert.match(note, /0 students with lesson history/u);
});
