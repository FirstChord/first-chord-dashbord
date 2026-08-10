import fs from 'node:fs';

import { syncMmsLessonMirror } from '../lib/admin/lesson-mirror-sync.mjs';
import { getLessonMirrorDatabase } from '../lib/admin/lesson-mirror-store.mjs';

for (const envFile of ['.env.local', '.env']) {
  if (process.env.DATABASE_URL && process.env.MMS_BEARER_TOKEN) break;
  if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? `${process.argv[index + 1] || ''}`.trim() : '';
}

const startDate = option('--start');
const endDateExclusive = option('--end-exclusive');
const pageSize = Number(option('--page-size') || 2000);
const maxPages = Number(option('--max-pages') || 20);
if (!process.argv.includes('--write-mirror')) {
  throw new Error('Refusing to write the lesson mirror without --write-mirror');
}
if (!startDate || !endDateExclusive) {
  throw new Error('Usage: node scripts/sync-lesson-mirror.mjs --start YYYY-MM-DD --end-exclusive YYYY-MM-DD --write-mirror');
}

const database = getLessonMirrorDatabase();
try {
  const result = await syncMmsLessonMirror({ startDate, endDateExclusive, pageSize, maxPages, database });
  console.log(JSON.stringify({ ok: true, ...result }));
} finally {
  await database.end();
}
