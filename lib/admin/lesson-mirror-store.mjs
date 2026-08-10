/** @fileoverview Transactional PostgreSQL persistence and status reads for the rebuildable lesson mirror. */
import { Pool } from 'pg';

const SYNC_LOCK_NAME = 'first_chord_lesson_mirror_sync_v1';
let sharedPool = null;

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

export function getLessonMirrorDatabaseConfig(env = process.env) {
  const connectionString = clean(env.DATABASE_URL);
  return { connectionString, configured: Boolean(connectionString) };
}

function getPool(env = process.env) {
  const { connectionString } = getLessonMirrorDatabaseConfig(env);
  if (!connectionString) throw new Error('Lesson mirror database is not configured');
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      max: 2,
      application_name: 'first-chord-lesson-mirror',
    });
  }
  return sharedPool;
}

export function getLessonMirrorDatabase(env = process.env) {
  return getPool(env);
}

function db(database, env) {
  return database || getPool(env);
}

export async function beginLessonMirrorSync({
  syncRunId,
  source = 'mms',
  triggerKind = 'manual',
  startDate,
  endDateExclusive,
  startedAt,
  database = null,
  env = process.env,
} = {}) {
  if (!clean(syncRunId) || !clean(startDate) || !clean(endDateExclusive) || !clean(startedAt)) {
    throw new Error('Lesson mirror sync ID, window, and start time are required');
  }
  const result = await db(database, env).query(`
    INSERT INTO fc_lesson_sync_runs (
      sync_run_id, source, trigger_kind, window_start, window_end_exclusive, status, started_at
    ) VALUES ($1::uuid, $2, $3, $4::date, $5::date, 'running', $6::timestamptz)
    RETURNING sync_run_id
  `, [syncRunId, source, triggerKind, startDate, endDateExclusive, startedAt]);
  if (!result.rows?.[0]) throw new Error('Lesson mirror sync run could not be started');
  return result.rows[0];
}

export function lessonMirrorFailureCode(error) {
  const message = clean(error?.message).toLowerCase();
  if (message.includes('total changed')) return 'provider_snapshot_changed';
  if (message.includes('reported') || message.includes('valid total') || message.includes('unverified') || message.includes('possibly-truncated')) {
    return 'provider_result_incomplete';
  }
  if (message.includes('event id') || message.includes('student id') || message.includes('wall-clock')) return 'provider_row_invalid';
  if (message.includes('database') || message.includes('relation') || message.includes('postgres')) return 'database_failed';
  if (message.includes('mms') || message.includes('fetch')) return 'provider_read_failed';
  return 'sync_failed';
}

export async function failLessonMirrorSync({
  syncRunId,
  error,
  completedAt,
  database = null,
  env = process.env,
} = {}) {
  const failureCode = lessonMirrorFailureCode(error);
  const result = await db(database, env).query(`
    UPDATE fc_lesson_sync_runs
    SET status = 'failed',
        failure_code = $2,
        failure_summary = 'Sync failed; inspect the operator command output for this run ID.',
        completed_at = $3::timestamptz
    WHERE sync_run_id = $1::uuid AND status = 'running'
    RETURNING sync_run_id, status, failure_code
  `, [syncRunId, failureCode, completedAt]);
  return result.rows?.[0] || null;
}

function seriesRecordset(parameter = '$1') {
  return `
  SELECT * FROM jsonb_to_recordset(${parameter}::jsonb) AS i(
    "fcSeriesId" TEXT,
    "observedRecurrence" JSONB,
    "stateHash" TEXT
  )
`;
}

function eventRecordset(parameter = '$1') {
  return `
  SELECT * FROM jsonb_to_recordset(${parameter}::jsonb) AS i(
    "fcEventId" TEXT,
    "fcSeriesId" TEXT,
    "localDate" DATE,
    "localTime" TIME,
    "timeZone" TEXT,
    "sourceStart" TEXT,
    "durationMinutes" INTEGER,
    "tutorExternalId" TEXT,
    "originalTutorExternalId" TEXT,
    "locationExternalId" TEXT,
    "locationName" TEXT,
    "categoryExternalId" TEXT,
    "categoryName" TEXT,
    "allDay" BOOLEAN,
    "sourceStatus" TEXT,
    "sourceRecurring" BOOLEAN,
    "sourceRecurrence" JSONB,
    "calendarObserved" BOOLEAN,
    "attendanceObserved" BOOLEAN,
    "stateHash" TEXT
  )
`;
}

function participationRecordset(parameter = '$1') {
  return `
  SELECT * FROM jsonb_to_recordset(${parameter}::jsonb) AS i(
    "fcParticipationId" TEXT,
    "fcEventId" TEXT,
    "studentExternalId" TEXT,
    "attendanceExternalId" TEXT,
    "rawAttendanceStatus" TEXT,
    "stateHash" TEXT
  )
`;
}

const EXTERNAL_REF_RECORDSET = `
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS i(
    "provider" TEXT,
    "referenceKind" TEXT,
    "externalId" TEXT,
    "entityKind" TEXT,
    "fcEntityId" TEXT
  )
`;

async function insertSeries(client, { syncRunId, observedAt, rows }) {
  const params = [syncRunId, JSON.stringify(rows), observedAt];
  await client.query(`
    WITH incoming AS (${seriesRecordset('$2')})
    INSERT INTO fc_lesson_revisions (
      sync_run_id, entity_kind, fc_entity_id, revision_kind, state_hash, snapshot, observed_at
    )
    SELECT $1::uuid, 'series', i."fcSeriesId",
           CASE WHEN current.fc_series_id IS NULL THEN 'created' ELSE 'changed' END,
           i."stateHash",
           jsonb_build_object('observedRecurrence', i."observedRecurrence"),
           $3::timestamptz
    FROM incoming i
    LEFT JOIN fc_lesson_series current ON current.fc_series_id = i."fcSeriesId"
    WHERE current.state_hash IS DISTINCT FROM i."stateHash"
  `, params);
  await client.query(`
    WITH incoming AS (${seriesRecordset()})
    INSERT INTO fc_lesson_series (
      fc_series_id, source, observed_recurrence, state_hash, first_observed_at, last_observed_at
    )
    SELECT i."fcSeriesId", 'mms', i."observedRecurrence", i."stateHash", $2::timestamptz, $2::timestamptz
    FROM incoming i
    ON CONFLICT (fc_series_id) DO UPDATE SET
      observed_recurrence = EXCLUDED.observed_recurrence,
      state_hash = EXCLUDED.state_hash,
      last_observed_at = EXCLUDED.last_observed_at
  `, [JSON.stringify(rows), observedAt]);
}

function eventSnapshotSql(alias = 'i') {
  return `jsonb_build_object(
    'fcSeriesId', ${alias}."fcSeriesId",
    'localDate', ${alias}."localDate",
    'localTime', ${alias}."localTime",
    'timeZone', ${alias}."timeZone",
    'sourceStart', ${alias}."sourceStart",
    'durationMinutes', ${alias}."durationMinutes",
    'tutorExternalId', ${alias}."tutorExternalId",
    'originalTutorExternalId', ${alias}."originalTutorExternalId",
    'locationExternalId', ${alias}."locationExternalId",
    'locationName', ${alias}."locationName",
    'categoryExternalId', ${alias}."categoryExternalId",
    'categoryName', ${alias}."categoryName",
    'allDay', ${alias}."allDay",
    'sourceStatus', ${alias}."sourceStatus",
    'sourceRecurring', ${alias}."sourceRecurring",
    'sourceRecurrence', ${alias}."sourceRecurrence",
    'calendarObserved', ${alias}."calendarObserved",
    'attendanceObserved', ${alias}."attendanceObserved"
  )`;
}

async function insertEvents(client, { syncRunId, observedAt, rows }) {
  const params = [syncRunId, JSON.stringify(rows), observedAt];
  await client.query(`
    WITH incoming AS (${eventRecordset('$2')})
    INSERT INTO fc_lesson_revisions (
      sync_run_id, entity_kind, fc_entity_id, revision_kind, state_hash, snapshot, observed_at
    )
    SELECT $1::uuid, 'event', i."fcEventId",
           CASE WHEN current.fc_event_id IS NULL THEN 'created' ELSE 'changed' END,
           i."stateHash", ${eventSnapshotSql('i')}, $3::timestamptz
    FROM incoming i
    LEFT JOIN fc_lesson_events current ON current.fc_event_id = i."fcEventId"
    WHERE current.state_hash IS DISTINCT FROM i."stateHash"
      AND (current.fc_event_id IS NULL OR i."calendarObserved")
  `, params);
  const insertParams = [JSON.stringify(rows), observedAt];
  await client.query(`
    WITH incoming AS (${eventRecordset()})
    INSERT INTO fc_lesson_events (
      fc_event_id, fc_series_id, source, local_date, local_time, time_zone, source_start,
      duration_minutes, tutor_external_id, original_tutor_external_id,
      location_external_id, location_name, category_external_id, category_name,
      all_day, source_status, source_recurring, source_recurrence,
      calendar_observed, attendance_observed, state_hash,
      first_observed_at, last_observed_at
    )
    SELECT i."fcEventId", i."fcSeriesId", 'mms', i."localDate", i."localTime", i."timeZone", i."sourceStart",
           i."durationMinutes", i."tutorExternalId", i."originalTutorExternalId",
           i."locationExternalId", i."locationName", i."categoryExternalId", i."categoryName",
           i."allDay", i."sourceStatus", i."sourceRecurring", i."sourceRecurrence",
           i."calendarObserved", i."attendanceObserved", i."stateHash",
           $2::timestamptz, $2::timestamptz
    FROM incoming i
    WHERE i."calendarObserved"
    ON CONFLICT (fc_event_id) DO UPDATE SET
      fc_series_id = EXCLUDED.fc_series_id,
      local_date = EXCLUDED.local_date,
      local_time = EXCLUDED.local_time,
      time_zone = EXCLUDED.time_zone,
      source_start = EXCLUDED.source_start,
      duration_minutes = EXCLUDED.duration_minutes,
      tutor_external_id = EXCLUDED.tutor_external_id,
      original_tutor_external_id = EXCLUDED.original_tutor_external_id,
      location_external_id = EXCLUDED.location_external_id,
      location_name = EXCLUDED.location_name,
      category_external_id = EXCLUDED.category_external_id,
      category_name = EXCLUDED.category_name,
      all_day = EXCLUDED.all_day,
      source_status = EXCLUDED.source_status,
      source_recurring = EXCLUDED.source_recurring,
      source_recurrence = EXCLUDED.source_recurrence,
      calendar_observed = TRUE,
      attendance_observed = fc_lesson_events.attendance_observed OR EXCLUDED.attendance_observed,
      state_hash = EXCLUDED.state_hash,
      last_observed_at = EXCLUDED.last_observed_at
  `, insertParams);
  await client.query(`
    WITH incoming AS (${eventRecordset()})
    INSERT INTO fc_lesson_events (
      fc_event_id, fc_series_id, source, local_date, local_time, time_zone, source_start,
      duration_minutes, tutor_external_id, original_tutor_external_id,
      location_external_id, location_name, category_external_id, category_name,
      all_day, source_status, source_recurring, source_recurrence,
      calendar_observed, attendance_observed, state_hash,
      first_observed_at, last_observed_at
    )
    SELECT i."fcEventId", i."fcSeriesId", 'mms', i."localDate", i."localTime", i."timeZone", i."sourceStart",
           i."durationMinutes", i."tutorExternalId", i."originalTutorExternalId",
           i."locationExternalId", i."locationName", i."categoryExternalId", i."categoryName",
           i."allDay", i."sourceStatus", i."sourceRecurring", i."sourceRecurrence",
           FALSE, TRUE, i."stateHash", $2::timestamptz, $2::timestamptz
    FROM incoming i
    WHERE NOT i."calendarObserved"
    ON CONFLICT (fc_event_id) DO UPDATE SET
      attendance_observed = TRUE,
      last_observed_at = EXCLUDED.last_observed_at
  `, insertParams);
}

async function insertParticipations(client, { syncRunId, observedAt, rows }) {
  const params = [syncRunId, JSON.stringify(rows), observedAt];
  await client.query(`
    WITH incoming AS (${participationRecordset('$2')})
    INSERT INTO fc_lesson_revisions (
      sync_run_id, entity_kind, fc_entity_id, revision_kind, state_hash, snapshot, observed_at
    )
    SELECT $1::uuid, 'participation', i."fcParticipationId",
           CASE WHEN current.fc_participation_id IS NULL THEN 'created' ELSE 'changed' END,
           i."stateHash",
           jsonb_build_object(
             'fcEventId', i."fcEventId",
             'studentExternalId', i."studentExternalId",
             'rawAttendanceStatus', i."rawAttendanceStatus"
           ),
           $3::timestamptz
    FROM incoming i
    LEFT JOIN fc_lesson_participations current
      ON current.fc_participation_id = i."fcParticipationId"
    WHERE current.state_hash IS DISTINCT FROM i."stateHash"
  `, params);
  await client.query(`
    WITH incoming AS (${participationRecordset()})
    INSERT INTO fc_lesson_participations (
      fc_participation_id, fc_event_id, student_external_id, attendance_external_id,
      raw_attendance_status, state_hash, first_observed_at, last_observed_at
    )
    SELECT i."fcParticipationId", i."fcEventId", i."studentExternalId", i."attendanceExternalId",
           i."rawAttendanceStatus", i."stateHash", $2::timestamptz, $2::timestamptz
    FROM incoming i
    ON CONFLICT (fc_participation_id) DO UPDATE SET
      attendance_external_id = COALESCE(EXCLUDED.attendance_external_id, fc_lesson_participations.attendance_external_id),
      raw_attendance_status = EXCLUDED.raw_attendance_status,
      state_hash = EXCLUDED.state_hash,
      last_observed_at = EXCLUDED.last_observed_at
  `, [JSON.stringify(rows), observedAt]);
}

async function insertExternalRefs(client, { observedAt, rows }) {
  const rowsJson = JSON.stringify(rows);
  const conflicts = await client.query(`
    WITH incoming AS (${EXTERNAL_REF_RECORDSET})
    SELECT i."provider", i."referenceKind", i."externalId"
    FROM incoming i
    JOIN fc_lesson_external_refs current
      ON current.provider = i."provider"
     AND current.reference_kind = i."referenceKind"
     AND current.external_id = i."externalId"
    WHERE current.entity_kind <> i."entityKind"
       OR current.fc_entity_id <> i."fcEntityId"
    LIMIT 1
  `, [rowsJson]);
  if (conflicts.rows?.[0]) {
    throw new Error('An external lesson reference is already attached to a different First Chord entity');
  }
  await client.query(`
    WITH incoming AS (${EXTERNAL_REF_RECORDSET})
    INSERT INTO fc_lesson_external_refs (
      provider, reference_kind, external_id, entity_kind, fc_entity_id,
      first_observed_at, last_observed_at
    )
    SELECT i."provider", i."referenceKind", i."externalId", i."entityKind", i."fcEntityId",
           $2::timestamptz, $2::timestamptz
    FROM incoming i
    ON CONFLICT (provider, reference_kind, external_id) DO UPDATE SET
      last_observed_at = EXCLUDED.last_observed_at
  `, [rowsJson, observedAt]);
}

export async function persistLessonMirrorSnapshot({
  syncRunId,
  observedAt,
  calendarExpectedCount,
  calendarReceivedCount,
  attendanceExpectedCount,
  attendanceReceivedCount,
  snapshot,
  database = null,
  env = process.env,
} = {}) {
  const pool = db(database, env);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [SYNC_LOCK_NAME]);
    await insertSeries(client, { syncRunId, observedAt, rows: snapshot.series || [] });
    await insertEvents(client, { syncRunId, observedAt, rows: snapshot.events || [] });
    await insertParticipations(client, { syncRunId, observedAt, rows: snapshot.participations || [] });
    await insertExternalRefs(client, { observedAt, rows: snapshot.externalRefs || [] });
    const completed = await client.query(`
      UPDATE fc_lesson_sync_runs
      SET status = 'succeeded',
          calendar_expected_count = $2,
          calendar_received_count = $3,
          attendance_expected_count = $4,
          attendance_received_count = $5,
          series_count = $6,
          event_count = $7,
          participation_count = $8,
          completed_at = $9::timestamptz
      WHERE sync_run_id = $1::uuid AND status = 'running'
      RETURNING sync_run_id, status
    `, [
      syncRunId,
      calendarExpectedCount,
      calendarReceivedCount,
      attendanceExpectedCount,
      attendanceReceivedCount,
      snapshot.series?.length || 0,
      snapshot.events?.length || 0,
      snapshot.participations?.length || 0,
      observedAt,
    ]);
    if (!completed.rows?.[0]) throw new Error('Lesson mirror sync run was not in a completable state');
    await client.query('COMMIT');
    return {
      syncRunId,
      status: 'succeeded',
      seriesCount: snapshot.series?.length || 0,
      eventCount: snapshot.events?.length || 0,
      participationCount: snapshot.participations?.length || 0,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the first error; the pool will discard a broken connection.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getLessonMirrorStatus({ database = null, env = process.env } = {}) {
  const result = await db(database, env).query(`
    SELECT
      latest.sync_run_id,
      latest.source,
      latest.trigger_kind,
      latest.window_start::text AS window_start,
      latest.window_end_exclusive::text AS window_end_exclusive,
      latest.status,
      latest.calendar_expected_count,
      latest.calendar_received_count,
      latest.attendance_expected_count,
      latest.attendance_received_count,
      latest.series_count,
      latest.event_count,
      latest.participation_count,
      latest.failure_code,
      latest.started_at,
      latest.completed_at,
      (SELECT COUNT(*)::integer FROM fc_lesson_series) AS stored_series_count,
      (SELECT COUNT(*)::integer FROM fc_lesson_events) AS stored_event_count,
      (SELECT COUNT(*)::integer FROM fc_lesson_participations) AS stored_participation_count,
      (SELECT COUNT(*)::integer FROM fc_lesson_revisions) AS stored_revision_count
    FROM fc_lesson_sync_runs latest
    ORDER BY latest.started_at DESC, latest.sync_run_id DESC
    LIMIT 1
  `);
  return result.rows?.[0] || null;
}

export function assessLessonMirrorStatus(status, {
  now = new Date(),
  freshForHours = 36,
  runningForMinutes = 30,
} = {}) {
  if (!status) return { state: 'never_run', ageMinutes: null };
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const reference = status.completed_at || status.started_at;
  const referenceMs = new Date(reference || '').getTime();
  const ageMinutes = Number.isFinite(nowMs) && Number.isFinite(referenceMs)
    ? Math.max(0, Math.floor((nowMs - referenceMs) / 60_000))
    : null;
  if (status.status === 'failed') return { state: 'failed', ageMinutes, failureCode: status.failure_code || null };
  if (status.status === 'running') {
    return { state: ageMinutes !== null && ageMinutes > runningForMinutes ? 'stuck' : 'running', ageMinutes };
  }
  if (status.status !== 'succeeded' || ageMinutes === null) return { state: 'unknown', ageMinutes };
  return { state: ageMinutes <= freshForHours * 60 ? 'fresh' : 'stale', ageMinutes };
}
