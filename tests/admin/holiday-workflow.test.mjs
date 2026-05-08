import test from 'node:test';
import assert from 'node:assert/strict';

import { getHolidayWorkflow } from '../../lib/admin/holiday-workflow-data.js';
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
