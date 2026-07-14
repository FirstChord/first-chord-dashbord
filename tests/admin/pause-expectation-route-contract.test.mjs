import test from 'node:test';
import assert from 'node:assert/strict';

import {
  executePauseExpectationPreview,
  executePauseExpectationReconciliation,
} from '../../lib/admin/pause-expectation-route-contract.mjs';

const adminSession = { user: { isAdmin: true, email: 'admin@example.com' } };

test('unauthorized preview cannot reach the read service', async () => {
  let called = false;
  const result = await executePauseExpectationPreview({
    session: null,
    getPreview: async () => { called = true; },
  });
  assert.equal(result.status, 401);
  assert.equal(called, false);
});

test('reconciliation requires literal confirmation before calling the workflow', async () => {
  let called = false;
  const result = await executePauseExpectationReconciliation({
    session: adminSession,
    payload: { confirm: 'true' },
    reconcile: async () => { called = true; },
  });
  assert.equal(result.status, 400);
  assert.equal(called, false);
});

test('confirmed reconciliation passes the signed-in actor to the workflow', async () => {
  let input;
  const result = await executePauseExpectationReconciliation({
    session: adminSession,
    payload: { confirm: true },
    reconcile: async (value) => {
      input = value;
      return { changeCount: 1 };
    },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(input, { actorEmail: 'admin@example.com' });
  assert.deepEqual(result.body, { changeCount: 1 });
});

test('partial workflow failure remains visible to the caller', async () => {
  const error = new Error('write failed');
  error.partialResult = { changeCount: 1, failed: { mmsId: 'sdt_2', stage: 'student_write' } };
  const result = await executePauseExpectationReconciliation({
    session: adminSession,
    payload: { confirm: true },
    reconcile: async () => { throw error; },
  });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body.partialResult, error.partialResult);
});
