import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getHolidayWorkflow,
  HOLIDAY_WORKFLOW_INSTANCES,
} from '../../lib/admin/holiday-workflow-data.js';
import { buildHolidayWorkflowKey } from '../../lib/admin/holiday-workflow.js';

test('getHolidayWorkflow normalises task groups into stable task ids', () => {
  const workflow = getHolidayWorkflow({ season: 'christmas', year: '2026' });

  assert.equal(workflow.taskGroups.length > 0, true);
  assert.equal(workflow.taskGroups.every((group) => group.tasks.every((task) => task.id && task.label)), true);
});

test('buildHolidayWorkflowKey creates a stable key per holiday workflow instance', () => {
  assert.equal(buildHolidayWorkflowKey({ season: 'christmas', year: '2026' }), 'holiday:christmas:2026');
  assert.equal(buildHolidayWorkflowKey({ season: 'summer', year: '2027' }), 'holiday:summer:2027');
});

test('current holiday workflow instances keep Christmas 2026 and roll Easter and summer to 2027', () => {
  assert.deepEqual(HOLIDAY_WORKFLOW_INSTANCES, [
    { season: 'christmas', year: '2026', label: 'Christmas 2026' },
    { season: 'easter', year: '2027', label: 'Easter 2027' },
    { season: 'summer', year: '2027', label: 'Summer 2027' },
  ]);

  assert.equal(getHolidayWorkflow({ season: 'christmas' }).year, '2026');
  assert.equal(getHolidayWorkflow({ season: 'easter' }).title, 'Easter Workflow 2027');
  assert.equal(getHolidayWorkflow({ season: 'summer' }).title, 'Summer Holiday Workflow 2027');
});

test('Easter 2027 parent copy does not imply Easter falls in April', () => {
  const message = getHolidayWorkflow({ season: 'easter' }).templates.parentAnnouncement;

  assert.doesNotMatch(message, /throughout April/u);
  assert.match(message, /through Easter and the spring school holidays/u);
});
