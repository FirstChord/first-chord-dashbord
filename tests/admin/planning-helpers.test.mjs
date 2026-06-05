import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPlanningProgress,
  buildPlanningDueSummary,
  buildPlanningSummary,
  derivePlanningMomentum,
  inferPlanningTargetDateFromText,
  normalisePlanningArea,
  normalisePlanningItemType,
  normalisePlanningOwner,
  normalisePlanningStatus,
} from '../../lib/admin/planning-helpers.mjs';

const NOW = new Date('2026-06-03T12:00:00.000Z');

test('normalises planning defaults conservatively', () => {
  assert.equal(normalisePlanningItemType('Initiative'), 'initiative');
  assert.equal(normalisePlanningItemType('bad'), 'idea');
  assert.equal(normalisePlanningStatus('WAITING'), 'waiting');
  assert.equal(normalisePlanningStatus('unknown'), 'inbox');
  assert.equal(normalisePlanningArea('Finance'), 'finance');
  assert.equal(normalisePlanningArea('random'), 'other');
  assert.equal(normalisePlanningOwner('Tom'), 'Tom');
  assert.equal(normalisePlanningOwner('Fenella'), 'Unassigned');
});

test('infers target dates from operational capture notes', () => {
  assert.equal(
    inferPlanningTargetDateFromText('Pause Coban for Friday', new Date('2026-06-05T10:00:00.000Z')),
    '2026-06-11',
  );
  assert.equal(
    inferPlanningTargetDateFromText('Set up Anna McPhail Stripe 12th June', new Date('2026-06-05T10:00:00.000Z')),
    '2026-06-12',
  );
});

test('summarises planning items due today and overdue', () => {
  const summary = buildPlanningDueSummary([
    {
      planningId: 'planning_1',
      title: 'Pause Coban',
      status: 'active',
      targetDate: '2026-06-05',
    },
    {
      planningId: 'planning_2',
      title: 'Message Elena students',
      status: 'inbox',
      targetDate: '2026-06-04',
    },
    {
      planningId: 'planning_3',
      title: 'Done task',
      status: 'done',
      targetDate: '2026-06-05',
    },
    {
      planningId: 'planning_4',
      title: 'Future task',
      status: 'active',
      targetDate: '2026-06-08',
    },
  ], new Date('2026-06-05T10:00:00.000Z'));

  assert.equal(summary.today, '2026-06-05');
  assert.equal(summary.dueToday, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.dueNow, 2);
  assert.deepEqual(summary.dueNowTitles, ['Message Elena students', 'Pause Coban']);
});

test('marks active initiatives with no next action clearly', () => {
  const momentum = derivePlanningMomentum({
    planningId: 'planning_1',
    itemType: 'initiative',
    status: 'active',
    nextAction: '',
    updatedAt: '2026-06-03T10:00:00.000Z',
  }, [], NOW);

  assert.equal(momentum, 'no_next_action');
});

test('uses recent progress to show movement', () => {
  const momentum = derivePlanningMomentum({
    planningId: 'planning_1',
    itemType: 'initiative',
    status: 'active',
    nextAction: 'Pilot with five families',
    updatedAt: '2026-05-01T10:00:00.000Z',
  }, [{
    planningId: 'planning_1',
    createdAt: '2026-06-01T10:00:00.000Z',
    progressNote: 'Drafted pilot checklist',
  }], NOW);

  assert.equal(momentum, 'moving');
});

test('marks stale active initiatives as stalled', () => {
  const momentum = derivePlanningMomentum({
    planningId: 'planning_1',
    itemType: 'initiative',
    status: 'active',
    nextAction: 'Review with Tom',
    updatedAt: '2026-05-10T10:00:00.000Z',
  }, [], NOW);

  assert.equal(momentum, 'stalled');
});

test('attaches progress rows and builds summary counts', () => {
  const items = attachPlanningProgress([
    {
      planningId: 'planning_1',
      title: 'Parent Understanding Workflow',
      itemType: 'initiative',
      status: 'active',
      owner: 'Finn',
      area: 'parent',
      nextAction: 'Pilot with five families',
      updatedAt: '2026-05-10T10:00:00.000Z',
    },
    {
      planningId: 'planning_2',
      title: 'Sunday piano groups',
      itemType: 'idea',
      status: 'inbox',
      owner: 'Unassigned',
      area: 'other',
      updatedAt: '2026-06-02T10:00:00.000Z',
    },
  ], [
    {
      progressId: 'progress_1',
      planningId: 'planning_1',
      progressNote: 'Built V1 workflow page',
      progressType: 'note',
      createdAt: '2026-06-02T10:00:00.000Z',
    },
  ], NOW);
  const summary = buildPlanningSummary(items);

  assert.equal(items[0].latestProgress.progressNote, 'Built V1 workflow page');
  assert.equal(items[0].momentum, 'moving');
  assert.equal(items[1].momentum, 'inbox');
  assert.equal(summary.total, 2);
  assert.equal(summary.open, 2);
  assert.equal(summary.inbox, 1);
  assert.equal(summary.initiatives, 1);
  assert.equal(summary.activeInitiatives, 1);
  assert.equal(summary.moving, 1);
  assert.equal(summary.needsAttention, 0);
});
