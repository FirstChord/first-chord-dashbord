import assert from 'node:assert/strict';
import test from 'node:test';

import {
  claimPracticeNoteDelivery,
  ensurePracticeNoteDeliveryClaimsTable,
  finalisePracticeNoteDeliveryClaim,
  releasePracticeNoteDeliveryClaim,
} from '../../lib/admin/practice-note-delivery-claims.mjs';

function createClaimQuery() {
  let row = null;
  const query = async (sql, params = []) => {
    if (sql.includes('CREATE TABLE')) return { rows: [] };
    if (sql.includes('INSERT INTO')) {
      if (row) return { rows: [] };
      row = {
        delivery_key: params[0],
        actor_tutor: params[1],
        status: 'claimed',
        created_at: '2026-08-03T09:00:00.000Z',
        updated_at: '2026-08-03T09:00:00.000Z',
      };
      return { rows: [row] };
    }
    if (sql.includes('SELECT delivery_key')) return { rows: row ? [row] : [] };
    if (sql.includes("SET status = 'tracking_failed'")) {
      const staleBefore = new Date(params[1]).getTime();
      const updatedAt = new Date(row?.updated_at || '').getTime();
      if (!row || row.status !== 'claimed' || updatedAt > staleBefore) return { rows: [] };
      row = { ...row, status: 'tracking_failed', updated_at: '2026-08-03T10:00:00.000Z' };
      return { rows: [row] };
    }
    if (sql.includes('UPDATE')) {
      if (!row || row.status !== 'claimed') return { rows: [] };
      row = { ...row, status: params[1] };
      return { rows: [row] };
    }
    if (sql.includes('DELETE')) {
      const deleted = row?.status === 'claimed';
      if (deleted) row = null;
      return { rowCount: deleted ? 1 : 0, rows: [] };
    }
    throw new Error('Unexpected SQL');
  };
  return {
    query,
    setUpdatedAt(value) {
      row = row ? { ...row, updated_at: value } : row;
    },
  };
}

test('delivery claim table has a unique delivery key and claim is atomic', async () => {
  const { query } = createClaimQuery();
  const now = new Date('2026-08-03T09:01:00.000Z');
  await ensurePracticeNoteDeliveryClaimsTable({ query });
  assert.equal((await claimPracticeNoteDelivery({ deliveryKey: 'delivery:1', actorTutor: 'Self-attested: Kenny', query, now })).ok, true);
  const duplicate = await claimPracticeNoteDelivery({ deliveryKey: 'delivery:1', actorTutor: 'Self-attested: Kenny', query, now });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.inProgress, true);
});

test('terminal claims cannot be re-acquired and pre-provider claims can be released', async () => {
  const completed = createClaimQuery();
  await claimPracticeNoteDelivery({ deliveryKey: 'delivery:complete', actorTutor: 'Self-attested: Kenny', query: completed.query });
  await finalisePracticeNoteDeliveryClaim({ deliveryKey: 'delivery:complete', status: 'completed', query: completed.query });
  assert.equal((await claimPracticeNoteDelivery({ deliveryKey: 'delivery:complete', actorTutor: 'Self-attested: Kenny', query: completed.query })).alreadyCompleted, true);

  const released = createClaimQuery();
  await claimPracticeNoteDelivery({ deliveryKey: 'delivery:release', actorTutor: 'Self-attested: Kenny', query: released.query });
  assert.equal((await releasePracticeNoteDeliveryClaim({ deliveryKey: 'delivery:release', query: released.query })).released, true);
});

test('an abandoned claim becomes manual follow-up instead of being reacquired', async () => {
  const store = createClaimQuery();
  await claimPracticeNoteDelivery({
    deliveryKey: 'delivery:abandoned',
    actorTutor: 'Self-attested: Kenny',
    query: store.query,
  });
  store.setUpdatedAt('2026-08-03T09:30:00.000Z');

  const duplicate = await claimPracticeNoteDelivery({
    deliveryKey: 'delivery:abandoned',
    actorTutor: 'Self-attested: Kenny',
    query: store.query,
    now: new Date('2026-08-03T10:00:00.000Z'),
  });

  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.inProgress, false);
  assert.equal(duplicate.manualFollowUp, true);
  assert.equal(duplicate.staleClaim, true);
  assert.equal(duplicate.status, 'tracking_failed');
});

test('a fresh duplicate claim remains in progress', async () => {
  const store = createClaimQuery();
  await claimPracticeNoteDelivery({
    deliveryKey: 'delivery:fresh',
    actorTutor: 'Self-attested: Kenny',
    query: store.query,
  });
  store.setUpdatedAt('2026-08-03T09:50:00.001Z');

  const duplicate = await claimPracticeNoteDelivery({
    deliveryKey: 'delivery:fresh',
    actorTutor: 'Self-attested: Kenny',
    query: store.query,
    now: new Date('2026-08-03T10:00:00.000Z'),
  });

  assert.equal(duplicate.inProgress, true);
  assert.equal(duplicate.manualFollowUp, false);
  assert.equal(duplicate.status, 'claimed');
});
