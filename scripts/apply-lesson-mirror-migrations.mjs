import fs from 'node:fs';

import { applyLessonMirrorMigrations } from '../lib/admin/lesson-mirror-migrations.mjs';
import { getLessonMirrorDatabase } from '../lib/admin/lesson-mirror-store.mjs';

for (const envFile of ['.env.local', '.env']) {
  if (!process.env.DATABASE_URL && fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
  }
}

const database = getLessonMirrorDatabase();
try {
  const result = await applyLessonMirrorMigrations({ database });
  console.log(JSON.stringify({ ok: true, ...result }));
} finally {
  await database.end();
}
