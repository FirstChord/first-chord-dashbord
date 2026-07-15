import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPracticeNoteClaimFailureResponse,
  executeClaimedPracticeNoteDelivery,
} from '../../lib/admin/practice-note-delivery-workflow.mjs';

test('claim failure response is an explicit 503 with no provider-action claim', () => {
  const response = buildPracticeNoteClaimFailureResponse({
    deliveryKey: 'delivery:failed',
    claimResult: { ok: false, error: 'Sheets unavailable' },
    preview: { student: { name: 'Preview only' } },
  });

  assert.equal(response.status, 503);
  assert.equal(response.body.success, false);
  assert.match(response.body.error, /No MMS attendance update or Gmail email was attempted/u);
  assert.deepEqual(response.body.attendanceSave, {
    ok: false, skipped: true, reason: 'delivery_claim_failed',
  });
  assert.equal(response.body.practiceNoteEmail.skipped, true);
  assert.equal(response.body.emailNotes.skipped, true);
  assert.equal(response.body.partialSuccess, false);
});

test('a thrown claim failure prevents delivery execution', async () => {
  let deliveryCalls = 0;

  const result = await executeClaimedPracticeNoteDelivery({
    deliveryKey: 'delivery:claim-throws',
    saveClaim: async () => {
      throw new Error('Sheets unavailable');
    },
    executeDelivery: async () => {
      deliveryCalls += 1;
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'claim_failed');
  assert.equal(result.claimResult.ok, false);
  assert.equal(result.claimResult.error, 'Sheets unavailable');
  assert.equal(deliveryCalls, 0);
});

test('an error-valued claim prevents delivery execution', async () => {
  let deliveryCalls = 0;

  const result = await executeClaimedPracticeNoteDelivery({
    deliveryKey: 'delivery:claim-error',
    saveClaim: async () => ({ ok: true, error: 'Claim rejected' }),
    executeDelivery: async () => {
      deliveryCalls += 1;
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'claim_failed');
  assert.equal(result.claimResult.ok, false);
  assert.equal(result.claimResult.error, 'Claim rejected');
  assert.equal(deliveryCalls, 0);
});

test('a successful claim runs delivery then finalisation exactly once', async () => {
  const calls = [];

  const result = await executeClaimedPracticeNoteDelivery({
    deliveryKey: 'delivery:success',
    saveClaim: async () => {
      calls.push('claim');
      return { deliveryKey: 'delivery:success' };
    },
    executeDelivery: async () => {
      calls.push('delivery');
      return { attendanceSave: { ok: true } };
    },
    finalizeDelivery: async (deliveryResult) => {
      calls.push('finalise');
      assert.equal(deliveryResult.attendanceSave.ok, true);
      return { ok: true };
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['claim', 'delivery', 'finalise']);
  assert.equal(result.claimResult.ok, true);
  assert.equal(result.deliveryResult.attendanceSave.ok, true);
  assert.equal(result.finalResult.ok, true);
});

test('the in-process guard skips a concurrent execution for the same key', async () => {
  let releaseFirst;
  const firstCanFinish = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let firstDeliveryCalls = 0;
  let secondDeliveryCalls = 0;

  const first = executeClaimedPracticeNoteDelivery({
    deliveryKey: 'delivery:concurrent',
    saveClaim: async () => ({ upserted: true }),
    executeDelivery: async () => {
      firstDeliveryCalls += 1;
      await firstCanFinish;
      return { ok: true };
    },
  });

  const second = await executeClaimedPracticeNoteDelivery({
    deliveryKey: 'delivery:concurrent',
    saveClaim: async () => ({ upserted: true }),
    executeDelivery: async () => {
      secondDeliveryCalls += 1;
      return { ok: true };
    },
  });

  assert.equal(second.ok, false);
  assert.equal(second.inProgress, true);
  assert.equal(second.reason, 'in_process');
  assert.equal(firstDeliveryCalls, 1);
  assert.equal(secondDeliveryCalls, 0);

  releaseFirst();
  await first;
});

test('the in-process guard is released when delivery throws', async () => {
  await assert.rejects(
    executeClaimedPracticeNoteDelivery({
      deliveryKey: 'delivery:retry-after-error',
      saveClaim: async () => ({ upserted: true }),
      executeDelivery: async () => {
        throw new Error('MMS failed');
      },
    }),
    /MMS failed/,
  );

  const retry = await executeClaimedPracticeNoteDelivery({
    deliveryKey: 'delivery:retry-after-error',
    saveClaim: async () => ({ upserted: true }),
    executeDelivery: async () => ({ ok: true }),
  });

  assert.equal(retry.ok, true);
});
