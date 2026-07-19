import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendPlanningProgressLogRow, getPlanningItemRows, upsertPlanningItemRow } from '../lib/admin/sheets.js';
import { buildBackupPlanningItem, buildBackupProgressNote, BACKUP_PLANNING_ID } from '../lib/admin/backup-helpers.mjs';
import { buildSheetCensus, formatCensusSummary } from '../lib/admin/sheet-census.mjs';
import { loadLocalEnv } from './script-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const BACKUP_TABS = [
  'Students',
  'Issue_Queue',
  'Event_Log',
  'Waiting_List_State',
  'Showcase_Task_State',
  'Holiday_Workflow_State',
  'Schedule_Context',
  'Parent_Understanding_State',
  'Tutor_Absence_State',
  'Cover_Bank_State',
  'Tutor_Lifecycle',
  'Planning_Items',
  'Planning_Progress_Log',
  'Practice_Notes_Log',
  'Communication_Log',
  'Incoming_Message_Inbox',
  'WhatsApp_Group_Map',
  'Tutor_Pay',
  'Expenses',
  'Expense_Log',
  'Finance_Snapshot',
  'Payroll_Runs',
  'Tutor_Wise',
  'Tutor_Phones',
  'Students_Archive',
  'Song_Assignments',
  'Song_Status_Log',
  'Song_Outcomes',
  'Song_Requests',
  'Stripe_Collected_Monthly',
];
const OPTIONAL_MISSING_TABS = new Set(['Students_Archive', 'Tutor_Phones']);
const BACKUP_SET_RETENTION_COUNT = 8;

function timestampForFolder(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/u, 'Z').replace(/[:]/g, '-');
}

function quoteSheetName(sheetName) {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
}

function slugifyTabName(tabName) {
  return String(tabName)
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  if (!/[",\n\r]/u.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

function rowsToObjects(rows) {
  const [headers = [], ...bodyRows] = rows;
  return bodyRows.map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      if (!header) {
        return;
      }

      record[header] = row[index] ?? '';
    });
    return record;
  });
}

async function backupTab({ tabName, outputDir, getSheetValues }) {
  const rows = await getSheetValues(quoteSheetName(tabName));
  const slug = slugifyTabName(tabName);
  const headers = rows[0] || [];
  const jsonPayload = {
    tabName,
    exportedAt: new Date().toISOString(),
    rowCount: Math.max(rows.length - 1, 0),
    columnCount: headers.length,
    headers,
    rows,
    objects: rowsToObjects(rows),
  };

  await writeFile(path.join(outputDir, `${slug}.csv`), toCsv(rows), 'utf8');
  await writeFile(path.join(outputDir, `${slug}.json`), `${JSON.stringify(jsonPayload, null, 2)}\n`, 'utf8');

  return {
    tabName,
    csvFile: `${slug}.csv`,
    jsonFile: `${slug}.json`,
    rowCount: jsonPayload.rowCount,
    columnCount: jsonPayload.columnCount,
    headers,
  };
}

// Read the most recent prior backup set's manifest so the census can compute
// growth deltas. Returns null on the first-ever backup (no prior sets).
async function readPreviousManifest({ backupRoot, currentDirName }) {
  let entries;
  try {
    entries = await readdir(backupRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const priorFolders = entries
    .filter((entry) => entry.isDirectory() && entry.name !== currentDirName)
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  for (const folderName of priorFolders) {
    try {
      const raw = await readFile(path.join(backupRoot, folderName, 'manifest.json'), 'utf8');
      return JSON.parse(raw);
    } catch {
      // Skip folders without a readable manifest and try the next-most-recent.
    }
  }

  return null;
}

async function pruneOldBackupSets({ backupRoot, keepCount = BACKUP_SET_RETENTION_COUNT }) {
  const entries = await readdir(backupRoot, { withFileTypes: true });
  const backupDirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fullPath = path.join(backupRoot, entry.name);
    const stats = await stat(fullPath);
    backupDirs.push({
      name: entry.name,
      fullPath,
      mtimeMs: stats.mtimeMs,
    });
  }

  backupDirs.sort((a, b) => {
    const nameCompare = b.name.localeCompare(a.name);
    if (nameCompare !== 0) return nameCompare;
    return b.mtimeMs - a.mtimeMs;
  });

  const pruned = [];
  for (const backupDir of backupDirs.slice(keepCount)) {
    await rm(backupDir.fullPath, { recursive: true, force: true });
    pruned.push(backupDir.name);
  }

  return pruned;
}

async function main() {
  await loadLocalEnv(repoRoot);

  if (!process.env.GOOGLE_SPREADSHEET_ID) {
    throw new Error('GOOGLE_SPREADSHEET_ID is required to back up Sheets tabs.');
  }

  const { getSheetValues } = await import('../lib/admin/sheets.js');
  const timestamp = timestampForFolder();
  const backupRoot = path.join(repoRoot, 'backups', 'sheets');
  const outputDir = path.join(backupRoot, timestamp);
  await mkdir(outputDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const manifest = {
    startedAt,
    completedAt: null,
    outputDir,
    tabs: [],
    skippedTabs: [],
    failedTabs: [],
  };

  for (const tabName of BACKUP_TABS) {
    try {
      const result = await backupTab({ tabName, outputDir, getSheetValues });
      if (tabName === 'Students' && (result.rowCount === 0 || result.columnCount === 0)) {
        throw new Error('Students tab backup is empty; refusing to treat this as a valid backup.');
      }

      manifest.tabs.push(result);
      console.log(`Backed up ${tabName}: ${result.rowCount} rows, ${result.columnCount} columns`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (OPTIONAL_MISSING_TABS.has(tabName) && /Unable to parse range|not found/i.test(message)) {
        manifest.skippedTabs.push({
          tabName,
          reason: 'Tab is not present yet. It will be created by the archive workflow on first use.',
        });
        console.warn(`Skipped ${tabName}: tab is not present yet`);
        continue;
      }

      manifest.failedTabs.push({ tabName, error: message });
      console.error(`Failed to back up ${tabName}: ${message}`);
    }
  }

  manifest.completedAt = new Date().toISOString();
  await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  // Sheet census: measure growth of the event-heavy lanes so the Sheets->DB
  // migration decision is triggered by data, not a hunch (see
  // docs/admin/SHEETS_VS_DB_AUDIT.md). Read-only; never blocks the backup.
  const previousManifest = await readPreviousManifest({ backupRoot, currentDirName: timestamp });
  const census = buildSheetCensus({ currentManifest: manifest, previousManifest });
  await writeFile(path.join(outputDir, 'census.json'), `${JSON.stringify(census, null, 2)}\n`, 'utf8');
  const censusSummary = formatCensusSummary(census);
  console.log(censusSummary);

  if (manifest.failedTabs.length > 0) {
    console.error(`Backup incomplete. Failed tabs: ${manifest.failedTabs.map((tab) => tab.tabName).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const existingPlanningRows = await getPlanningItemRows();
  const existingBackupReminder = existingPlanningRows.find((row) => row.planningId === BACKUP_PLANNING_ID) || {};
  const planningItem = buildBackupPlanningItem({
    completedAt: new Date(manifest.completedAt),
    existingItem: existingBackupReminder,
  });

  await upsertPlanningItemRow(planningItem);
  await appendPlanningProgressLogRow({
    progressId: `planning_progress_backup_${timestamp.replace(/[^A-Za-z0-9]/g, '_')}`,
    planningId: planningItem.planningId,
    progressNote: `${buildBackupProgressNote(manifest)} ${censusSummary}`.trim(),
    progressType: 'action_completed',
    createdAt: manifest.completedAt,
    createdBy: 'local_backup_script',
  });
  const prunedBackups = await pruneOldBackupSets({ backupRoot });
  console.log(`Next backup reminder set for ${planningItem.targetDate}`);
  if (prunedBackups.length > 0) {
    console.log(`Pruned old backup sets beyond latest ${BACKUP_SET_RETENTION_COUNT}: ${prunedBackups.join(', ')}`);
  }
  console.log(`Backup complete: ${outputDir}`);
}

await main();
