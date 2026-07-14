import { buildPaymentIssueRecord } from './issues-helpers.mjs';
import { deriveStudentLifecycleStatus } from './lifecycle-helpers.mjs';
import { derivePauseExpectationDecision } from './pause-auto-sync-helpers.mjs';
import { isTestStudentRecord } from './test-student-helpers.mjs';

function withRegistryContext(student, registryByMmsId) {
  const registryEntry = student.registryEntry
    || student.registry
    || registryByMmsId.get(student.mmsId)
    || null;
  const registryTutor = student.registryTutor || registryEntry?.tutor || '';
  const hasLifecycle = Boolean(student.lifecycleStatus);
  const lifecycle = hasLifecycle ? {} : deriveStudentLifecycleStatus({
    ...student,
    registry: registryEntry,
    registryEntry,
    hasRegistryEntry: Boolean(registryEntry),
  });
  return {
    ...student,
    registry: registryEntry,
    registryEntry,
    registryTutor,
    ...lifecycle,
  };
}

function eligibleStripeStudents(students, registryByMmsId) {
  return students
    .filter((student) => student.mmsId)
    .map((student) => withRegistryContext(student, registryByMmsId))
    .filter((student) => !isTestStudentRecord(student))
    .filter((student) => student.paymentMode === 'stripe');
}

export function buildPaymentIssues(students = [], registryByMmsId = new Map()) {
  return eligibleStripeStudents(students, registryByMmsId).flatMap((student) => {
    if (student.paymentExpectation === 'setup_pending') {
      return student.stripeCustomerId && student.stripeSubscriptionId
        ? [buildPaymentIssueRecord({ type: 'SETUP PENDING STRIPE LINKED', student })]
        : [];
    }

    if (!student.stripeCustomerId && !student.stripeSubscriptionId) {
      return [buildPaymentIssueRecord({ type: 'STRIPE SETUP INCOMPLETE', student })];
    }
    if (!student.stripeCustomerId && student.stripeSubscriptionId) {
      return [buildPaymentIssueRecord({ type: 'STRIPE CUSTOMER MISSING', student })];
    }
    if (student.stripeCustomerId && !student.stripeSubscriptionId) {
      return [buildPaymentIssueRecord({ type: 'STRIPE SUBSCRIPTION MISSING', student })];
    }
    return [];
  });
}

export function buildPauseIssues(students = [], registryByMmsId = new Map()) {
  return eligibleStripeStudents(students, registryByMmsId).flatMap((student) => {
    const pauseSummary = student.pauseSummary || null;
    const pauseDecision = student.pauseExpectationDecision || derivePauseExpectationDecision(student);
    if (!pauseSummary?.hasPauseHistory || pauseSummary.matchConfidence === 'low') return [];

    if (pauseSummary.currentlyPaused && student.paymentExpectation !== 'stripe_paused_expected') {
      if (!pauseDecision.shouldCreateIssue && pauseDecision.expectedPaymentExpectation === 'stripe_paused_expected') {
        return [];
      }
      return [buildPaymentIssueRecord({ type: 'PAUSE EXPECTATION MISMATCH', student })];
    }

    if (pauseSummary.upcomingPause) return [];

    if (!pauseSummary.currentlyPaused && student.paymentExpectation === 'stripe_paused_expected') {
      if (pauseDecision.allowsActiveBillingBeforeNextLesson || !pauseDecision.shouldCreateIssue) return [];
      return [buildPaymentIssueRecord({ type: 'PAUSE EXPECTATION STALE', student })];
    }

    return [];
  });
}
