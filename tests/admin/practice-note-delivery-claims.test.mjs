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
      row = { delivery_key: params[0], actor_tutor: params[1], status: 'claimed' };
      return { rows: [row] };
    }
    if (sql.includes('SELECT delivery_key')) return { rows: row ? [row] : [] };
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
  return { query };
}

test('delivery claim table has a unique delivery key and claim is atomic', async () => {
  const { query } = createClaimQuery();
  await ensurePracticeNoteDeliveryClaimsTable({ query });
  assert.equal((await claimPracticeNoteDelivery({ deliveryKey: 'delivery:1', actorTutor: 'Self-attested: Kenny', query })).ok, true);
  const duplicate = await claimPracticeNoteDelivery({ deliveryKey: 'delivery:1', actorTutor: 'Self-attested: Kenny', query });
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
