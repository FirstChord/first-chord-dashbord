/** @fileoverview Explicit, checksummed PostgreSQL migrations for the lesson mirror. */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getLessonMirrorDatabase } from './lesson-mirror-store.mjs';

const DEFAULT_MIGRATION_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../db/migrations/lesson-mirror',
);

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

export async function readLessonMirrorMigrations({ migrationDir = DEFAULT_MIGRATION_DIR } = {}) {
  const names = (await readdir(migrationDir))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/u.test(name))
    .sort();
  if (!names.length) throw new Error('No lesson mirror migrations were found');
  return Promise.all(names.map(async (name) => {
    const sql = await readFile(path.join(migrationDir, name), 'utf8');
    return { version: name.replace(/\.sql$/u, ''), checksum: checksum(sql), sql };
  }));
}

export async function applyLessonMirrorMigrations({
  database = null,
  env = process.env,
  migrationDir = DEFAULT_MIGRATION_DIR,
} = {}) {
  const pool = database || getLessonMirrorDatabase(env);
  const migrations = await readLessonMirrorMigrations({ migrationDir });
  const client = await pool.connect();
  const appliedNow = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS fc_schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query('SELECT pg_advisory_lock(hashtext($1))', ['first_chord_lesson_mirror_migrations_v1']);
    const existing = await client.query(`
      SELECT version, checksum
      FROM fc_schema_migrations
      WHERE version = ANY($1::text[])
    `, [migrations.map((migration) => migration.version)]);
    const applied = new Map((existing.rows || []).map((row) => [row.version, row.checksum]));

    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.version);
      if (previousChecksum && previousChecksum !== migration.checksum) {
        throw new Error(`Applied lesson mirror migration ${migration.version} has been modified`);
      }
      if (previousChecksum) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO fc_schema_migrations (version, checksum) VALUES ($1, $2)',
          [migration.version, migration.checksum],
        );
        await client.query('COMMIT');
        appliedNow.push(migration.version);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return { applied: appliedNow, current: migrations.map((migration) => migration.version) };
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['first_chord_lesson_mirror_migrations_v1']);
    } finally {
      client.release();
    }
  }
}
