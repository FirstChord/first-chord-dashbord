export const BACKUP_PLANNING_ID = 'planning_operational_sheets_backup';
export const DEFAULT_BACKUP_INTERVAL_DAYS = 14;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function calculateNextBackupDate(completedAt = new Date(), intervalDays = DEFAULT_BACKUP_INTERVAL_DAYS) {
  const date = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + intervalDays);
  return formatDateInput(next);
}

export function buildBackupPlanningItem({
  completedAt = new Date(),
  existingItem = {},
  actorEmail = 'local_backup_script',
  intervalDays = DEFAULT_BACKUP_INTERVAL_DAYS,
} = {}) {
  const completedDate = completedAt instanceof Date ? completedAt : new Date(completedAt);
  const timestamp = Number.isNaN(completedDate.getTime()) ? new Date().toISOString() : completedDate.toISOString();

  return {
    planningId: BACKUP_PLANNING_ID,
    title: 'Run operational Sheets backup',
    notes: 'Fortnightly local backup of Students and dashboard-owned state tabs. Run from the repo with npm run backup:sheets.',
    itemType: 'action',
    owner: 'Finn',
    status: 'waiting',
    area: 'admin',
    linkedWorkflowId: 'operational_hygiene',
    linkedStudentId: '',
    linkedTutorId: '',
    parentPlanningId: '',
    outcome: 'Keep a recent local recovery snapshot of the operational Google Sheet state.',
    nextAction: 'Run npm run backup:sheets and confirm the manifest has zero failed tabs.',
    targetDate: calculateNextBackupDate(completedDate, intervalDays),
    createdAt: existingItem.createdAt || timestamp,
    updatedAt: timestamp,
    createdBy: existingItem.createdBy || actorEmail,
    lastUpdatedBy: actorEmail,
  };
}

export function buildBackupProgressNote(manifest = {}) {
  const tabCount = manifest.tabs?.length || 0;
  const failedCount = manifest.failedTabs?.length || 0;
  const skipped = (manifest.skippedTabs || []).map((tab) => tab.tabName).filter(Boolean);

  return [
    `Operational Sheets backup completed: ${tabCount} tabs backed up, ${failedCount} failed.`,
    skipped.length ? `Skipped optional tabs: ${skipped.join(', ')}.` : '',
    manifest.outputDir ? `Backup folder: ${manifest.outputDir}` : '',
  ].filter(Boolean).join(' ');
}
