import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'Planning_Items',
  'Planning_Progress_Log',
  'Students_Archive',
];
const OPTIONAL_MISSING_TABS = new Set(['Students_Archive']);

async function loadEnvFile(filePath) {
  let raw = '';
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] != null) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

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

async function main() {
  await loadEnvFile(path.join(repoRoot, '.env.local'));
  await loadEnvFile(path.join(repoRoot, '.env'));

  if (!process.env.GOOGLE_SPREADSHEET_ID) {
    throw new Error('GOOGLE_SPREADSHEET_ID is required to back up Sheets tabs.');
  }

  const { getSheetValues } = await import('../lib/admin/sheets.js');
  const timestamp = timestampForFolder();
  const outputDir = path.join(repoRoot, 'backups', 'sheets', timestamp);
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

  if (manifest.failedTabs.length > 0) {
    console.error(`Backup incomplete. Failed tabs: ${manifest.failedTabs.map((tab) => tab.tabName).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Backup complete: ${outputDir}`);
}

await main();
