import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPauseExpectationReconciliation } from '../../lib/admin/pause-expectation-reconciliation.mjs';

function eligiblePausedStudent(overrides = {}) {
  return {
    mmsId: 'sdt_sync',
    fullName: 'Sam Example',
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_active_expected',
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: true,
      matchedBy: 'subscription_id',
      matchConfidence: 'high',
    },
    pauseCoverageContext: {
      status: 'covers_future_or_current_lesson',
      confidence: 'high',
      coveredLessonCount: 1,
      summary: 'This pause window covers the usual lesson.',
    },
    ...overrides,
  };
}

test('explicit reconciliation writes only planned changes and logs the signed-in admin', async () => {
  const updates = [];
  const eventBatches = [];

  const result = await applyPauseExpectationReconciliation([
    eligiblePausedStudent(),
    eligiblePausedStudent({
      mmsId: 'sdt_already_synced',
      fullName: 'Alex Example',
      paymentExpectation: 'stripe_paused_expected',
    }),
  ], {
    actorEmail: 'admin@example.com',
    currentDate: '2026-07-14T12:00:00.000Z',
    updateStudentPaymentExpectation: async (mmsId, paymentExpectation) => {
      updates.push({ mmsId, paymentExpectation });
    },
    appendEvents: async (events) => {
      eventBatches.push(events);
    },
  });

  assert.equal(result.checkedCount, 2);
  assert.equal(result.changeCount, 1);
  assert.equal(result.reconciledAt, '2026-07-14T12:00:00.000Z');
  assert.deepEqual(updates, [{ mmsId: 'sdt_sync', paymentExpectation: 'stripe_paused_expected' }]);
  assert.equal(result.synced[0].studentName, 'Sam Example');
  assert.equal(eventBatches.length, 1);
  assert.equal(eventBatches[0].length, 1);

  const event = eventBatches[0][0];
  const payload = JSON.parse(event.payloadJson);
  assert.equal(event.actorEmail, 'admin@example.com');
  assert.equal(event.eventType, 'payment_expectation_reconciled');
  assert.equal(payload.source, 'pause_history_explicit_reconciliation');
  assert.equal(payload.previous_value, 'stripe_active_expected');
  assert.equal(payload.next_value, 'stripe_paused_expected');
});

test('explicit reconciliation is a no-op without eligible changes and needs no write adapters', async () => {
  const result = await applyPauseExpectationReconciliation([
    eligiblePausedStudent({ paymentExpectation: 'stripe_paused_expected' }),
  ], {
    currentDate: '2026-07-14T12:00:00.000Z',
  });

  assert.equal(result.checkedCount, 1);
  assert.equal(result.changeCount, 0);
  assert.deepEqual(result.synced, []);
});

test('explicit reconciliation refuses to change state without both write adapters', async () => {
  await assert.rejects(
    applyPauseExpectationReconciliation([eligiblePausedStudent()], {
      currentDate: '2026-07-14T12:00:00.000Z',
      updateStudentPaymentExpectation: async () => {},
    }),
    /requires explicit write adapters/i,
  );
});
