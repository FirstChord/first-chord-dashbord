import assert from 'node:assert/strict';
import test from 'node:test';

import { persistIncomingPlanningConversion } from '../../lib/admin/incoming-conversion.mjs';

test('archives the inbox row only after the linked planning item saves', async () => {
  const calls = [];
  const result = await persistIncomingPlanningConversion({
    corrected: { incomingId: 'incoming_123', status: 'needs_review' },
    planningId: 'planning_incoming_123',
    draft: { title: 'Follow up' },
    actorEmail: 'finn@example.com',
  }, {
    savePlanningItem: async (input) => {
      calls.push(['plan', input]);
      return { planningId: input.planningId };
    },
    upsertIncomingMessage: async (row) => {
      calls.push(['inbox', row]);
    },
  });

  assert.deepEqual(calls.map(([kind]) => kind), ['plan', 'inbox']);
  assert.equal(result.row.status, 'converted');
  assert.equal(result.row.createdPlanningId, 'planning_incoming_123');
  assert.equal(result.row.resolutionType, 'planning_task');
});

test('a failed planning write never archives or links the inbox row', async () => {
  let inboxWrites = 0;

  await assert.rejects(
    persistIncomingPlanningConversion({
      corrected: { incomingId: 'incoming_123', status: 'needs_review' },
      planningId: 'planning_incoming_123',
      draft: { title: 'Follow up' },
    }, {
      savePlanningItem: async () => {
        throw new Error('Planning sheet unavailable');
      },
      upsertIncomingMessage: async () => {
        inboxWrites += 1;
      },
    }),
    /Planning sheet unavailable/u,
  );

  assert.equal(inboxWrites, 0);
});
