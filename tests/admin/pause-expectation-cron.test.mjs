import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPauseExpectationCronHandler,
  MAX_UNATTENDED_CHANGES,
} from '../../lib/admin/pause-expectation-cron.mjs';

const SECRET = 'pause-secret-value';
const env = { PAUSE_SYNC_SECRET: SECRET };

function makeRequest({ secret = SECRET, maxChanges } = {}) {
  const url = maxChanges === undefined
    ? 'https://example.test/api/cron/pause-expectations'
    : `https://example.test/api/cron/pause-expectations?maxChanges=${maxChanges}`;
  return {
    url,
    headers: {
      get: (name) => (name === 'x-firstchord-pause-secret' && secret !== null ? secret : null),
    },
  };
}

function preview({ changeCount = 0, checkedCount = 197, changes = [] } = {}) {
  return async () => ({ checkedCount, changeCount, changes });
}

function scan({ scannedCount = 185, issues = [] } = {}) {
  return async () => ({ scannedCount, issues, scannedAt: '2026-08-17T04:30:00.000Z' });
}

test('a missing secret in the environment fails closed before any read', async () => {
  let called = false;
  const handler = createPauseExpectationCronHandler({
    getPreview: async () => { called = true; },
    reconcile: async () => {},
    rescan: async () => {},
    env: {},
  });
  const response = await handler(makeRequest());
  assert.equal(response.status, 503);
  assert.equal(called, false);
});

test('a wrong secret is rejected before any read', async () => {
  let called = false;
  const handler = createPauseExpectationCronHandler({
    getPreview: async () => { called = true; },
    reconcile: async () => {},
    rescan: async () => {},
    env,
  });
  const response = await handler(makeRequest({ secret: 'wrong-secret-value' }));
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test('an empty plan still rescans so cleared rows leave the board', async () => {
  let reconcileCalled = false;
  let rescanCalled = false;
  const handler = createPauseExpectationCronHandler({
    getPreview: preview({ changeCount: 0 }),
    reconcile: async () => { reconcileCalled = true; },
    rescan: async () => { rescanCalled = true; return { scannedCount: 185, issues: [], scannedAt: '' }; },
    env,
  });
  const response = await handler(makeRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.changeCount, 0);
  assert.equal(reconcileCalled, false, 'no write is attempted when nothing needs changing');
  assert.equal(rescanCalled, true);
});

test('reconciliation runs before the rescan and passes the cron actor', async () => {
  const order = [];
  let actor;
  const handler = createPauseExpectationCronHandler({
    getPreview: preview({ changeCount: 2 }),
    reconcile: async (input) => {
      order.push('reconcile');
      actor = input.actorEmail;
      return {
        checkedCount: 197,
        changeCount: 2,
        synced: [
          { mmsId: 'sdt_a', studentName: 'A', previousPaymentExpectation: 'stripe_paused_expected', nextPaymentExpectation: 'stripe_active_expected' },
          { mmsId: 'sdt_b', studentName: 'B', previousPaymentExpectation: 'stripe_active_expected', nextPaymentExpectation: 'stripe_paused_expected' },
        ],
      };
    },
    rescan: async () => { order.push('rescan'); return { scannedCount: 185, issues: [], scannedAt: '' }; },
    env,
  });
  const response = await handler(makeRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(order, ['reconcile', 'rescan'], 'the rescan must see corrected expectations');
  assert.equal(actor, 'cron@github-actions');
  assert.equal(body.changeCount, 2);
  assert.equal(body.changes.length, 2);
});

test('an oversized plan is refused before writing and names what it declined', async () => {
  let reconcileCalled = false;
  const changes = Array.from({ length: MAX_UNATTENDED_CHANGES + 1 }, (unused, index) => ({
    mmsId: `sdt_${index}`,
    studentName: `Student ${index}`,
    previousPaymentExpectation: 'stripe_paused_expected',
    nextPaymentExpectation: 'stripe_active_expected',
  }));
  const handler = createPauseExpectationCronHandler({
    getPreview: preview({ changeCount: changes.length, changes }),
    reconcile: async () => { reconcileCalled = true; },
    rescan: async () => ({ scannedCount: 0, issues: [], scannedAt: '' }),
    env,
  });
  const response = await handler(makeRequest());
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.success, false);
  assert.equal(body.stage, 'cap');
  assert.equal(body.changeCount, 0);
  assert.equal(body.plannedChangeCount, changes.length);
  assert.equal(body.changes.length, changes.length);
  assert.equal(reconcileCalled, false, 'nothing is written when the plan looks anomalous');
});

test('an explicit higher cap lets a backlog through', async () => {
  let reconcileCalled = false;
  const handler = createPauseExpectationCronHandler({
    getPreview: preview({ changeCount: 36 }),
    reconcile: async () => { reconcileCalled = true; return { checkedCount: 197, changeCount: 36, synced: [] }; },
    rescan: scan(),
    env,
  });
  const response = await handler(makeRequest({ maxChanges: 50 }));

  assert.equal(response.status, 200);
  assert.equal(reconcileCalled, true);
});

test('an absent cap means the default, not a cap of zero', async () => {
  let reconcileCalled = false;
  const handler = createPauseExpectationCronHandler({
    getPreview: preview({ changeCount: MAX_UNATTENDED_CHANGES }),
    reconcile: async () => { reconcileCalled = true; return { checkedCount: 197, changeCount: MAX_UNATTENDED_CHANGES, synced: [] }; },
    rescan: scan(),
    env,
  });
  const response = await handler(makeRequest());

  assert.equal(response.status, 200);
  assert.equal(reconcileCalled, true, 'the nightly run sends no maxChanges and must still write');
});

test('a non-numeric cap falls back to the default rather than disabling the guard', async () => {
  let reconcileCalled = false;
  const handler = createPauseExpectationCronHandler({
    getPreview: preview({ changeCount: MAX_UNATTENDED_CHANGES + 1 }),
    reconcile: async () => { reconcileCalled = true; },
    rescan: scan(),
    env,
  });
  const response = await handler(makeRequest({ maxChanges: 'lots' }));

  assert.equal(response.status, 409);
  assert.equal(reconcileCalled, false);
});

test('a reconciliation failure is reported with its partial result and skips the rescan', async () => {
  let rescanCalled = false;
  const failure = new Error('Students sheet write failed');
  failure.partialResult = { changeCount: 1, failed: { stage: 'student_batch_write', outcome: 'unknown' } };
  const handler = createPauseExpectationCronHandler({
    getPreview: preview({ changeCount: 3 }),
    reconcile: async () => { throw failure; },
    rescan: async () => { rescanCalled = true; },
    env,
  });
  const response = await handler(makeRequest());
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.stage, 'reconcile');
  assert.equal(body.partialResult.failed.stage, 'student_batch_write');
  assert.equal(rescanCalled, false);
});

test('a rescan failure still reports the writes that already landed', async () => {
  const handler = createPauseExpectationCronHandler({
    getPreview: preview({ changeCount: 1 }),
    reconcile: async () => ({
      checkedCount: 197,
      changeCount: 1,
      synced: [{ mmsId: 'sdt_a', studentName: 'A', previousPaymentExpectation: 'stripe_paused_expected', nextPaymentExpectation: 'stripe_active_expected' }],
    }),
    rescan: async () => { throw new Error('Stripe timed out'); },
    env,
  });
  const response = await handler(makeRequest());
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.stage, 'rescan');
  assert.equal(body.changeCount, 1, 'the sheet write is not unwound by a stale board');
  assert.equal(body.changes[0].studentName, 'A');
});

test('the reported open count excludes rows the rescan marked absent', async () => {
  const handler = createPauseExpectationCronHandler({
    getPreview: preview({ changeCount: 0 }),
    reconcile: async () => {},
    rescan: scan({
      issues: [
        { status: 'open', sourcePresent: true },
        { status: 'open', sourcePresent: false },
        { status: 'resolved', sourcePresent: true },
      ],
    }),
    env,
  });
  const response = await handler(makeRequest());
  const body = await response.json();

  assert.equal(body.openIssueCount, 1);
  assert.equal(body.scannedCount, 185);
});
