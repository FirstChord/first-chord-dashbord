import { Pool } from 'pg';

const CLAIM_TABLE = 'practice_note_delivery_claims';
let sharedPool = null;

function clean(value = '') {
  return `${value || ''}`.trim();
}

export function getPracticeNoteDeliveryClaimsConfig(env = process.env) {
  const connectionString = clean(env.DATABASE_URL);
  return {
    connectionString,
    configured: Boolean(connectionString),
  };
}

function getPool(env = process.env) {
  const { connectionString } = getPracticeNoteDeliveryClaimsConfig(env);
  if (!connectionString) throw new Error('Practice-note delivery claims database is not configured');
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString,
      ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      max: 4,
    });
  }
  return sharedPool;
}

export async function ensurePracticeNoteDeliveryClaimsTable({ query = null, env = process.env } = {}) {
  const execute = query || ((sql, params) => getPool(env).query(sql, params));
  await execute(`
    CREATE TABLE IF NOT EXISTS ${CLAIM_TABLE} (
      delivery_key TEXT PRIMARY KEY,
      actor_tutor TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('claimed', 'completed', 'attendance_only_completed', 'email_failed_manual_follow_up', 'tracking_failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function claimPracticeNoteDelivery({ deliveryKey = '', actorTutor = '', query = null, env = process.env } = {}) {
  const key = clean(deliveryKey);
  const tutor = clean(actorTutor);
  if (!key || !tutor) throw new Error('deliveryKey and actorTutor are required for a practice-note delivery claim');
  const execute = query || ((sql, params) => getPool(env).query(sql, params));
  const insert = await execute(`
    INSERT INTO ${CLAIM_TABLE} (delivery_key, actor_tutor, status)
    VALUES ($1, $2, 'claimed')
    ON CONFLICT (delivery_key) DO NOTHING
    RETURNING delivery_key, actor_tutor, status
  `, [key, tutor]);
  if (insert.rows?.[0]) return { ok: true, claimed: true, ...insert.rows[0] };

  const existing = await execute(
    `SELECT delivery_key, actor_tutor, status FROM ${CLAIM_TABLE} WHERE delivery_key = $1`,
    [key],
  );
  const row = existing.rows?.[0] || {};
  return {
    ok: false,
    inProgress: row.status === 'claimed',
    alreadyCompleted: ['completed', 'attendance_only_completed'].includes(row.status),
    manualFollowUp: ['email_failed_manual_follow_up', 'tracking_failed'].includes(row.status),
    ...row,
  };
}

export async function releasePracticeNoteDeliveryClaim({ deliveryKey = '', query = null, env = process.env } = {}) {
  const key = clean(deliveryKey);
  if (!key) return { released: false };
  const execute = query || ((sql, params) => getPool(env).query(sql, params));
  const result = await execute(
    `DELETE FROM ${CLAIM_TABLE} WHERE delivery_key = $1 AND status = 'claimed'`,
    [key],
  );
  return { released: (result.rowCount || 0) > 0 };
}

export async function finalisePracticeNoteDeliveryClaim({ deliveryKey = '', status = '', query = null, env = process.env } = {}) {
  const key = clean(deliveryKey);
  const nextStatus = clean(status);
  const allowedStatuses = new Set(['completed', 'attendance_only_completed', 'email_failed_manual_follow_up', 'tracking_failed']);
  if (!key || !allowedStatuses.has(nextStatus)) throw new Error('A valid delivery key and final claim status are required');
  const execute = query || ((sql, params) => getPool(env).query(sql, params));
  const result = await execute(`
    UPDATE ${CLAIM_TABLE}
    SET status = $2, updated_at = NOW()
    WHERE delivery_key = $1 AND status = 'claimed'
    RETURNING delivery_key, actor_tutor, status
  `, [key, nextStatus]);
  if (!result.rows?.[0]) throw new Error('Practice-note delivery claim could not be finalised');
  return { ok: true, ...result.rows[0] };
}
