import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDashboardStateTabs } from '../lib/admin/sheets.js';
import { loadLocalEnv } from './script-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

await loadLocalEnv(repoRoot);

const results = await ensureDashboardStateTabs();

for (const result of results) {
  console.log(`Ensured ${result.sheetName}: ${result.headerCount} headers`);
}

console.log(`State tab check complete: ${results.length} tabs verified`);
