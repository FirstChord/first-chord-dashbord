// The pause path, composed.
//
// Five modules run this chain in production:
//   Pause_History rows
//     -> buildPauseSummary            (pause-helpers)
//     -> derivePauseCoverageContext   (pause-helpers)
//     -> buildPauseExpectationAutoSyncPlan     (pause-auto-sync-helpers)
//     -> applyPauseExpectationReconciliation   (pause-expectation-reconciliation)
//     -> executePauseExpectationReconciliation (pause-expectation-route-contract)
//
// Each has its own test file, and each of those hand-writes the shape it
// receives from the one above. That is what this test exists for: with fixtures
// on both sides of every seam, a renamed field mid-chain leaves all five files
// green while production stops syncing pauses entirely. Nothing here is
// hand-shaped between modules — only the two write adapters are stubbed, at the
// real boundary where the workflow calls Sheets.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPauseSummary, derivePauseCoverageContext } from '../../lib/admin/pause-helpers.mjs';
import { buildPauseExpectationAutoSyncPlan } from '../../lib/admin/pause-auto-sync-helpers.mjs';
import {
  applyPauseExpectationReconciliation,
  buildPauseExpectationReconciliationPlan,
} from '../../lib/admin/pause-expectation-reconciliation.mjs';
import { executePauseExpectationReconciliation } from '../../lib/admin/pause-expectation-route-contract.mjs';

const CURRENT_DATE = '2026-07-14';

// Raw Pause_History rows, in the sheet's own header wording rather than the
// normalised camelCase — the format contract the tab actually has.
const PAUSE_ROWS = [
  {
    'Student Name': 'Ada Lovelace',
    Email: 'ada@example.com',
    Tutor: 'Kim',
    'Stripe Subscription ID': 'sub_ada_123',
    'Pause Start Date': '2026-07-07',
    'Pause End Date': '2026-07-21',
    'Stripe Status': 'paused',
  },
  {
    // Name-only match, no subscription id: deliberately not trustworthy enough
    // to move money-adjacent state automatically.
    'Student Name': 'Bo Peep',
    Email: 'bo@example.com',
    Tutor: 'Kim',
    'Pause Start Date': '2026-07-07',
    'Pause End Date': '2026-07-21',
  },
];

const SCHEDULE_CONTEXT = {
  status: 'found',
  confidence: 'high',
  usualWeekday: 'Tuesday',
  usualTime: '18:00',
};

// Rebuilds a student the way loadStudentContextCollection does: the pause
// fields are derived here, not written by hand.
function buildStudent({ mmsId, fullName, email, stripeSubscriptionId, paymentExpectation }) {
  const pauseSummary = buildPauseSummary({
    studentEmail: email,
    studentName: fullName,
    stripeSubscriptionId,
    pauseRows: PAUSE_ROWS,
    currentDate: CURRENT_DATE,
  });
  const pauseCoverageContext = derivePauseCoverageContext({
    pauseSummary,
    scheduleContext: SCHEDULE_CONTEXT,
    currentDate: CURRENT_DATE,
  });

  return {
    mmsId,
    fullName,
    email,
    paymentMode: 'stripe',
    paymentExpectation,
    stripeSubscriptionId,
    pauseSummary,
    pauseCoverageContext,
  };
}

function buildCohort() {
  return [
    buildStudent({
      mmsId: 'sdt_ada',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      stripeSubscriptionId: 'sub_ada_123',
      paymentExpectation: 'stripe_active_expected',
    }),
    buildStudent({
      mmsId: 'sdt_bo',
      fullName: 'Bo Peep',
      email: 'bo@example.com',
      stripeSubscriptionId: '',
      paymentExpectation: 'stripe_active_expected',
    }),
  ];
}

function recordingAdapters({ failOn = '' } = {}) {
  const events = [];
  const writes = [];
  const order = [];
  return {
    events,
    writes,
    order,
    appendEvents: async (rows) => {
      order.push('appendEvents');
      if (failOn === 'appendEvents') throw new Error('Event_Log append failed');
      events.push(...rows);
    },
    updateStudentPaymentExpectations: async (changes) => {
      order.push('updateStudents');
      if (failOn === 'updateStudents') throw new Error('Students batch write failed');
      writes.push(...changes);
    },
  };
}

// --- the seams themselves -----------------------------------------------

test('a derived pause summary carries the exact fields the next module branches on', () => {
  // The named drift guard. buildPauseExpectationAutoSyncPlan reads matchedBy
  // and matchConfidence off this object; the auto-sync test file supplies them
  // as literals. If these strings ever change, this fails here rather than in
  // production two weeks later.
  const [ada] = buildCohort();

  assert.equal(ada.pauseSummary.hasPauseHistory, true);
  assert.equal(ada.pauseSummary.currentlyPaused, true);
  assert.equal(ada.pauseSummary.matchedBy, 'subscription_id');
  assert.equal(ada.pauseSummary.matchConfidence, 'high');
  assert.equal(ada.pauseCoverageContext.confidence, 'high');
  assert.ok(
    ada.pauseCoverageContext.coveredLessonCount > 0,
    'the derived coverage must actually cover a usual lesson, or the plan below is vacuous',
  );
});

test('a raw Pause_History row reaches a Sheets write payload without hand-shaping', async () => {
  const students = buildCohort();
  const adapters = recordingAdapters();

  const result = await applyPauseExpectationReconciliation(students, {
    actorEmail: 'admin@firstchord.co.uk',
    currentDate: CURRENT_DATE,
    updateStudentPaymentExpectations: adapters.updateStudentPaymentExpectations,
    appendEvents: adapters.appendEvents,
  });

  assert.equal(result.changeCount, 1, 'exactly the subscription-id-matched student changes');
  assert.deepEqual(adapters.writes, [
    { mmsId: 'sdt_ada', nextPaymentExpectation: 'stripe_paused_expected' },
  ]);
  assert.equal(
    adapters.writes.some((change) => change.mmsId === 'sdt_bo'),
    false,
    'a name-only pause match must never move payment expectation automatically',
  );
});

test('the attempt is logged before the student rows are written', async () => {
  // Write-ahead audit: if the Students batch write dies mid-flight, the attempt
  // event is the only record that anything was tried. Reversing these two calls
  // would leave a silent partial write.
  const students = buildCohort();
  const adapters = recordingAdapters();

  await applyPauseExpectationReconciliation(students, {
    actorEmail: 'admin@firstchord.co.uk',
    currentDate: CURRENT_DATE,
    updateStudentPaymentExpectations: adapters.updateStudentPaymentExpectations,
    appendEvents: adapters.appendEvents,
  });

  assert.equal(adapters.order[0], 'appendEvents');
  assert.equal(adapters.order[1], 'updateStudents');
  assert.ok(adapters.order.lastIndexOf('appendEvents') > 1, 'a completion event follows the write');
});

test('a failed student write reports the affected ids as unknown, not as applied', async () => {
  const students = buildCohort();
  const adapters = recordingAdapters({ failOn: 'updateStudents' });

  const error = await applyPauseExpectationReconciliation(students, {
    actorEmail: 'admin@firstchord.co.uk',
    currentDate: CURRENT_DATE,
    updateStudentPaymentExpectations: adapters.updateStudentPaymentExpectations,
    appendEvents: adapters.appendEvents,
  }).then(() => null, (thrown) => thrown);

  assert.ok(error, 'the write failure must propagate');
  assert.equal(error.partialResult.changeCount, 0);
  assert.equal(error.partialResult.failed.stage, 'student_batch_write');
  assert.equal(error.partialResult.failed.outcome, 'unknown');
  assert.deepEqual(error.partialResult.failed.mmsIds, ['sdt_ada']);
});

test('the whole chain runs behind the route contract, and stops at an unconfirmed request', async () => {
  // Top to bottom: the HTTP-shaped boundary, the workflow, and the derived
  // student data underneath it.
  const adapters = recordingAdapters();
  const reconcile = async ({ actorEmail }) => applyPauseExpectationReconciliation(buildCohort(), {
    actorEmail,
    currentDate: CURRENT_DATE,
    updateStudentPaymentExpectations: adapters.updateStudentPaymentExpectations,
    appendEvents: adapters.appendEvents,
  });
  const session = { user: { isAdmin: true, email: 'admin@firstchord.co.uk' } };

  const unconfirmed = await executePauseExpectationReconciliation({
    session,
    payload: { confirm: 'yes' },
    reconcile,
  });
  assert.equal(unconfirmed.status, 400);
  assert.deepEqual(adapters.writes, [], 'nothing may be written without literal confirmation');

  const confirmed = await executePauseExpectationReconciliation({
    session,
    payload: { confirm: true },
    reconcile,
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.changeCount, 1);
  assert.deepEqual(adapters.writes, [
    { mmsId: 'sdt_ada', nextPaymentExpectation: 'stripe_paused_expected' },
  ]);

  // The signed-in admin, not a placeholder, is what lands in the audit trail.
  assert.ok(adapters.events.length > 0);
  const serialised = JSON.stringify(adapters.events);
  assert.match(serialised, /admin@firstchord\.co\.uk/);
});

test('a pause that has ended reverts the expectation back through the same chain', async () => {
  // The other direction, derived the same way — a pause window in the past
  // against a student still marked paused.
  const endedPauseRows = [{
    'Student Name': 'Ada Lovelace',
    Email: 'ada@example.com',
    'Stripe Subscription ID': 'sub_ada_123',
    'Pause Start Date': '2026-05-05',
    'Pause End Date': '2026-05-26',
  }];
  const pauseSummary = buildPauseSummary({
    studentEmail: 'ada@example.com',
    studentName: 'Ada Lovelace',
    stripeSubscriptionId: 'sub_ada_123',
    pauseRows: endedPauseRows,
    currentDate: CURRENT_DATE,
  });
  const student = {
    mmsId: 'sdt_ada',
    fullName: 'Ada Lovelace',
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_paused_expected',
    pauseSummary,
    pauseCoverageContext: derivePauseCoverageContext({
      pauseSummary,
      scheduleContext: SCHEDULE_CONTEXT,
      currentDate: CURRENT_DATE,
    }),
  };

  assert.equal(pauseSummary.currentlyPaused, false, 'the window has passed');

  const plan = buildPauseExpectationReconciliationPlan([student], { currentDate: CURRENT_DATE });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].nextPaymentExpectation, 'stripe_active_expected');
});

test('the same student derived twice from duplicate rows collapses to one change', () => {
  // buildPauseExpectationReconciliationPlan dedupes by mmsId and throws on
  // conflict. Feeding it the real derived shape twice proves the dedupe key
  // still matches what the derivation emits.
  const [ada] = buildCohort();
  const plan = buildPauseExpectationReconciliationPlan([ada, { ...ada }], { currentDate: CURRENT_DATE });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].sourceRecordCount, 2);
});

test('the auto-sync plan and the reconciliation plan agree on what changes', () => {
  // These two are one call apart in production but tested in separate files
  // with separate fixtures. If they ever disagree, the preview an admin
  // confirms would not match what the write actually does.
  const students = buildCohort();
  const autoSync = buildPauseExpectationAutoSyncPlan(students, { currentDate: CURRENT_DATE });
  const reconciliation = buildPauseExpectationReconciliationPlan(students, { currentDate: CURRENT_DATE });

  assert.deepEqual(
    autoSync.map((entry) => [entry.mmsId, entry.nextPaymentExpectation]).sort(),
    reconciliation.map((entry) => [entry.mmsId, entry.nextPaymentExpectation]).sort(),
  );
});
