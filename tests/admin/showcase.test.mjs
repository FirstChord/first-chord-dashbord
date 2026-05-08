import test from 'node:test';
import assert from 'node:assert/strict';

import { getShowcaseWorkflow } from '../../lib/admin/showcase-data.js';
import { buildShowcaseWorkflowKey } from '../../lib/admin/showcase.js';

test('getShowcaseWorkflow normalises task groups into stable task ids', () => {
  const workflow = getShowcaseWorkflow({ season: 'summer', year: '2026' });

  assert.equal(workflow.title, 'Summer Show 2026');
  assert.ok(workflow.taskGroups.length > 0);
  assert.match(workflow.taskGroups[0].tasks[0].id, /^[a-z0-9-]+$/);
  assert.equal(typeof workflow.taskGroups[0].tasks[0].label, 'string');
});

test('buildShowcaseWorkflowKey creates a stable key per showcase instance', () => {
  assert.equal(buildShowcaseWorkflowKey({ season: 'summer', year: '2026' }), 'showcase:summer:2026');
  assert.equal(buildShowcaseWorkflowKey({ season: 'winter', year: '2027' }), 'showcase:winter:2027');
});
