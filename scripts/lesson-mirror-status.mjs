import fs from 'node:fs';

import {
  assessLessonMirrorStatus,
  getLessonMirrorDatabase,
  getLessonMirrorStatus,
} from '../lib/admin/lesson-mirror-store.mjs';

for (const envFile of ['.env.local', '.env']) {
  if (!process.env.DATABASE_URL && fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
  }
}

const database = getLessonMirrorDatabase();
try {
  const status = await getLessonMirrorStatus({ database });
  console.log(JSON.stringify({ ok: true, latest: status, assessment: assessLessonMirrorStatus(status) }));
} finally {
  await database.end();
}
