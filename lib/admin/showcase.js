import { getShowcaseTaskStateRows, upsertShowcaseTaskStateRow } from './sheets.js';

export function buildShowcaseWorkflowKey({ season = 'summer', year = '2026' } = {}) {
  return `showcase:${season}:${year}`;
}

function isCompletedValue(value) {
  return `${value || ''}`.trim().toLowerCase() === 'true';
}

export async function getShowcaseTaskStateMap({ workflowKey }) {
  const rows = await getShowcaseTaskStateRows(workflowKey);

  return new Map(
    rows.map((row) => [
      row.taskId,
      {
        completed: isCompletedValue(row.completed),
        completedAt: row.completedAt || '',
        updatedAt: row.updatedAt || '',
      },
    ]),
  );
}

export async function hydrateShowcaseWorkflow(workflow) {
  const workflowKey = buildShowcaseWorkflowKey({
    season: workflow.season,
    year: workflow.year,
  });
  const taskStateMap = await getShowcaseTaskStateMap({ workflowKey });

  const taskGroups = (workflow.taskGroups || []).map((group) => ({
    ...group,
    tasks: (group.tasks || []).map((task) => {
      const state = taskStateMap.get(task.id);
      return {
        ...task,
        completed: state?.completed || false,
        completedAt: state?.completedAt || '',
        updatedAt: state?.updatedAt || '',
      };
    }),
  }));

  const totalTasks = taskGroups.reduce((sum, group) => sum + group.tasks.length, 0);
  const completedTasks = taskGroups.reduce(
    (sum, group) => sum + group.tasks.filter((task) => task.completed).length,
    0,
  );

  return {
    ...workflow,
    workflowKey,
    taskGroups,
    totalTasks,
    completedTasks,
  };
}

export async function setShowcaseTaskCompleted({
  workflowKey,
  season,
  year,
  groupId,
  taskId,
  taskLabel,
  completed,
}) {
  const now = new Date().toISOString();
  await upsertShowcaseTaskStateRow({
    workflowKey,
    season,
    year,
    groupId,
    taskId,
    taskLabel,
    completed: completed ? 'true' : 'false',
    completedAt: completed ? now : '',
    updatedAt: now,
  });

  return {
    workflowKey,
    groupId,
    taskId,
    completed,
    completedAt: completed ? now : '',
    updatedAt: now,
  };
}
