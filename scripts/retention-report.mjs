// Read-only retention report: measures dated tabs against the PROPOSED,
// hard-coded policy list below. docs/policies/data-protection.md explains the
// wider inventory and review boundary. Prints counts only —
// this script never deletes anything; pruning stays a human-run action.
//   npm run retention:report
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSheetValues, mapRowsToObjects } from '../lib/admin/sheets.js';
import { loadLocalEnv } from './script-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
await loadLocalEnv(repoRoot);

// tab → { dateColumn, months, note, exempt(row) }
const POLICIES = [
  { tab: 'Incoming_Message_Inbox', dateColumn: 'message_at', months: 12, note: 'handled/ignored rows only', exempt: (row) => !['handled', 'ignored'].includes(`${row.status || ''}`.trim().toLowerCase()) },
  { tab: 'Communication_Log', dateColumn: 'logged_at', months: 24 },
  { tab: 'Event_Log', dateColumn: 'occurred_at', months: 24 },
  { tab: 'Practice_Notes_Log', dateColumn: 'created_at', months: 24, note: 'policy is 2y after leaving; this counts note age as a proxy — cross-check leavers before pruning' },
  { tab: 'Students_Archive', dateColumn: 'archived_at', months: 24 },
  { tab: 'Parent_Understanding_State', dateColumn: 'updated_at', months: 12, note: 'yearly review of stale opinion rows' },
];

function monthsAgo(months) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

console.log('Retention report (read-only) — proposed windows hard-coded in scripts/retention-report.mjs\n');
let anyOutside = false;

for (const policy of POLICIES) {
  const rows = mapRowsToObjects(await getSheetValues(policy.tab));
  const cutoff = monthsAgo(policy.months);
  let outside = 0;
  let oldest = null;
  let undated = 0;

  for (const row of rows) {
    if (policy.exempt?.(row)) continue;
    const raw = `${row[policy.dateColumn] || ''}`.trim();
    const when = raw ? new Date(raw) : null;
    if (!when || Number.isNaN(when.getTime())) {
      undated += 1;
      continue;
    }
    if (when < cutoff) {
      outside += 1;
      if (!oldest || when < oldest) oldest = when;
    }
  }

  const flag = outside ? '→' : 'ok';
  anyOutside ||= outside > 0;
  console.log(
    `${flag}  ${policy.tab}: ${rows.length} rows, ${outside} older than ${policy.months} months`
    + (oldest ? ` (oldest ${oldest.toISOString().slice(0, 10)})` : '')
    + (undated ? `, ${undated} undated` : '')
    + (policy.note ? `  [${policy.note}]` : '')
  );
}

console.log(anyOutside
  ? '\nRows outside policy exist. Pruning is a deliberate human action per tab — see the map.'
  : '\nEverything is within the proposed retention windows.');
