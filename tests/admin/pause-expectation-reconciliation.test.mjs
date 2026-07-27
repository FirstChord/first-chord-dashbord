import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPauseExpectationReconciliation,
  buildPauseExpectationReconciliationPlan,
} from '../../lib/admin/pause-expectation-reconciliation.mjs';

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
  const updateBatches = [];
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
    updateStudentPaymentExpectations: async (changes) => {
      updateBatches.push(changes);
    },
    appendEvents: async (events) => {
      eventBatches.push(events);
    },
  });

  assert.equal(result.checkedCount, 2);
  assert.equal(result.changeCount, 1);
  assert.equal(result.reconciledAt, '2026-07-14T12:00:00.000Z');
  assert.deepEqual(updateBatches, [[{
    mmsId: 'sdt_sync',
    nextPaymentExpectation: 'stripe_paused_expected',
  }]]);
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
      updateStudentPaymentExpectations: async () => {},
    }),
    /requires explicit write adapters/i,
  );
});

test('explicit reconciliation batches every student into one update and two audit appends', async () => {
  const updateBatches = [];
  const eventBatches = [];

  const result = await applyPauseExpectationReconciliation([
    eligiblePausedStudent({ mmsId: 'sdt_first', fullName: 'First Student' }),
    eligiblePausedStudent({ mmsId: 'sdt_second', fullName: 'Second Student' }),
  ], {
    actorEmail: 'admin@example.com',
    currentDate: '2026-07-14T12:00:00.000Z',
    updateStudentPaymentExpectations: async (changes) => updateBatches.push(changes),
    appendEvents: async (rows) => eventBatches.push(rows),
  });

  assert.equal(result.changeCount, 2);
  assert.equal(updateBatches.length, 1);
  assert.equal(updateBatches[0].length, 2);
  assert.equal(eventBatches.length, 2);
  assert.deepEqual(eventBatches.map((events) => events.map((event) => event.eventType)), [
    [
      'payment_expectation_reconciliation_attempted',
      'payment_expectation_reconciliation_attempted',
    ],
    [
      'payment_expectation_reconciled',
      'payment_expectation_reconciled',
    ],
  ]);
});

test('explicit reconciliation reports an unknown batch outcome if the Students write fails', async () => {
  const events = [];

  await assert.rejects(
    applyPauseExpectationReconciliation([
      eligiblePausedStudent({ mmsId: 'sdt_first', fullName: 'First Student' }),
      eligiblePausedStudent({ mmsId: 'sdt_second', fullName: 'Second Student' }),
    ], {
      actorEmail: 'admin@example.com',
      currentDate: '2026-07-14T12:00:00.000Z',
      updateStudentPaymentExpectations: async () => { throw new Error('Sheets update failed'); },
      appendEvents: async (rows) => events.push(...rows),
    }),
    (error) => {
      assert.equal(error.partialResult.changeCount, 0);
      assert.deepEqual(error.partialResult.synced, []);
      assert.deepEqual(error.partialResult.failed, {
        mmsIds: ['sdt_first', 'sdt_second'],
        stage: 'student_batch_write',
        outcome: 'unknown',
      });
      return true;
    },
  );

  assert.deepEqual(events.map((event) => [event.entityId, event.eventType]), [
    ['sdt_first', 'payment_expectation_reconciliation_attempted'],
    ['sdt_second', 'payment_expectation_reconciliation_attempted'],
  ]);
});

test('explicit reconciliation never writes when the attempt audit cannot be stored', async () => {
  let updateCalled = false;
  await assert.rejects(
    applyPauseExpectationReconciliation([eligiblePausedStudent()], {
      currentDate: '2026-07-14T12:00:00.000Z',
      updateStudentPaymentExpectations: async () => { updateCalled = true; },
      appendEvents: async () => { throw new Error('Event Log unavailable'); },
    }),
    (error) => error.partialResult.failed.stage === 'attempt_log',
  );
  assert.equal(updateCalled, false);
});

test('explicit reconciliation marks every applied change when the completion audit batch fails', async () => {
  let appendCount = 0;
  await assert.rejects(
    applyPauseExpectationReconciliation([
      eligiblePausedStudent({ mmsId: 'sdt_first', fullName: 'First Student' }),
      eligiblePausedStudent({ mmsId: 'sdt_second', fullName: 'Second Student' }),
    ], {
      currentDate: '2026-07-14T12:00:00.000Z',
      updateStudentPaymentExpectations: async () => {},
      appendEvents: async () => {
        appendCount += 1;
        if (appendCount === 2) throw new Error('Completion log unavailable');
      },
    }),
    (error) => {
      assert.equal(error.partialResult.changeCount, 2);
      assert.equal(error.partialResult.failed.stage, 'completion_log');
      assert.equal(error.partialResult.failed.outcome, 'changes_applied_audit_unknown');
      assert.equal(error.partialResult.synced.every((entry) => entry.completionLogMissing), true);
      return true;
    },
  );
});

test('reconciliation plan collapses duplicate Students records for the same MMS ID', () => {
  const plan = buildPauseExpectationReconciliationPlan([
    eligiblePausedStudent(),
    eligiblePausedStudent(),
  ], {
    currentDate: '2026-07-14T12:00:00.000Z',
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].sourceRecordCount, 2);
});
