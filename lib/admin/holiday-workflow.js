import { getHolidayWorkflowStateRows, upsertHolidayWorkflowStateRow } from './sheets.js';

export function buildHolidayWorkflowKey({ season = 'christmas', year = '2026' } = {}) {
  return `holiday:${season}:${year}`;
}

function isCompletedValue(value) {
  return `${value || ''}`.trim().toLowerCase() === 'true';
}

export async function getHolidayWorkflowStateMap({ workflowKey }) {
  const rows = await getHolidayWorkflowStateRows(workflowKey);

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

export async function hydrateHolidayWorkflow(workflow) {
  const workflowKey = buildHolidayWorkflowKey({
    season: workflow.season,
    year: workflow.year,
  });
  const taskStateMap = await getHolidayWorkflowStateMap({ workflowKey });

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
  const completedTasks = taskGroups.reduce((sum, group) => sum + group.tasks.filter((task) => task.completed).length, 0);

  return {
    ...workflow,
    workflowKey,
    taskGroups,
    totalTasks,
    completedTasks,
  };
}

export async function setHolidayWorkflowTaskCompleted({
  workflowKey,
  season,
  year,
  groupId,
  taskId,
  taskLabel,
  completed,
}) {
  const now = new Date().toISOString();
  await upsertHolidayWorkflowStateRow({
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
