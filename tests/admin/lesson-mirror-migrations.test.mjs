import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLessonMirrorMigrations,
  readLessonMirrorMigrations,
} from '../../lib/admin/lesson-mirror-migrations.mjs';

function fakeMigrationDatabase(existingRows = []) {
  const calls = [];
  let released = false;
  const client = {
    async query(sql, params = []) {
      const text = `${sql}`;
      calls.push({ sql: text, params });
      if (text.includes('SELECT version, checksum')) return { rows: existingRows };
      return { rows: [] };
    },
    release() { released = true; },
  };
  return {
    calls,
    get released() { return released; },
    connect: async () => client,
  };
}

test('initial lesson mirror migration separates events and participations and records sync evidence', async () => {
  const migrations = await readLessonMirrorMigrations();
  assert.equal(migrations.length, 1);
  const sql = migrations[0].sql;
  for (const table of [
    'fc_lesson_sync_runs',
    'fc_lesson_series',
    'fc_lesson_events',
    'fc_lesson_participations',
    'fc_lesson_external_refs',
    'fc_lesson_revisions',
  ]) assert.match(sql, new RegExp(`CREATE TABLE ${table}`, 'u'));
  assert.match(sql, /UNIQUE \(fc_event_id, student_external_id\)/u);
  assert.match(sql, /calendar_expected_count IS NOT NULL/u);
  assert.match(sql, /participation_count IS NOT NULL/u);
  assert.match(sql, /calendar_expected_count = calendar_received_count/u);
  assert.match(sql, /attendance_expected_count = attendance_received_count/u);
});

test('migration runner applies unapplied SQL transactionally and records its checksum', async () => {
  const database = fakeMigrationDatabase();
  const result = await applyLessonMirrorMigrations({ database });
  assert.deepEqual(result.applied, ['001_initial_lesson_mirror']);
  assert.ok(database.calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS fc_schema_migrations')));
  assert.ok(database.calls.some((call) => call.sql === 'BEGIN'));
  assert.ok(database.calls.some((call) => call.sql.includes('CREATE TABLE fc_lesson_events')));
  assert.ok(database.calls.some((call) => call.sql.startsWith('INSERT INTO fc_schema_migrations')));
  assert.ok(database.calls.some((call) => call.sql === 'COMMIT'));
  assert.equal(database.released, true);
});

test('migration runner refuses a changed migration that was already applied', async () => {
  const [migration] = await readLessonMirrorMigrations();
  const database = fakeMigrationDatabase([{ version: migration.version, checksum: '0'.repeat(64) }]);
  await assert.rejects(
    applyLessonMirrorMigrations({ database }),
    /has been modified/u,
  );
  assert.equal(database.calls.some((call) => call.sql.includes('CREATE TABLE fc_lesson_events')), false);
  assert.equal(database.released, true);
});
