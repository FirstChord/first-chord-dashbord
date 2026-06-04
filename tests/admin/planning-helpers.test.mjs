import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPlanningProgress,
  buildPlanningSummary,
  derivePlanningMomentum,
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
