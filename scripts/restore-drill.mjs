// Restore drill: prove the sheets backup actually restores.
//
//   npm run restore:drill            → latest backup set
//   node scripts/restore-drill.mjs backups/sheets/<set>   → a specific set
//
// Creates a NEW scratch spreadsheet (never touches the live one — hard-guarded),
// restores every tab from the backup set into it, reads everything back, and
// verifies headers and row counts. Prints the scratch URL at the end; bin it
// from Drive when done. Run this at least once a term so "we have backups"
// stays a tested claim instead of a hope. Full procedure: DISASTER_RECOVERY.md.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSheetsClient, getSheetsEnv, withSheetsRetry } from '../lib/admin/sheets.js';
import { loadLocalEnv } from './script-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
await loadLocalEnv(repoRoot);

const backupsRoot = path.join(repoRoot, 'backups', 'sheets');

async function latestCompleteSet() {
  const entries = (await readdir(backupsRoot)).filter((name) => !name.startsWith('.')).sort().reverse();
  for (const name of entries) {
    try {
      const manifest = JSON.parse(await readFile(path.join(backupsRoot, name, 'manifest.json'), 'utf8'));
      if (manifest.completedAt && !(manifest.failedTabs || []).length) {
        return path.join(backupsRoot, name);
      }
    } catch {
      // no manifest → not a usable set
    }
  }
  throw new Error('No complete backup set found under backups/sheets/.');
}

const setDir = process.argv[2] ? path.resolve(process.argv[2]) : await latestCompleteSet();
const manifest = JSON.parse(await readFile(path.join(setDir, 'manifest.json'), 'utf8'));
console.log(`Restoring from: ${setDir}`);
console.log(`Backup taken: ${manifest.completedAt} · ${manifest.tabs.length} tabs`);

const sheets = await getSheetsClient();
const { spreadsheetId: liveSpreadsheetId } = getSheetsEnv();
if (!sheets) {
  throw new Error('Google Sheets credentials are not configured on this machine.');
}

// Create the scratch spreadsheet with every tab in one request.
const title = `FC Restore Drill ${new Date().toISOString().slice(0, 10)} (safe to delete)`;
const created = await withSheetsRetry(() => sheets.spreadsheets.create({
  requestBody: {
    properties: { title },
    sheets: manifest.tabs.map((tab) => ({ properties: { title: tab.tabName } })),
  },
}));
const scratchId = created.data.spreadsheetId;

// The one rule that must hold no matter what else changes in this script.
if (scratchId === liveSpreadsheetId) {
  throw new Error('Refusing to continue: scratch spreadsheet id equals the LIVE spreadsheet id.');
}

function quoteTab(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

let failures = 0;
for (const tab of manifest.tabs) {
  const data = JSON.parse(await readFile(path.join(setDir, tab.jsonFile), 'utf8'));
  const grid = data.rows || [];
  if (grid.length) {
    await withSheetsRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId: scratchId,
      range: `${quoteTab(tab.tabName)}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: grid },
    }));
  }

  const readBack = await withSheetsRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId: scratchId,
    range: quoteTab(tab.tabName),
  }));
  const gotRows = readBack.data.values || [];
  const wantHeaders = JSON.stringify(data.headers || []);
  // Sheets drops trailing empty cells on read; compare against the padded row.
  const gotHeaders = JSON.stringify(
    (gotRows[0] || []).concat(Array(Math.max(0, (data.headers || []).length - (gotRows[0] || []).length)).fill(''))
  );
  const headersOk = wantHeaders === gotHeaders;
  const rowsOk = gotRows.length === grid.length;
  if (!headersOk || !rowsOk) {
    failures += 1;
    console.log(`FAIL ${tab.tabName}: headers ${headersOk ? 'ok' : 'MISMATCH'}, rows ${gotRows.length}/${grid.length}`);
  } else {
    console.log(`ok   ${tab.tabName}: ${grid.length} rows, ${(data.headers || []).length} headers`);
  }
}

console.log('');
console.log(failures
  ? `RESTORE DRILL FAILED: ${failures} tab(s) did not verify.`
  : `Restore drill PASSED: all ${manifest.tabs.length} tabs restored and verified.`);
console.log(`Scratch spreadsheet (delete from Drive when done): https://docs.google.com/spreadsheets/d/${scratchId}/`);
process.exit(failures ? 1 : 0);
