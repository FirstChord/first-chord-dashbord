import { getRegistryEntries } from '@/lib/admin/registry';
import { getReviewFlagsRows, getStudentsSheetRows } from '@/lib/admin/sheets';
import { buildFlagsFreshnessSummary } from './health-helpers.mjs';
import { buildIssueRecord, buildPaymentIssueRecord } from './issues-helpers.mjs';
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

export async function scanLiveStripeIssues() {
  const [rawSheetRows, registryEntries] = await Promise.all([
    getStudentsSheetRows(),
    getRegistryEntries(),
  ]);

  const sheetStudents = rawSheetRows.map(normaliseSheetStudent).filter((student) => student.mmsId);
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

  return {
    issues,
    scannedCount: stripeStudents.length,
    scannedAt,
  };
}

export async function getAdminIssues() {
  const [flagRows, rawSheetRows, registryEntries] = await Promise.all([
    getReviewFlagsRows(),
    getStudentsSheetRows(),
    getRegistryEntries(),
  ]);

  const sheetStudents = rawSheetRows.map(normaliseSheetStudent).filter((student) => student.mmsId);
  const sheetByMmsId = new Map(sheetStudents.map((student) => [student.mmsId, student]));

  const registryByMmsId = new Map(registryEntries.map((entry) => [entry.mmsId, entry]));

  const issues = [
    ...flagRows.map((flag) =>
      buildIssueRecord({
        flag,
        sheetStudent: sheetByMmsId.get(flag.mms_id || '') || null,
        registryEntry: registryByMmsId.get(flag.mms_id || '') || null,
      }),
    )
      .filter((issue) => issue.active),
    ...buildPaymentIssues(sheetStudents, registryByMmsId),
  ]
    .sort((a, b) => {
      const severityOrder = { 'Needs action': 0, Warning: 1, Info: 2 };
      const bySeverity = (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
      if (bySeverity !== 0) return bySeverity;
      return a.studentName.localeCompare(b.studentName);
    });

  return {
    issues,
    freshness: buildFlagsFreshnessSummary(flagRows),
  };
}
