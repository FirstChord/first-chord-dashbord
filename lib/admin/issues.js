import { getRegistryEntries } from '@/lib/admin/registry';
import {
  appendEventLogRows,
  getIssueQueueRows,
  getPauseHistoryRows,
  getPracticeNoteLogRows,
  getReviewFlagsRows,
  getScheduleContextRows,
  getStudentsSheetRows,
  getTutorPayRows,
  updateStudentSheetRow,
  getWaitingListStateRows,
  upsertIssueQueueRows,
} from '@/lib/admin/sheets';
import { buildFlagsFreshnessSummary } from './health-helpers.mjs';
import { buildDuplicateMmsIdGroups, buildIdentityMismatchHint, buildIssueRecord, buildPaymentIssueRecord } from './issues-helpers.mjs';
import { buildPauseSummary, derivePauseCoverageContext } from './pause-helpers.mjs';
import { deriveStudentLifecycleStatus } from './lifecycle-helpers.mjs';
import { derivePaymentValueContext } from './payment-value-helpers.mjs';
import { enrichScheduleContextsWithSharedSlots } from './schedule-context-helpers.mjs';
import { buildDisplayIssues, mergeIssuesWithQueueState, prepareIssue } from './issue-queue.js';
import { buildPauseExpectationAutoSyncPlan, derivePauseExpectationDecision } from './pause-auto-sync-helpers.mjs';
import { buildPauseExpectationAutoSyncEvent } from './payment-audit-helpers.mjs';
import { derivePaymentExpectation, derivePaymentMode } from './payments-helpers.mjs';
import { getLiveStripeSnapshot } from './stripe';
import { buildTestStudentIdSet, isTestStudentRecord } from './test-student-helpers.mjs';
import { buildPracticeDeliveryIssues } from './practice-delivery-issues.mjs';
import { parseTutorPay } from './cost-helpers.mjs';
import { buildFinanceCoverage } from './finance-coverage.mjs';
import { buildFinanceCoverageIssues } from './finance-coverage-issues.mjs';

function pickFirst(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (`${value || ''}`.trim() !== '') {
      return `${value}`.trim();
    }
  }
  return '';
}

function normaliseSheetStudent(row) {
  const firstName = pickFirst(row, ['Student forename']);
  const lastName = pickFirst(row, ['Student Surname']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const paymentMode = derivePaymentMode({
    explicitMode: pickFirst(row, ['payment_mode', 'Payment mode', 'Payment Mode']),
    fullName,
  });
  const stripeCustomerId = pickFirst(row, ['stripe_customer_id']);
  const stripeSubscriptionId = pickFirst(row, ['stripe_subscription_id']);

  return {
    mmsId: pickFirst(row, ['mms_id', 'MMS ID', 'MMS Id', 'Student ID']),
    tutor: pickFirst(row, ['Tutor']),
    fullName,
    instrument: pickFirst(row, ['Instrument']),
    lessonLength: pickFirst(row, ['Lesson length', 'Lesson Length']),
    lessonType: pickFirst(row, ['lesson_type', 'Lesson type', 'Lesson Type']),
    billingGroupId: pickFirst(row, ['billing_group_id', 'Billing group ID']),
    groupPartnerMmsId: pickFirst(row, ['group_partner_mms_id', 'Group partner MMS ID']),
    email: pickFirst(row, ['Email']),
    paymentMode,
    paymentExpectation: derivePaymentExpectation({
      explicitExpectation: pickFirst(row, ['payment_expectation', 'Payment expectation', 'Payment Expectation']),
      paymentMode,
      stripeCustomerId,
      stripeSubscriptionId,
    }),
    stripeCustomerId,
    stripeSubscriptionId,
    isTestStudent: isTestStudentRecord({ raw: row }),
  };
}

function buildLiveStripeDetail(snapshot) {
  return [
    `subscription_status=${snapshot.subscriptionStatus || '—'}`,
    `pause_state=${snapshot.pauseState || '—'}`,
    `actively_billing=${snapshot.activelyBilling ? 'yes' : 'no'}`,
    `latest_invoice_status=${snapshot.latestInvoiceStatus || '—'}`,
    `latest_invoice_amount_remaining=${snapshot.latestInvoiceAmountRemaining ?? '—'}`,
    `latest_invoice_billing_reason=${snapshot.latestInvoiceBillingReason || '—'}`,
    `latest_payment_intent=${snapshot.latestPaymentIntentStatus || '—'}`,
  ].join(', ');
}

function sortIssues(issues = []) {
  return [...issues].sort((a, b) => {
    const statusOrder = { open: 0, acknowledged: 1, ignored: 2, resolved: 3 };
    const severityOrder = { 'Needs action': 0, Warning: 1, Info: 2 };
    const statusDelta = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    if (statusDelta !== 0) return statusDelta;
    const sourcePresentDelta = Number(Boolean(b.sourcePresent)) - Number(Boolean(a.sourcePresent));
    if (sourcePresentDelta !== 0) return sourcePresentDelta;
    const severityDelta = (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
    if (severityDelta !== 0) return severityDelta;
    return (a.studentName || '').localeCompare(b.studentName || '');
  });
}

async function persistQueueSyncResult(syncResult) {
  await upsertIssueQueueRows(syncResult.queueUpserts);
  await appendEventLogRows(syncResult.eventRows);
}

async function autoSyncPauseExpectations(sheetStudents = []) {
  const syncPlan = buildPauseExpectationAutoSyncPlan(sheetStudents);
  if (!syncPlan.length) {
    return {
      students: sheetStudents,
      synced: [],
    };
  }

  const now = new Date().toISOString();
  const studentByMmsId = new Map(sheetStudents.map((student) => [student.mmsId, student]));
  const synced = [];
  const eventRows = [];

  for (const sync of syncPlan) {
    const student = studentByMmsId.get(sync.mmsId);
    if (!student) continue;

    await updateStudentSheetRow(sync.mmsId, {
      payment_expectation: sync.nextPaymentExpectation,
    });

    const nextStudent = {
      ...student,
      paymentExpectation: sync.nextPaymentExpectation,
    };
    studentByMmsId.set(sync.mmsId, nextStudent);
    synced.push(sync);
    eventRows.push(buildPauseExpectationAutoSyncEvent({
      student: nextStudent,
      previousValue: sync.previousPaymentExpectation,
      nextValue: sync.nextPaymentExpectation,
      occurredAt: now,
      reason: sync.reason,
    }));
  }

  if (eventRows.length) {
    await appendEventLogRows(eventRows);
  }

  return {
    students: sheetStudents.map((student) => studentByMmsId.get(student.mmsId) || student),
    synced,
  };
}

export function buildPaymentIssues(sheetStudents = [], registryByMmsId = new Map()) {
  return sheetStudents
    .filter((student) => student.mmsId)
    .filter((student) => !isTestStudentRecord({
      ...student,
      registry: registryByMmsId.get(student.mmsId) || null,
      registryEntry: registryByMmsId.get(student.mmsId) || null,
    }))
    .filter((student) => student.paymentMode === 'stripe')
    .flatMap((student) => {
      const studentWithRegistry = {
        ...student,
        registryEntry: registryByMmsId.get(student.mmsId) || null,
        registryTutor: (registryByMmsId.get(student.mmsId) || {}).tutor || '',
      };
      const lifecycle = deriveStudentLifecycleStatus({
        ...studentWithRegistry,
        registry: studentWithRegistry.registryEntry,
        hasRegistryEntry: Boolean(studentWithRegistry.registryEntry),
      });
      const studentWithContext = { ...studentWithRegistry, ...lifecycle };

      if (student.paymentExpectation === 'setup_pending') {
        if (student.stripeCustomerId && student.stripeSubscriptionId) {
          return [buildPaymentIssueRecord({ type: 'SETUP PENDING STRIPE LINKED', student: studentWithContext })];
        }

        return [];
      }

      if (!student.stripeCustomerId && !student.stripeSubscriptionId) {
        return [buildPaymentIssueRecord({ type: 'STRIPE SETUP INCOMPLETE', student: studentWithContext })];
      }

      if (!student.stripeCustomerId && student.stripeSubscriptionId) {
        return [buildPaymentIssueRecord({ type: 'STRIPE CUSTOMER MISSING', student: studentWithContext })];
      }

      if (student.stripeCustomerId && !student.stripeSubscriptionId) {
        return [buildPaymentIssueRecord({ type: 'STRIPE SUBSCRIPTION MISSING', student: studentWithContext })];
      }

      return [];
    });
}

export function buildPauseIssues(sheetStudents = [], registryByMmsId = new Map()) {
  return sheetStudents
    .filter((student) => student.mmsId)
    .filter((student) => !isTestStudentRecord({
      ...student,
      registry: registryByMmsId.get(student.mmsId) || null,
      registryEntry: registryByMmsId.get(student.mmsId) || null,
    }))
    .filter((student) => student.paymentMode === 'stripe')
    .flatMap((student) => {
      const studentWithRegistry = {
        ...student,
        registryEntry: registryByMmsId.get(student.mmsId) || null,
        registryTutor: (registryByMmsId.get(student.mmsId) || {}).tutor || '',
      };
      const lifecycle = deriveStudentLifecycleStatus({
        ...studentWithRegistry,
        registry: studentWithRegistry.registryEntry,
        hasRegistryEntry: Boolean(studentWithRegistry.registryEntry),
      });
      const studentWithContext = { ...studentWithRegistry, ...lifecycle };
      const pauseSummary = student.pauseSummary || null;
      const pauseDecision = student.pauseExpectationDecision || derivePauseExpectationDecision(student);
      if (!pauseSummary?.hasPauseHistory) {
        return [];
      }

      if (pauseSummary.matchConfidence === 'low') {
        return [];
      }

      if (pauseSummary.currentlyPaused && student.paymentExpectation !== 'stripe_paused_expected') {
        if (!pauseDecision.shouldCreateIssue && pauseDecision.expectedPaymentExpectation === 'stripe_paused_expected') {
          return [];
        }
        return [buildPaymentIssueRecord({ type: 'PAUSE EXPECTATION MISMATCH', student: studentWithContext })];
      }

      if (pauseSummary.upcomingPause) {
        return [];
      }

      if (!pauseSummary.currentlyPaused && student.paymentExpectation === 'stripe_paused_expected') {
        if (pauseDecision.allowsActiveBillingBeforeNextLesson || !pauseDecision.shouldCreateIssue) {
          return [];
        }
        return [buildPaymentIssueRecord({ type: 'PAUSE EXPECTATION STALE', student: studentWithContext })];
      }

      return [];
    });
}

export async function scanLiveStripeIssues() {
  const [rawSheetRows, registryEntries, pauseHistoryRows, waitingRows, scheduleRows] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntries(),
    getPauseHistoryRows(),
    getWaitingListStateRows(),
    getScheduleContextRows(),
  ]);

  const testStudentIds = buildTestStudentIdSet(rawSheetRows.map(normaliseSheetStudent), registryEntries);
  const operationalRegistryEntries = registryEntries.filter((entry) => !testStudentIds.has(entry.mmsId));
  const registryByMmsId = new Map(operationalRegistryEntries.map((entry) => [entry.mmsId, entry]));
  const waitingByMmsId = new Map(waitingRows.map((row) => [row.mmsId, row]));
  const scheduleByMmsId = enrichScheduleContextsWithSharedSlots(scheduleRows);
  const sheetStudents = rawSheetRows
    .map(normaliseSheetStudent)
    .filter((student) => student.mmsId)
    .filter((student) => !testStudentIds.has(student.mmsId))
    .map((student) => ({
      ...student,
      pauseSummary: buildPauseSummary({
        studentEmail: student.email,
        studentName: student.fullName,
        stripeSubscriptionId: student.stripeSubscriptionId,
        pauseRows: pauseHistoryRows,
      }),
      waitingState: waitingByMmsId.get(student.mmsId) || null,
      scheduleContext: scheduleByMmsId.get(student.mmsId) || null,
    }))
    .map((student) => ({
      ...student,
      waitingStatus: student.waitingState?.status || '',
      ...deriveStudentLifecycleStatus({
        ...student,
        registry: registryByMmsId.get(student.mmsId) || null,
        hasRegistryEntry: registryByMmsId.has(student.mmsId),
      }),
      paymentValueContext: derivePaymentValueContext(student),
    }));
  let sheetStudentsWithPauseCoverage = sheetStudents.map((student) => ({
    ...student,
    pauseCoverageContext: derivePauseCoverageContext({
      pauseSummary: student.pauseSummary,
      scheduleContext: student.scheduleContext,
    }),
  })).map((student) => ({
    ...student,
    pauseExpectationDecision: derivePauseExpectationDecision(student),
  }));
  const pauseAutoSync = await autoSyncPauseExpectations(sheetStudentsWithPauseCoverage);
  sheetStudentsWithPauseCoverage = pauseAutoSync.students.map((student) => ({
    ...student,
    pauseExpectationDecision: derivePauseExpectationDecision(student),
  }));

  const stripeStudents = sheetStudentsWithPauseCoverage.filter(
    (student) => student.paymentMode === 'stripe' && student.paymentExpectation !== 'setup_pending',
  );
  const scannedAt = new Date().toISOString();
  const issues = [];

  for (const student of stripeStudents) {
    const studentWithRegistry = {
      ...student,
      registryEntry: registryByMmsId.get(student.mmsId) || null,
      registryTutor: (registryByMmsId.get(student.mmsId) || {}).tutor || '',
    };
    const lifecycle = deriveStudentLifecycleStatus({
      ...studentWithRegistry,
      registry: studentWithRegistry.registryEntry,
      hasRegistryEntry: Boolean(studentWithRegistry.registryEntry),
    });
    const studentWithContext = { ...studentWithRegistry, ...lifecycle };

    const { snapshot, issues: liveIssues } = await getLiveStripeSnapshot(studentWithContext);

    for (const type of liveIssues) {
      issues.push(
        buildPaymentIssueRecord({
          type,
          student: studentWithContext,
          detail: buildLiveStripeDetail(snapshot),
        }),
      );
    }
  }

  const queueRows = (await getIssueQueueRows()).filter((row) => !testStudentIds.has(row.mmsId));
  const syncResult = mergeIssuesWithQueueState({
    currentIssues: issues.map(prepareIssue),
    queueRows,
    now: scannedAt,
    managedSources: ['stripe_live'],
  });

  await persistQueueSyncResult(syncResult);

  const displayIssues = buildDisplayIssues({
    currentIssues: syncResult.mergedCurrentIssues,
    queueRows: syncResult.queueRows.filter((row) => row.source === 'stripe_live'),
    sheetByMmsId: new Map(sheetStudentsWithPauseCoverage.map((student) => [student.mmsId, student])),
    registryByMmsId,
  });

  return {
    issues: sortIssues(displayIssues),
    scannedCount: stripeStudents.length,
    scannedAt,
  };
}

export async function getAdminIssues() {
  const [flagRows, rawSheetRows, registryEntries, queueRows, pauseHistoryRows, waitingRows, scheduleRows, practiceNoteRows, tutorPayRows] = await Promise.all([
    getReviewFlagsRows(),
    getStudentsSheetRows(),
    getRegistryEntries(),
    getIssueQueueRows(),
    getPauseHistoryRows(),
    getWaitingListStateRows(),
    getScheduleContextRows(),
    getPracticeNoteLogRows(),
    getTutorPayRows(),
  ]);

  const testStudentIds = buildTestStudentIdSet(rawSheetRows.map(normaliseSheetStudent), registryEntries);
  const operationalRegistryEntries = registryEntries.filter((entry) => !testStudentIds.has(entry.mmsId));
  const registryByMmsId = new Map(operationalRegistryEntries.map((entry) => [entry.mmsId, entry]));
  const waitingByMmsId = new Map(waitingRows.map((row) => [row.mmsId, row]));
  const scheduleByMmsId = enrichScheduleContextsWithSharedSlots(scheduleRows);
  const sheetStudents = rawSheetRows
    .map(normaliseSheetStudent)
    .filter((student) => student.mmsId)
    .filter((student) => !testStudentIds.has(student.mmsId))
    .map((student) => ({
      ...student,
      pauseSummary: buildPauseSummary({
        studentEmail: student.email,
        studentName: student.fullName,
        stripeSubscriptionId: student.stripeSubscriptionId,
        pauseRows: pauseHistoryRows,
      }),
      waitingState: waitingByMmsId.get(student.mmsId) || null,
      scheduleContext: scheduleByMmsId.get(student.mmsId) || null,
    }))
    .map((student) => ({
      ...student,
      waitingStatus: student.waitingState?.status || '',
      ...deriveStudentLifecycleStatus({
        ...student,
        registry: registryByMmsId.get(student.mmsId) || null,
        hasRegistryEntry: registryByMmsId.has(student.mmsId),
      }),
      paymentValueContext: derivePaymentValueContext(student),
    }));
  let sheetStudentsWithPauseCoverage = sheetStudents.map((student) => ({
    ...student,
    pauseCoverageContext: derivePauseCoverageContext({
      pauseSummary: student.pauseSummary,
      scheduleContext: student.scheduleContext,
    }),
  })).map((student) => ({
    ...student,
    pauseExpectationDecision: derivePauseExpectationDecision(student),
  }));
  const pauseAutoSync = await autoSyncPauseExpectations(sheetStudentsWithPauseCoverage);
  sheetStudentsWithPauseCoverage = pauseAutoSync.students.map((student) => ({
    ...student,
    pauseExpectationDecision: derivePauseExpectationDecision(student),
  }));
  const sheetByMmsId = new Map(sheetStudentsWithPauseCoverage.map((student) => [student.mmsId, student]));

  // Same coverage build as the finance page: sheet students already carry the
  // enriched scheduleContext + lifecycle fields buildFinanceCoverage needs.
  const financeCoverage = buildFinanceCoverage(sheetStudentsWithPauseCoverage, {
    tutorPay: parseTutorPay(tutorPayRows),
  });

  const currentIssues = [
    ...flagRows
      .filter((flag) => !testStudentIds.has(flag.mms_id || ''))
      .map((flag) =>
      buildIssueRecord({
        flag,
        sheetStudent: sheetByMmsId.get(flag.mms_id || '') || null,
        registryEntry: registryByMmsId.get(flag.mms_id || '') || null,
        identityMismatchHint: buildIdentityMismatchHint({
          issueType: flag.flag_type || flag.category || '',
          mmsId: flag.mms_id || '',
          studentName: flag.student_name || '',
          sheetStudents,
          registryEntries: operationalRegistryEntries,
        }),
      }),
    )
      .filter((issue) => issue.active),
    ...buildPaymentIssues(sheetStudentsWithPauseCoverage, registryByMmsId),
    ...buildPauseIssues(sheetStudentsWithPauseCoverage, registryByMmsId),
    ...buildPracticeDeliveryIssues(practiceNoteRows, {
      testStudentIds,
      sheetByMmsId,
      registryByMmsId,
    }),
    ...buildFinanceCoverageIssues(financeCoverage, { testStudentIds }),
  ];
  const now = new Date().toISOString();
  const syncResult = mergeIssuesWithQueueState({
    currentIssues: currentIssues.map(prepareIssue),
    queueRows: queueRows.filter((row) => !testStudentIds.has(row.mmsId)),
    now,
    managedSources: ['review_flags', 'payment_static', 'practice_delivery', 'finance_coverage'],
  });

  await persistQueueSyncResult(syncResult);

  const issues = sortIssues(buildDisplayIssues({
    currentIssues: syncResult.mergedCurrentIssues,
    queueRows: syncResult.queueRows,
    sheetByMmsId,
    registryByMmsId,
  }));

  return {
    issues,
    freshness: buildFlagsFreshnessSummary(flagRows),
    duplicateMmsIds: buildDuplicateMmsIdGroups(sheetStudents),
  };
}
