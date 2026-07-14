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
  assert.equal(eventBatches.length, 2);
  assert.equal(eventBatches[0].length, 1);
  assert.equal(eventBatches[1].length, 1);

  const attempt = eventBatches[0][0];
  assert.equal(attempt.eventType, 'payment_expectation_reconciliation_attempted');
  const event = eventBatches[1][0];
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

test('explicit reconciliation records completed students and the failed write stage', async () => {
  const events = [];
  let updateCount = 0;

  await assert.rejects(
    applyPauseExpectationReconciliation([
      eligiblePausedStudent({ mmsId: 'sdt_first', fullName: 'First Student' }),
      eligiblePausedStudent({ mmsId: 'sdt_second', fullName: 'Second Student' }),
    ], {
      actorEmail: 'admin@example.com',
      currentDate: '2026-07-14T12:00:00.000Z',
      updateStudentPaymentExpectation: async () => {
        updateCount += 1;
        if (updateCount === 2) throw new Error('Sheets update failed');
      },
      appendEvents: async (rows) => events.push(...rows),
    }),
    (error) => {
      assert.equal(error.partialResult.changeCount, 1);
      assert.equal(error.partialResult.synced[0].mmsId, 'sdt_first');
      assert.deepEqual(error.partialResult.failed, {
        mmsId: 'sdt_second',
        nextPaymentExpectation: 'stripe_paused_expected',
        stage: 'student_write',
      });
      return true;
    },
  );

  assert.deepEqual(events.map((event) => [event.entityId, event.eventType]), [
    ['sdt_first', 'payment_expectation_reconciliation_attempted'],
    ['sdt_first', 'payment_expectation_reconciled'],
    ['sdt_second', 'payment_expectation_reconciliation_attempted'],
  ]);
});

test('explicit reconciliation never writes when the attempt audit cannot be stored', async () => {
  let updateCalled = false;
  await assert.rejects(
    applyPauseExpectationReconciliation([eligiblePausedStudent()], {
      currentDate: '2026-07-14T12:00:00.000Z',
      updateStudentPaymentExpectation: async () => { updateCalled = true; },
      appendEvents: async () => { throw new Error('Event Log unavailable'); },
    }),
    (error) => error.partialResult.failed.stage === 'attempt_log',
  );
  assert.equal(updateCalled, false);
});
