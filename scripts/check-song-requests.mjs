// Weekly noticing layer for the Song_Requests queue (run by launchd — see
// install-song-requests-launch-agent.mjs). Pings a macOS notification only
// when open requests exist; curation itself stays a supervised /add-song run.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSongRequestRows } from '../lib/admin/sheets.js';
import { loadLocalEnv } from './script-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
await loadLocalEnv(repoRoot);

const open = (await getSongRequestRows()).filter((row) => row.status === 'new');

if (!open.length) {
  console.log(`${new Date().toISOString()} no open song requests`);
} else {
  const preview = open.slice(0, 3).map((row) => `"${row.queryText}"`).join(', ');
  const summary = `${open.length} open song request${open.length === 1 ? '' : 's'}: ${preview}${open.length > 3 ? ', …' : ''}`;
  console.log(`${new Date().toISOString()} ${summary}`);
  execFileSync('osascript', [
    '-e',
    `display notification ${JSON.stringify(`${summary} — run /add-song`)} with title "First Chord" sound name "Glass"`,
  ]);
}
