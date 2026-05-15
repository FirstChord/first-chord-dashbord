const WAITING_STATUSES = new Set([
  'new',
  'contacted',
  'welcome_group_added',
  'welcome_call_booked',
  'call_completed',
]);

function normalise(value) {
  return `${value || ''}`.trim().toLowerCase();
}

function labelForStatus(status) {
  return {
    waiting: 'Waiting',
    onboarding: 'Onboarding',
    setup_pending: 'Setup pending',
    active: 'Active',
    paused: 'Paused',
    stopped: 'Stopped',
    needs_review: 'Needs review',
  }[status] || 'Needs review';
}

function result(status, confidence, reasons = [], warnings = []) {
  return {
    lifecycleStatus: status,
    lifecycleLabel: labelForStatus(status),
    lifecycleConfidence: confidence,
    lifecycleReasons: reasons.filter(Boolean),
    lifecycleWarnings: warnings.filter(Boolean),
  };
}

export function deriveStudentLifecycleStatus(studentContext = {}) {
  const paymentMode = normalise(studentContext.paymentMode);
  const paymentExpectation = normalise(studentContext.paymentExpectation);
  const waitingStatus = normalise(studentContext.waitingStatus || studentContext.waitingState?.status);
  const pauseSummary = studentContext.pauseSummary || {};
  const hasStripeCustomer = Boolean(`${studentContext.stripeCustomerId || ''}`.trim());
  const hasStripeSubscription = Boolean(`${studentContext.stripeSubscriptionId || ''}`.trim());
  const hasSheetRow = studentContext.hasSheetRow !== false && Boolean(studentContext.mmsId || studentContext.fullName);
  const hasRegistryEntry = studentContext.hasRegistryEntry ?? Boolean(studentContext.registry);

  if (!hasSheetRow) {
    return result('needs_review', 'medium', [
      'No complete Sheets student identity was provided.',
    ], [
      'Lifecycle cannot be confidently derived without a core student record.',
    ]);
  }

  if (paymentExpectation === 'inactive_or_stopped') {
    return result('stopped', 'high', [
      'Payment expectation is inactive_or_stopped.',
      hasSheetRow ? 'Student exists in the Students sheet.' : '',
    ]);
  }

  if (pauseSummary.currentlyPaused) {
    return result(
      'paused',
      paymentExpectation === 'stripe_paused_expected' ? 'high' : 'medium',
      [
        'Pause History indicates the student is currently paused.',
        paymentExpectation ? `Payment expectation is ${paymentExpectation}.` : 'Payment expectation is not set.',
      ],
      paymentExpectation === 'stripe_paused_expected'
        ? []
        : ['Pause History and payment expectation do not agree yet.'],
    );
  }

  if (paymentExpectation === 'stripe_paused_expected') {
    return result('needs_review', 'medium', [
      'Payment expectation is stripe_paused_expected.',
      pauseSummary.hasPauseHistory ? 'Pause History does not show an active pause.' : 'No active Pause History record was found.',
    ], [
      'Paused expectation may be stale or Pause History may need review.',
    ]);
  }

  if (paymentExpectation === 'stripe_active_expected') {
    const warnings = [];
    if (paymentMode === 'stripe' && (!hasStripeCustomer || !hasStripeSubscription)) {
      warnings.push('Stripe linkage is incomplete for an active-expected student.');
    }
    if (!hasRegistryEntry) {
      warnings.push('Active-expected student has no registry entry.');
    }

    return result(
      'active',
      warnings.length ? 'medium' : 'high',
      [
        'Payment expectation is stripe_active_expected.',
        paymentMode ? `Payment mode is ${paymentMode}.` : '',
      ],
      warnings,
    );
  }

  if (paymentMode === 'manual' && !paymentExpectation) {
    return result('active', 'medium', [
      'Payment mode is manual.',
      'Stripe checks are not expected for manual payers.',
    ]);
  }

  if (waitingStatus === 'onboarding_ready') {
    return result('onboarding', 'high', [
      'Waiting-list state is onboarding_ready.',
    ]);
  }

  if (paymentExpectation === 'setup_pending') {
    return result('setup_pending', 'high', [
      'Payment expectation is setup_pending.',
      hasSheetRow ? 'Student exists in the Students sheet.' : '',
    ], [
      !hasStripeSubscription ? 'Missing Stripe subscription may be expected during setup.' : '',
    ]);
  }

  if (WAITING_STATUSES.has(waitingStatus)) {
    return result('waiting', 'high', [
      `Waiting-list state is ${waitingStatus}.`,
    ]);
  }

  return result('needs_review', 'low', [
    paymentExpectation ? `Payment expectation is ${paymentExpectation}.` : 'Payment expectation is not set.',
    waitingStatus ? `Waiting-list state is ${waitingStatus}.` : '',
  ], [
    'Lifecycle could not be confidently derived from the current fields.',
  ]);
}
