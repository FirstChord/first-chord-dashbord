import { getRegistryEntries } from '@/lib/admin/registry';
import {
  appendEventLogRows,
  getIssueQueueRows,
  getPauseHistoryRows,
  getReviewFlagsRows,
  getStudentsSheetRows,
  upsertIssueQueueRows,
} from '@/lib/admin/sheets';
import { buildFlagsFreshnessSummary } from './health-helpers.mjs';
import { buildIssueRecord, buildPaymentIssueRecord } from './issues-helpers.mjs';
import { buildPauseSummary } from './pause-helpers.mjs';
import { buildDisplayIssues, mergeIssuesWithQueueState, prepareIssue } from './issue-queue.js';
import { derivePaymentExpectation, derivePaymentMode } from './payments-helpers.mjs';
import { getLiveStripeSnapshot } from './stripe';

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

  return {
    mmsId: pickFirst(row, ['mms_id', 'MMS ID', 'MMS Id', 'Student ID']),
    tutor: pickFirst(row, ['Tutor']),
    fullName,
    email: pickFirst(row, ['Email']),
    paymentMode,
    paymentExpectation: derivePaymentExpectation({
      explicitExpectation: pickFirst(row, ['payment_expectation', 'Payment expectation', 'Payment Expectation']),
      paymentMode,
    }),
    stripeCustomerId: pickFirst(row, ['stripe_customer_id']),
    stripeSubscriptionId: pickFirst(row, ['stripe_subscription_id']),
  };
}

function buildLiveStripeDetail(snapshot) {
  return [
    `subscription_status=${snapshot.subscriptionStatus || '—'}`,
    `pause_state=${snapshot.pauseState || '—'}`,
    `actively_billing=${snapshot.activelyBilling ? 'yes' : 'no'}`,
    `latest_invoice_status=${snapshot.latestInvoiceStatus || '—'}`,
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

export function buildPaymentIssues(sheetStudents = [], registryByMmsId = new Map()) {
  return sheetStudents
    .filter((student) => student.mmsId)
    .filter((student) => student.paymentMode === 'stripe')
    .flatMap((student) => {
      const studentWithRegistry = {
        ...student,
        registryEntry: registryByMmsId.get(student.mmsId) || null,
        registryTutor: (registryByMmsId.get(student.mmsId) || {}).tutor || '',
      };

      if (student.paymentExpectation === 'setup_pending') {
        return [buildPaymentIssueRecord({ type: 'PAYMENT SETUP PENDING', student: studentWithRegistry })];
      }

      if (!student.stripeCustomerId && !student.stripeSubscriptionId) {
        return [buildPaymentIssueRecord({ type: 'STRIPE SETUP INCOMPLETE', student: studentWithRegistry })];
      }

      if (!student.stripeCustomerId && student.stripeSubscriptionId) {
        return [buildPaymentIssueRecord({ type: 'STRIPE CUSTOMER MISSING', student: studentWithRegistry })];
      }

      if (student.stripeCustomerId && !student.stripeSubscriptionId) {
        return [buildPaymentIssueRecord({ type: 'STRIPE SUBSCRIPTION MISSING', student: studentWithRegistry })];
      }

      return [];
    });
}

export function buildPauseIssues(sheetStudents = [], registryByMmsId = new Map()) {
  return sheetStudents
    .filter((student) => student.mmsId)
    .filter((student) => student.paymentMode === 'stripe')
    .flatMap((student) => {
      const studentWithRegistry = {
        ...student,
        registryEntry: registryByMmsId.get(student.mmsId) || null,
        registryTutor: (registryByMmsId.get(student.mmsId) || {}).tutor || '',
      };
      const pauseSummary = student.pauseSummary || null;
      if (!pauseSummary?.hasPauseHistory) {
        return [];
      }

      if (pauseSummary.currentlyPaused && student.paymentExpectation !== 'stripe_paused_expected') {
        return [buildPaymentIssueRecord({ type: 'PAUSE EXPECTATION MISMATCH', student: studentWithRegistry })];
      }

      if (pauseSummary.upcomingPause) {
        return [];
      }

      if (!pauseSummary.currentlyPaused && student.paymentExpectation === 'stripe_paused_expected') {
        return [buildPaymentIssueRecord({ type: 'PAUSE EXPECTATION STALE', student: studentWithRegistry })];
      }

      return [];
    });
}

export async function scanLiveStripeIssues() {
  const [rawSheetRows, registryEntries, pauseHistoryRows] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntries(),
    getPauseHistoryRows(),
  ]);

  const sheetStudents = rawSheetRows
    .map(normaliseSheetStudent)
    .filter((student) => student.mmsId)
    .map((student) => ({
      ...student,
      pauseSummary: buildPauseSummary({
        studentEmail: student.email,
        stripeSubscriptionId: student.stripeSubscriptionId,
        pauseRows: pauseHistoryRows,
      }),
    }));
  const registryByMmsId = new Map(registryEntries.map((entry) => [entry.mmsId, entry]));

  const stripeStudents = sheetStudents.filter(
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

    const { snapshot, issues: liveIssues } = await getLiveStripeSnapshot(studentWithRegistry);

    for (const type of liveIssues) {
      issues.push(
        buildPaymentIssueRecord({
          type,
          student: studentWithRegistry,
          detail: buildLiveStripeDetail(snapshot),
        }),
      );
    }
  }

  const queueRows = await getIssueQueueRows();
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
    sheetByMmsId: new Map(sheetStudents.map((student) => [student.mmsId, student])),
    registryByMmsId,
  });

  return {
    issues: sortIssues(displayIssues),
    scannedCount: stripeStudents.length,
    scannedAt,
  };
}

export async function getAdminIssues() {
  const [flagRows, rawSheetRows, registryEntries, queueRows, pauseHistoryRows] = await Promise.all([
    getReviewFlagsRows(),
    getStudentsSheetRows(),
    getRegistryEntries(),
    getIssueQueueRows(),
    getPauseHistoryRows(),
  ]);

  const sheetStudents = rawSheetRows
    .map(normaliseSheetStudent)
    .filter((student) => student.mmsId)
    .map((student) => ({
      ...student,
      pauseSummary: buildPauseSummary({
        studentEmail: student.email,
        stripeSubscriptionId: student.stripeSubscriptionId,
        pauseRows: pauseHistoryRows,
      }),
    }));
  const sheetByMmsId = new Map(sheetStudents.map((student) => [student.mmsId, student]));

  const registryByMmsId = new Map(registryEntries.map((entry) => [entry.mmsId, entry]));

  const currentIssues = [
    ...flagRows.map((flag) =>
      buildIssueRecord({
        flag,
        sheetStudent: sheetByMmsId.get(flag.mms_id || '') || null,
        registryEntry: registryByMmsId.get(flag.mms_id || '') || null,
      }),
    )
      .filter((issue) => issue.active),
    ...buildPaymentIssues(sheetStudents, registryByMmsId),
    ...buildPauseIssues(sheetStudents, registryByMmsId),
  ];
  const now = new Date().toISOString();
  const syncResult = mergeIssuesWithQueueState({
    currentIssues: currentIssues.map(prepareIssue),
    queueRows,
    now,
    managedSources: ['review_flags', 'payment_static'],
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
  };
}
