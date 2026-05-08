function buildStatusLine({ pauseSummary, paymentExpectation, stripeSnapshot }) {
  if (!pauseSummary?.hasPauseHistory) {
    return 'No pause history recorded for this student yet.';
  }

  if (pauseSummary.currentlyPaused && paymentExpectation !== 'stripe_paused_expected') {
    return 'Pause History says the student is currently paused, but payment expectation is not paused yet.';
  }

  if (!pauseSummary.currentlyPaused && paymentExpectation === 'stripe_paused_expected') {
    return 'The latest pause window appears to have ended, but payment expectation still says paused.';
  }

  if (stripeSnapshot && paymentExpectation === 'stripe_paused_expected' && stripeSnapshot.activelyBilling) {
    return 'The student is expected to be paused, but live Stripe still appears to be billing.';
  }

  if (stripeSnapshot && paymentExpectation === 'stripe_active_expected' && stripeSnapshot.pauseState === 'paused') {
    return 'The student is expected active, but live Stripe still appears paused.';
  }

  if (pauseSummary.currentlyPaused && paymentExpectation === 'stripe_paused_expected') {
    return 'Pause History and payment expectation agree that this student should currently be paused.';
  }

  if (!pauseSummary.currentlyPaused && paymentExpectation !== 'stripe_paused_expected') {
    return 'There is no active pause mismatch currently visible from Pause History and payment expectation.';
  }

  return 'Pause state looks broadly aligned, but refresh live Stripe if you want to confirm billing behavior.';
}

export function buildPauseWorkflowSummary({ pauseSummary = null, paymentExpectation = '', stripeSnapshot = null } = {}) {
  const needsPausedExpectation = Boolean(
    pauseSummary?.hasPauseHistory && pauseSummary.currentlyPaused && paymentExpectation !== 'stripe_paused_expected',
  );
  const needsActiveExpectation = Boolean(
    pauseSummary?.hasPauseHistory && !pauseSummary.currentlyPaused && paymentExpectation === 'stripe_paused_expected',
  );
  const liveStripeMismatch = Boolean(
    stripeSnapshot && (
      (paymentExpectation === 'stripe_paused_expected' && stripeSnapshot.activelyBilling) ||
      (paymentExpectation === 'stripe_active_expected' && stripeSnapshot.pauseState === 'paused')
    ),
  );

  return {
    needsPausedExpectation,
    needsActiveExpectation,
    liveStripeMismatch,
    statusLine: buildStatusLine({ pauseSummary, paymentExpectation, stripeSnapshot }),
  };
}
