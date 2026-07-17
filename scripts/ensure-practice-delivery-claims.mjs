import fs from 'node:fs';

import { ensurePracticeNoteDeliveryClaimsTable } from '../lib/admin/practice-note-delivery-claims.mjs';

// Railway injects DATABASE_URL. Loading an ignored local env file only makes the
// operator command usable during a local pre-deploy check.
for (const envFile of ['.env.local', '.env']) {
  if (!process.env.DATABASE_URL && fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envFile);
  }
}

await ensurePracticeNoteDeliveryClaimsTable();
console.log('Practice-note delivery claims table is ready.');
