// Lists Song_Requests rows (the tutor "request this song" curation queue).
// Used by the add-song skill to see what tutors are waiting on.
//   node scripts/list-song-requests.mjs          → open (status=new) requests
//   node scripts/list-song-requests.mjs --all    → everything, newest first
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSongRequestRows } from '../lib/admin/sheets.js';
import { loadLocalEnv } from './script-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
await loadLocalEnv(repoRoot);

const showAll = process.argv.includes('--all');
const rows = (await getSongRequestRows())
  .filter((row) => showAll || row.status === 'new')
  .sort((a, b) => `${b.requestedAt}`.localeCompare(`${a.requestedAt}`));

if (!rows.length) {
  console.log(showAll ? 'No song requests recorded.' : 'No open song requests.');
} else {
  for (const row of rows) {
    const date = `${row.requestedAt}`.slice(0, 10);
    const status = showAll ? ` [${row.status}${row.songId ? ` → ${row.songId}` : ''}]` : '';
    console.log(`${date}  "${row.queryText}"  (${row.instrument || 'instrument?'}, ${row.requestedBy || 'tutor?'}, ${row.mmsId})${status}`);
  }
  console.log(`\n${rows.length} request${rows.length === 1 ? '' : 's'}. Resolve by setting status to added/declined (+ song_id, resolved_at) in the Song_Requests tab.`);
}
