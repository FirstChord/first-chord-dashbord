export const PLANNING_ITEM_TYPES = ['idea', 'initiative', 'action'];
export const PLANNING_STATUSES = ['inbox', 'active', 'waiting', 'done', 'parked'];
export const PLANNING_OWNERS = ['Unassigned', 'Finn', 'Tom'];
export const PLANNING_AREAS = [
  'admin',
  'tutor',
  'parent',
  'finance',
  'showcase',
  'tech',
  'marketing',
  'workflow',
  'other',
];
export const PLANNING_PROGRESS_TYPES = [
  'note',
  'action_completed',
  'decision',
  'status_change',
  'next_action_update',
];

const STATUS_LABELS = {
  inbox: 'Inbox',
  active: 'Active',
  waiting: 'Waiting',
  done: 'Done',
  parked: 'Parked',
};

const TYPE_LABELS = {
  idea: 'Idea',
  initiative: 'Initiative',
  action: 'Action',
};

const AREA_LABELS = {
  admin: 'Admin',
  tutor: 'Tutor',
  parent: 'Parent',
  finance: 'Finance',
  showcase: 'Showcase',
  tech: 'Tech',
  marketing: 'Marketing',
  workflow: 'Workflow',
  other: 'Other',
};

const MOMENTUM_LABELS = {
  inbox: 'Inbox',
  moving: 'Moving',
  steady: 'Steady',
  no_next_action: 'No next action',
  stalled: 'Stalled',
  done: 'Done',
  parked: 'Parked',
};

function normaliseEnum(value, validValues, fallback) {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return validValues.includes(normalised) ? normalised : fallback;
}

export function normalisePlanningItemType(value) {
  return normaliseEnum(value, PLANNING_ITEM_TYPES, 'idea');
}

export function normalisePlanningStatus(value) {
  return normaliseEnum(value, PLANNING_STATUSES, 'inbox');
}

export function normalisePlanningArea(value) {
  return normaliseEnum(value, PLANNING_AREAS, 'other');
}

export function normalisePlanningOwner(value) {
  const trimmed = `${value || ''}`.trim();
  return PLANNING_OWNERS.includes(trimmed) ? trimmed : 'Unassigned';
}

export function normalisePlanningProgressType(value) {
  return normaliseEnum(value, PLANNING_PROGRESS_TYPES, 'note');
}

export function labelPlanningStatus(value) {
  return STATUS_LABELS[normalisePlanningStatus(value)] || 'Inbox';
}

export function labelPlanningType(value) {
  return TYPE_LABELS[normalisePlanningItemType(value)] || 'Idea';
}

export function labelPlanningArea(value) {
  return AREA_LABELS[normalisePlanningArea(value)] || 'Other';
}

export function labelPlanningMomentum(value) {
  return MOMENTUM_LABELS[value] || 'Steady';
}

export function normalisePlanningItem(row = {}) {
  return {
    planningId: `${row.planningId || ''}`.trim(),
    title: `${row.title || ''}`.trim(),
    notes: `${row.notes || ''}`.trim(),
    itemType: normalisePlanningItemType(row.itemType),
    owner: normalisePlanningOwner(row.owner),
    status: normalisePlanningStatus(row.status),
    area: normalisePlanningArea(row.area),
    linkedWorkflowId: `${row.linkedWorkflowId || ''}`.trim(),
    linkedStudentId: `${row.linkedStudentId || ''}`.trim(),
    linkedTutorId: `${row.linkedTutorId || ''}`.trim(),
    parentPlanningId: `${row.parentPlanningId || ''}`.trim(),
    outcome: `${row.outcome || ''}`.trim(),
    nextAction: `${row.nextAction || ''}`.trim(),
    createdAt: `${row.createdAt || ''}`.trim(),
    updatedAt: `${row.updatedAt || ''}`.trim(),
    createdBy: `${row.createdBy || ''}`.trim(),
    lastUpdatedBy: `${row.lastUpdatedBy || ''}`.trim(),
  };
}

export function normalisePlanningProgress(row = {}) {
  return {
    progressId: `${row.progressId || ''}`.trim(),
    planningId: `${row.planningId || ''}`.trim(),
    progressNote: `${row.progressNote || ''}`.trim(),
    progressType: normalisePlanningProgressType(row.progressType),
    createdAt: `${row.createdAt || ''}`.trim(),
    createdBy: `${row.createdBy || ''}`.trim(),
  };
}

function parseDateMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function ageDaysSince(value, now = new Date()) {
  const parsed = parseDateMs(value);
  if (!parsed) {
    return null;
  }
  return Math.floor((now.getTime() - parsed) / 86_400_000);
}

export function derivePlanningMomentum(item = {}, progress = [], now = new Date()) {
  const status = normalisePlanningStatus(item.status);
  const itemType = normalisePlanningItemType(item.itemType);

  if (status === 'done') {
    return 'done';
  }
  if (status === 'parked') {
    return 'parked';
  }
  if (status === 'inbox' && itemType === 'idea') {
    return 'inbox';
  }

  const latestProgress = [...progress]
    .filter((entry) => entry.planningId === item.planningId)
    .sort((a, b) => parseDateMs(b.createdAt) - parseDateMs(a.createdAt))[0] || null;
  const latestActivityAt = [item.updatedAt, latestProgress?.createdAt]
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || '';
  const activityAgeDays = ageDaysSince(latestActivityAt, now);
  const needsNextAction = ['initiative', 'action'].includes(itemType) && !`${item.nextAction || ''}`.trim();

  if (needsNextAction) {
    return 'no_next_action';
  }
  if (typeof activityAgeDays === 'number' && activityAgeDays <= 7) {
    return 'moving';
  }
  if (['active', 'waiting'].includes(status) && (activityAgeDays === null || activityAgeDays >= 14)) {
    return 'stalled';
  }
  return 'steady';
}

export function attachPlanningProgress(items = [], progressRows = [], now = new Date()) {
  const normalisedProgress = progressRows.map(normalisePlanningProgress);
  const progressByPlanningId = new Map();

  for (const entry of normalisedProgress) {
    if (!entry.planningId) {
      continue;
    }
    const entries = progressByPlanningId.get(entry.planningId) || [];
    entries.push(entry);
    progressByPlanningId.set(entry.planningId, entries);
  }

  return items.map((itemRow) => {
    const item = normalisePlanningItem(itemRow);
    const progress = (progressByPlanningId.get(item.planningId) || [])
      .sort((a, b) => parseDateMs(b.createdAt) - parseDateMs(a.createdAt));
    const momentum = derivePlanningMomentum(item, progress, now);

    return {
      ...item,
      statusLabel: labelPlanningStatus(item.status),
      itemTypeLabel: labelPlanningType(item.itemType),
      areaLabel: labelPlanningArea(item.area),
      momentum,
      momentumLabel: labelPlanningMomentum(momentum),
      progress,
      latestProgress: progress[0] || null,
    };
  });
}

export function buildPlanningSummary(items = []) {
  const activeItems = items.filter((item) => !['done', 'parked'].includes(item.status));
  const initiatives = items.filter((item) => item.itemType === 'initiative');

  return {
    total: items.length,
    inbox: items.filter((item) => item.status === 'inbox').length,
    active: items.filter((item) => item.status === 'active').length,
    waiting: items.filter((item) => item.status === 'waiting').length,
    done: items.filter((item) => item.status === 'done').length,
    parked: items.filter((item) => item.status === 'parked').length,
    initiatives: initiatives.length,
    moving: activeItems.filter((item) => item.momentum === 'moving').length,
    stalled: activeItems.filter((item) => item.momentum === 'stalled').length,
    noNextAction: activeItems.filter((item) => item.momentum === 'no_next_action').length,
  };
}
