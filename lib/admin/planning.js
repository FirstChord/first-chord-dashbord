import { randomUUID } from 'node:crypto';
import {
  appendPlanningProgressLogRow,
  getPlanningItemRows,
  getPlanningProgressLogRows,
  upsertPlanningItemRow,
} from './sheets.js';
import {
  attachPlanningProgress,
  buildFirstLessonCheckinPlanningItem,
  buildSchoolForwardPlanningItem,
  buildPlanningSummary,
  normalisePlanningArea,
  normalisePlanningItem,
  normalisePlanningItemType,
  normalisePlanningOwner,
  normalisePlanningProgressType,
  normalisePlanningStatus,
  SCHOOL_FORWARD_PLANNING_ID,
  shouldRefreshSchoolForwardPlanningItem,
} from './planning-helpers.mjs';

function buildPlanningId() {
  return `planning_${randomUUID()}`;
}

function timestamp() {
  return new Date().toISOString();
}

function sortPlanningItems(items = []) {
  const statusOrder = {
    active: 0,
    waiting: 1,
    inbox: 2,
    parked: 3,
    done: 4,
  };
  const typeOrder = {
    initiative: 0,
    action: 1,
    idea: 2,
  };

  return [...items].sort((a, b) => (
    (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
    || `${a.targetDate || '9999-12-31'}`.localeCompare(`${b.targetDate || '9999-12-31'}`)
    || (typeOrder[a.itemType] ?? 99) - (typeOrder[b.itemType] ?? 99)
    || `${b.updatedAt || b.createdAt || ''}`.localeCompare(`${a.updatedAt || a.createdAt || ''}`)
    || a.title.localeCompare(b.title)
  ));
}

export async function getPlanningDashboard() {
  let [itemRows, progressRows] = await Promise.all([
    getPlanningItemRows(),
    getPlanningProgressLogRows(),
  ]);
  itemRows = await ensureSystemPlanningItems(itemRows);
  const items = sortPlanningItems(attachPlanningProgress(itemRows, progressRows));

  return {
    items,
    progressRows,
    summary: buildPlanningSummary(items),
  };
}

async function ensureSystemPlanningItems(itemRows = [], now = new Date()) {
  const existingSchoolForwardItem = itemRows.find((row) => row.planningId === SCHOOL_FORWARD_PLANNING_ID) || {};

  if (!shouldRefreshSchoolForwardPlanningItem(existingSchoolForwardItem, now)) {
    return itemRows;
  }

  const nextItem = buildSchoolForwardPlanningItem({
    now,
    existingItem: existingSchoolForwardItem,
    skipToday: normalisePlanningStatus(existingSchoolForwardItem.status) === 'done',
  });
  await upsertPlanningItemRow(nextItem);

  const withoutExisting = itemRows.filter((row) => row.planningId !== SCHOOL_FORWARD_PLANNING_ID);
  return [...withoutExisting, nextItem];
}

function mergePlanningItem(existing = {}, updates = {}, actorEmail = '') {
  const now = timestamp();
  const existingItem = normalisePlanningItem(existing);
  const planningId = existingItem.planningId || `${updates.planningId || ''}`.trim() || buildPlanningId();
  const createdAt = existingItem.createdAt || now;
  const createdBy = existingItem.createdBy || actorEmail;

  return {
    planningId,
    title: `${updates.title ?? existingItem.title ?? ''}`.trim(),
    notes: `${updates.notes ?? existingItem.notes ?? ''}`.trim(),
    itemType: normalisePlanningItemType(updates.itemType ?? existingItem.itemType),
    owner: normalisePlanningOwner(updates.owner ?? existingItem.owner),
    status: normalisePlanningStatus(updates.status ?? existingItem.status),
    area: normalisePlanningArea(updates.area ?? existingItem.area),
    linkedWorkflowId: `${updates.linkedWorkflowId ?? existingItem.linkedWorkflowId ?? ''}`.trim(),
    linkedStudentId: `${updates.linkedStudentId ?? existingItem.linkedStudentId ?? ''}`.trim(),
    linkedTutorId: `${updates.linkedTutorId ?? existingItem.linkedTutorId ?? ''}`.trim(),
    parentPlanningId: `${updates.parentPlanningId ?? existingItem.parentPlanningId ?? ''}`.trim(),
    outcome: `${updates.outcome ?? existingItem.outcome ?? ''}`.trim(),
    nextAction: `${updates.nextAction ?? existingItem.nextAction ?? ''}`.trim(),
    targetDate: `${updates.targetDate ?? existingItem.targetDate ?? ''}`.trim(),
    createdAt,
    updatedAt: now,
    createdBy,
    lastUpdatedBy: actorEmail,
  };
}

export async function savePlanningItem({ planningId = '', item = {}, actorEmail = '', progressNote = '' }) {
  const title = `${item.title || ''}`.trim();
  if (!title) {
    throw new Error('Planning title is required');
  }

  const existingRows = await getPlanningItemRows();
  const existing = existingRows.find((row) => row.planningId === planningId) || {};
  const row = mergePlanningItem(existing, { ...item, planningId }, actorEmail);

  await upsertPlanningItemRow(row);

  if (`${progressNote || ''}`.trim()) {
    await addPlanningProgress({
      planningId: row.planningId,
      progressNote,
      progressType: existing?.planningId ? 'note' : 'decision',
      actorEmail,
      skipItemTouch: true,
    });
  }

  return row;
}

export async function createFirstLessonCheckinPlanningItem({
  mmsId,
  studentName,
  tutorName = '',
  lessonDate,
  lessonTime = '',
  actorEmail = '',
  now = new Date(),
}) {
  const item = buildFirstLessonCheckinPlanningItem({
    mmsId,
    studentName,
    tutorName,
    lessonDate,
    lessonTime,
    now,
  });
  return savePlanningItem({ item, actorEmail });
}

export async function updatePlanningStatus({
  planningId,
  status,
  actorEmail = '',
  progressNote = '',
}) {
  const existingRows = await getPlanningItemRows();
  const existing = existingRows.find((row) => row.planningId === planningId);

  if (!existing) {
    throw new Error(`Planning item ${planningId} was not found`);
  }

  const row = mergePlanningItem(existing, {
    status: normalisePlanningStatus(status),
  }, actorEmail);

  await upsertPlanningItemRow(row);

  await addPlanningProgress({
    planningId,
    progressNote: progressNote || `Status changed to ${row.status}`,
    progressType: 'status_change',
    actorEmail,
    skipItemTouch: true,
  });

  return row;
}

export async function addPlanningProgress({
  planningId,
  progressNote,
  progressType = 'note',
  actorEmail = '',
  nextAction,
  status,
  skipItemTouch = false,
}) {
  const note = `${progressNote || ''}`.trim();
  if (!planningId) {
    throw new Error('planningId is required');
  }
  if (!note) {
    throw new Error('Progress note is required');
  }

  const existingRows = await getPlanningItemRows();
  const existing = existingRows.find((row) => row.planningId === planningId);
  if (!existing) {
    throw new Error(`Planning item ${planningId} was not found`);
  }

  const now = timestamp();
  const progressRow = {
    progressId: `planning_progress_${randomUUID()}`,
    planningId,
    progressNote: note,
    progressType: normalisePlanningProgressType(progressType),
    createdAt: now,
    createdBy: actorEmail,
  };

  await appendPlanningProgressLogRow(progressRow);

  if (!skipItemTouch || typeof nextAction !== 'undefined' || status) {
    const itemUpdates = {};
    if (typeof nextAction !== 'undefined') {
      itemUpdates.nextAction = nextAction;
    }
    if (status) {
      itemUpdates.status = normalisePlanningStatus(status);
    }

    await upsertPlanningItemRow(mergePlanningItem(existing, itemUpdates, actorEmail));
  }

  return progressRow;
}
