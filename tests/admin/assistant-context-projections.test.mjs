import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRedactedIssueContext,
  buildRedactedStudentContext,
} from '../../lib/admin/assistant-context-projections.mjs';

const GENERATED_AT = '2026-07-14T12:00:00.000Z';

function assertExactKeys(value, keys) {
  assert.deepEqual(Object.keys(value), keys);
}

function assertSentinelsAbsent(value, sentinels) {
  const serialised = JSON.stringify(value).toLowerCase();
  for (const sentinel of sentinels) {
    assert.equal(serialised.includes(sentinel.toLowerCase()), false, `Leaked sentinel: ${sentinel}`);
  }
}

function assertOutputBounds(value) {
  if (typeof value === 'string') {
    assert.ok(value.length <= 500, `String exceeded cap: ${value.length}`);
    return;
  }
  if (Array.isArray(value)) {
    assert.ok(value.length <= 12, `Array exceeded cap: ${value.length}`);
    value.forEach(assertOutputBounds);
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(assertOutputBounds);
  }
}

function sensitiveStudent() {
  return {
    mmsId: 'sdt_PRIVATESTUDENT',
    firstName: 'PrivateFirst',
    lastName: 'PrivateLast',
    fullName: 'PrivateFirst PrivateLast',
    tutor: 'PrivateTutor',
    email: 'private.student@example.com',
    contactNumber: '07123 456789',
    parentFirstName: 'PrivateParent',
    stripeCustomerId: 'cus_PRIVATECUSTOMER',
    stripeSubscriptionId: 'sub_PRIVATESUBSCRIPTION',
    fcStudentId: 'fc_PRIVATEPORTAL',
    billingGroupId: 'billing_PRIVATEGROUP',
    groupPartnerMmsId: 'sdt_PRIVATEPARTNER',
    instrument: 'Piano',
    lessonLength: '30',
    lessonType: 'one_to_one',
    lessonFrequency: 'weekly',
    paymentMode: 'stripe',
    paymentExpectation: 'stripe_active_expected',
    lifecycleStatus: 'active',
    lifecycleLabel: 'Active',
    lifecycleConfidence: 'high',
    lifecycleReasons: ['Payment expectation is active.', 'PrivateFirst is linked to cus_PRIVATECUSTOMER.'],
    lifecycleWarnings: [],
    waitingState: {
      status: 'contacted',
      parentName: 'WaitingPrivateParent',
      parentEmail: 'waiting.private@example.com',
      note: 'Call PrivateFirst on 07123 456789',
      updatedAt: '2026-07-13T10:00:00.000Z',
    },
    pauseSummary: {
      hasPauseHistory: true,
      currentlyPaused: false,
      upcomingPause: true,
      matchConfidence: 'high',
      matchedBy: 'subscription_id',
      latestPause: {
        studentName: 'PausePrivateName',
        email: 'pause.private@example.com',
        tutor: 'PausePrivateTutor',
        subscriptionId: 'sub_PRIVATEPAUSE',
        startDate: '2026-08-01',
        endDate: '2026-08-07',
        stripeStatus: 'paused',
      },
    },
    pauseCoverageContext: {
      status: 'upcoming_covered_lesson',
      confidence: 'high',
      coveredLessonDates: [{ date: '2026-08-05', label: 'PrivateFirst lesson', weekday: 'Wednesday', time: '16:00' }],
      nextBillableLessonDate: '2026-08-12',
      warnings: [],
    },
    scheduleContext: {
      studentName: 'SchedulePrivateName',
      status: 'found',
      nextLessonAt: '2026-07-20T16:00:00',
      usualWeekday: 'Monday',
      usualTime: '16:00',
      durationMinutes: '30',
      teacherId: 'teacher_PRIVATE',
      teacherName: 'SchedulePrivateTutor',
      seriesId: 'series_PRIVATE',
      sharedStudentCount: 3,
      sharedStudentNames: ['OtherPrivateStudent'],
      sharedStudentMmsIds: ['sdt_PRIVATEOTHER'],
      confidence: 'high',
      checkedAt: '2026-07-14T08:00:00.000Z',
      warnings: ['No sensitive warning.'],
    },
    flags: [{ category: 'TUTOR CONFLICT', detail: 'PrivateFirst conflicts with PrivateTutor.' }],
    registry: {
      firstName: 'RegistryPrivateFirst',
      soundsliceUrl: 'https://example.com/private-course',
      thetaUsername: 'privateTheta',
      fcStudentId: 'fc_PRIVATEREGISTRY',
    },
    raw: { secret: 'RAW_PRIVATE_VALUE' },
    paymentValueContext: { baselineMonthlyValue: 1234 },
    provenance: {
      sources: {
        studentsSheet: { role: 'source_truth', present: true, freshness: 'unknown' },
        studentRegistry: { role: 'source_truth', present: true, freshness: 'not_recorded' },
        waitingState: { role: 'workflow_state', present: true, observedAt: '2026-07-13T10:00:00.000Z' },
        pauseHistory: { role: 'external_history', present: true, matchConfidence: 'high', matchedBy: 'subscription_id' },
        scheduleContext: { role: 'cache', loaded: true, present: true, checkedAt: '2026-07-14T08:00:00.000Z', freshness: 'fresh', confidence: 'high' },
      },
      fields: {
        instrument: { owner: 'transitional_split', selectedSource: 'students_sheet', resolution: 'students_sheet_then_registry' },
        lessonType: { owner: 'students_sheet', selectedSource: 'students_sheet', resolution: 'students_sheet_then_registry' },
        lessonFrequency: { owner: 'students_sheet', selectedSource: 'students_sheet', resolution: 'students_sheet_then_registry' },
        paymentMode: { owner: 'students_sheet', selectedSource: 'students_sheet', resolution: 'explicit' },
        paymentExpectation: { owner: 'students_sheet', selectedSource: 'students_sheet', resolution: 'explicit' },
        fcStudentId: { owner: 'transitional_split', selectedSource: 'students_sheet', resolution: 'students_sheet_then_registry' },
      },
      conflicts: [
        { field: 'firstName', code: 'sheet_registry_mismatch', selectedSource: 'students_sheet', severity: 'review' },
        { field: 'fcStudentId', code: 'sheet_registry_mismatch', selectedSource: 'students_sheet', severity: 'high' },
      ],
    },
  };
}

test('student projection has an exact useful schema and strips direct identifiers and raw records', () => {
  const student = sensitiveStudent();
  const projection = buildRedactedStudentContext(student, { generatedAt: GENERATED_AT });

  assertExactKeys(projection, [
    'schemaVersion', 'kind', 'subject', 'generatedAt', 'profile', 'records', 'lifecycle',
    'payment', 'waiting', 'pause', 'schedule', 'review', 'provenance',
  ]);
  assertExactKeys(projection.profile, ['instrument', 'lessonLengthMinutes', 'lessonType', 'lessonFrequency']);
  assertExactKeys(projection.payment, ['mode', 'expectation', 'customerLinkRecorded', 'subscriptionLinkRecorded']);
  assertExactKeys(projection.schedule, [
    'status', 'nextLessonAt', 'usualWeekday', 'usualTime', 'durationMinutes', 'confidence',
    'checkedAt', 'freshness', 'warnings', 'sharedStudentCount',
  ]);
  assert.equal(projection.profile.instrument, 'Piano');
  assert.equal(projection.payment.customerLinkRecorded, true);
  assert.equal(projection.payment.subscriptionLinkRecorded, true);
  assert.equal(projection.pause.window.stripeStatus, 'paused');
  assert.equal(projection.schedule.sharedStudentCount, 3);
  assert.deepEqual(projection.review.flagCategories, ['TUTOR CONFLICT']);
  assert.deepEqual(projection.review.conflicts.map((conflict) => conflict.area), ['identity', 'portal_identity']);
  assert.deepEqual(Object.keys(projection.provenance.fields), [
    'instrument', 'lessonType', 'lessonFrequency', 'paymentMode', 'paymentExpectation',
  ]);
  assert.equal(projection.provenance.fields.instrument.owner, 'transitional_split');
  assert.equal(projection.provenance.fields.instrument.selectedSource, 'students_sheet');
  assert.equal(projection.provenance.sources.studentsSheet.role, 'source_truth');

  assertSentinelsAbsent(projection, [
    'sdt_PRIVATESTUDENT', 'PrivateFirst', 'PrivateLast', 'PrivateTutor',
    'private.student@example.com', '07123 456789', 'PrivateParent',
    'cus_PRIVATECUSTOMER', 'sub_PRIVATESUBSCRIPTION', 'fc_PRIVATEPORTAL',
    'billing_PRIVATEGROUP', 'sdt_PRIVATEPARTNER', 'WaitingPrivateParent',
    'waiting.private@example.com', 'PausePrivateName', 'pause.private@example.com',
    'PausePrivateTutor', 'sub_PRIVATEPAUSE', 'SchedulePrivateName', 'teacher_PRIVATE',
    'SchedulePrivateTutor', 'series_PRIVATE', 'OtherPrivateStudent', 'sdt_PRIVATEOTHER',
    'https://example.com/private-course', 'privateTheta', 'fc_PRIVATEREGISTRY',
    'RAW_PRIVATE_VALUE', 'PrivateFirst conflicts with PrivateTutor',
  ]);
});

test('student projection is immutable and caps every array and string', () => {
  const student = sensitiveStudent();
  student.lifecycleReasons = Array.from({ length: 30 }, (_, index) => `Reason ${index} ${'x'.repeat(600)}`);
  student.lifecycleWarnings = Array.from({ length: 30 }, (_, index) => `Warning ${index}`);
  student.flags = Array.from({ length: 30 }, (_, index) => ({ category: `FLAG ${index}`, detail: `Private detail ${index}` }));
  student.pauseCoverageContext.coveredLessonDates = Array.from({ length: 30 }, (_, index) => ({
    date: `2026-08-${`${index + 1}`.padStart(2, '0')}`,
    weekday: 'Monday',
    time: '16:00',
  }));
  student.provenance.conflicts = Array.from({ length: 30 }, () => ({
    field: 'instrument', code: 'sheet_registry_mismatch', selectedSource: 'students_sheet', severity: 'review',
  }));
  const before = structuredClone(student);

  const projection = buildRedactedStudentContext(student, { generatedAt: GENERATED_AT });

  assert.deepEqual(student, before);
  assert.equal(projection.lifecycleReasons, undefined);
  assert.equal(projection.lifecycle.reasons.length, 12);
  assert.equal(projection.lifecycle.warnings.length, 12);
  assert.equal(projection.review.flagCategories.length, 12);
  assert.equal(projection.review.conflicts.length, 12);
  assert.equal(projection.pause.coverage.coveredLessonDates.length, 12);
  assertOutputBounds(projection);
});

test('issue projection keeps typed evidence but strips issue, provider, recipient, and cross-student identifiers', () => {
  const studentContext = sensitiveStudent();
  const issue = {
    issueId: 'stripe_live:PAYMENT_FAILED:sdt_PRIVATESTUDENT:sub_PRIVATESUBSCRIPTION',
    contextKey: 'sub_PRIVATESUBSCRIPTION',
    type: 'PAYMENT FAILED',
    source: 'stripe_live',
    severity: 'Needs action',
    systemsAffected: ['Stripe'],
    summary: 'PrivateFirst has a payment problem.',
    recommendedAction: 'Review private.student@example.com in Stripe.',
    detail: 'cus_PRIVATECUSTOMER and sub_PRIVATESUBSCRIPTION failed.',
    studentName: 'PrivateFirst PrivateLast',
    email: 'private.student@example.com',
    stripeCustomerId: 'cus_PRIVATECUSTOMER',
    stripeSubscriptionId: 'sub_PRIVATESUBSCRIPTION',
    hasSheetRow: true,
    hasRegistryEntry: true,
    active: true,
    identityMismatchHint: {
      studentName: 'OtherPrivateStudent', mmsId: 'sdt_PRIVATEOTHER', description: 'Cross-family private detail',
    },
    practiceNote: {
      deliveryKey: 'delivery_PRIVATE',
      noteId: 'note_PRIVATE',
      lessonDate: '2026-07-10',
      recipientName: 'RecipientPrivate',
      recipientEmail: 'recipient.private@example.com',
      emailSendStatus: 'failed',
      emailError: 'Mailbox for recipient.private@example.com failed.',
    },
    financeCoverage: { flags: ['noRevenuePrice'], lessonKind: 'one_to_one', confidence: 'low' },
    stripeSnapshot: {
      id: 'sub_PRIVATESUBSCRIPTION',
      customerId: 'cus_PRIVATECUSTOMER',
      subscriptionStatus: 'past_due',
      pauseState: 'active',
      activelyBilling: true,
      latestInvoiceStatus: 'open',
      latestInvoiceAttemptCount: 2,
      nextPaymentAttemptAt: '2026-07-16T10:00:00.000Z',
      latestDeclineCode: 'insufficient_funds',
      latestPaymentIntentStatus: 'requires_payment_method',
    },
  };
  const queueRow = {
    issueId: issue.issueId,
    contextKey: issue.contextKey,
    source: 'stripe_live',
    status: 'open',
    sourcePresent: 'true',
    lastSeenAt: '2026-07-14T08:00:00.000Z',
    updatedAt: '2026-07-14T08:00:00.000Z',
    studentName: 'PrivateFirst PrivateLast',
    detail: 'Queue private detail',
    resolutionNote: 'Call 07123 456789',
    owner: 'owner.private@example.com',
  };
  const issueBefore = structuredClone(issue);
  const queueBefore = structuredClone(queueRow);

  const projection = buildRedactedIssueContext({
    issue,
    queueRow,
    studentContext,
    detectorEvaluated: true,
    generatedAt: GENERATED_AT,
  });

  assertExactKeys(projection, [
    'schemaVersion', 'kind', 'subject', 'generatedAt', 'issue', 'detector', 'queue',
    'evidence', 'ambiguityCodes', 'student',
  ]);
  assertExactKeys(projection.issue, [
    'type', 'source', 'severity', 'systemsAffected', 'summary', 'recommendedAction', 'actionCode',
  ]);
  assertExactKeys(projection.queue, ['recorded', 'status', 'recordedSourcePresent', 'lastSeenAt', 'updatedAt']);
  assert.equal(projection.issue.actionCode, 'review_payment_state');
  assert.equal(projection.evidence.payment.customerLinkRecorded, true);
  assert.equal(projection.evidence.stripeLive.subscriptionStatus, 'past_due');
  assert.equal(projection.evidence.stripeLive.latestInvoiceStatus, 'open');
  assert.equal(projection.evidence.practiceDelivery.lessonDate, '2026-07-10');
  assert.equal(projection.evidence.practiceDelivery.deliveryStatus, 'failed');
  assert.equal(projection.evidence.identity.possibleIdentityCollision, true);
  assert.deepEqual(issue, issueBefore);
  assert.deepEqual(queueRow, queueBefore);

  assertSentinelsAbsent(projection, [
    issue.issueId, 'sub_PRIVATESUBSCRIPTION', 'cus_PRIVATECUSTOMER', 'sdt_PRIVATESTUDENT',
    'PrivateFirst', 'PrivateLast', 'private.student@example.com', 'OtherPrivateStudent',
    'sdt_PRIVATEOTHER', 'Cross-family private detail', 'delivery_PRIVATE', 'note_PRIVATE',
    'RecipientPrivate', 'recipient.private@example.com', 'Mailbox for recipient.private@example.com failed.',
    'Queue private detail', '07123 456789', 'owner.private@example.com',
  ]);
  assertOutputBounds(projection);
});

test('stripe_live issue evidence is always recorded-only and never claims a detector refresh', () => {
  const projection = buildRedactedIssueContext({
    issue: {
      type: 'PAYMENT FAILED',
      source: 'stripe_live',
      active: true,
      stripeSnapshot: { subscriptionStatus: 'past_due' },
    },
    queueRow: { status: 'open', sourcePresent: 'true' },
    detectorEvaluated: true,
    generatedAt: GENERATED_AT,
  });

  assert.deepEqual(projection.detector, { evaluated: false, currentPresent: null });
  assert.equal(projection.evidence.stripeLive.recordedEvidence, true);
  assert.ok(projection.ambiguityCodes.includes('stripe_live_not_refreshed'));
});

test('issue projection surfaces detector and queue disagreement without changing queue state', () => {
  const queueRow = { source: 'payment_static', status: 'acknowledged', sourcePresent: 'true' };
  const projection = buildRedactedIssueContext({
    issue: { type: 'STRIPE SETUP INCOMPLETE', source: 'payment_static', active: false },
    queueRow,
    detectorEvaluated: true,
    generatedAt: GENERATED_AT,
  });

  assert.deepEqual(projection.detector, { evaluated: true, currentPresent: false });
  assert.equal(projection.queue.recordedSourcePresent, true);
  assert.ok(projection.ambiguityCodes.includes('queue_presence_disagrees_with_detector'));
  assert.deepEqual(queueRow, { source: 'payment_static', status: 'acknowledged', sourcePresent: 'true' });
});

test('a queue-only issue does not become a currently detected issue by default', () => {
  const projection = buildRedactedIssueContext({
    queueRow: {
      source: 'payment_static',
      issueType: 'STRIPE SETUP INCOMPLETE',
      status: 'open',
      sourcePresent: 'true',
    },
    detectorEvaluated: true,
    generatedAt: GENERATED_AT,
  });

  assert.deepEqual(projection.detector, { evaluated: true, currentPresent: false });
  assert.ok(projection.ambiguityCodes.includes('queue_presence_disagrees_with_detector'));
});
