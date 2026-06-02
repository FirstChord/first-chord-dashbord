function buildStatusLine({ pauseSummary, paymentExpectation, stripeSnapshot, pauseCoverageContext }) {
  if (!pauseSummary?.hasPauseHistory) {
    return 'No pause history recorded for this student yet.';
  }

  if (pauseSummary.upcomingPause) {
    if (pauseCoverageContext?.summary) {
      return `Pause History has an upcoming pause window. ${pauseCoverageContext.summary}`;
    }
    return 'Pause History has an upcoming pause window, but the student is not currently paused.';
  }

  if (pauseSummary.currentlyPaused && paymentExpectation !== 'stripe_paused_expected') {
    if (pauseCoverageContext?.summary) {
      return `${pauseCoverageContext.summary} Payment expectation still needs aligning for this pause window.`;
    }
    return 'Pause History says the student is currently paused. Confirm the pause, then set payment expectation to Stripe paused expected.';
  }

  if (!pauseSummary.currentlyPaused && paymentExpectation === 'stripe_paused_expected') {
    if (pauseCoverageContext?.summary) {
      return `${pauseCoverageContext.summary} The covered lesson window appears to have passed, but payment expectation still says paused.`;
    }
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

function buildLoopState({ pauseSummary, paymentExpectation, stripeSnapshot, pauseCoverageContext }) {
  if (!pauseSummary?.hasPauseHistory) {
    return {
      state: 'No pause history',
      nextAction: 'Use the main student record and Stripe checks; this workflow has no Pause History source yet.',
      closureCondition: 'No pause loop is open until Pause History contains a relevant pause window.',
    };
  }

  if (pauseSummary.upcomingPause) {
    return {
      state: 'Upcoming pause scheduled',
      nextAction: pauseCoverageContext?.recommendation || 'No payment expectation change is needed until the pause window starts.',
      closureCondition: 'The pause loop opens when the scheduled pause start date or covered lesson window arrives.',
    };
  }

  if (pauseSummary.currentlyPaused && paymentExpectation !== 'stripe_paused_expected') {
    return {
      state: 'Pause record alignment needed',
      nextAction: pauseCoverageContext?.status === 'no_usual_lesson_covered'
        ? pauseCoverageContext.recommendation
        : 'The pause tool has recorded a pause window that appears to cover a lesson. If that coverage is correct, set payment expectation to Stripe paused expected. Use a single-student Stripe check only if you need live billing confirmation.',
      closureCondition: 'Pause History shows an active pause and payment expectation says Stripe paused expected.',
    };
  }

  if (!pauseSummary.currentlyPaused && paymentExpectation === 'stripe_paused_expected') {
    return {
      state: 'Stale pause expectation',
      nextAction: pauseCoverageContext?.recommendation || 'If the pause has ended, set payment expectation to Stripe active expected. If the pause dates are wrong, correct Pause History first.',
      closureCondition: 'Pause History shows no active pause and payment expectation no longer says Stripe paused expected.',
    };
  }

  if (stripeSnapshot && paymentExpectation === 'stripe_paused_expected' && stripeSnapshot.activelyBilling) {
    return {
      state: 'Stripe action needed',
      nextAction: 'The school record says paused, but Stripe still looks billable. Keep this active until Stripe no longer bills.',
      closureCondition: 'Pause History, payment expectation, and live Stripe all agree the student is paused and not actively billing.',
    };
  }

  if (stripeSnapshot && paymentExpectation === 'stripe_active_expected' && stripeSnapshot.pauseState === 'paused') {
    return {
      state: 'Stripe action needed',
      nextAction: 'The school record says active, but Stripe still looks paused. Keep this active until Stripe is active again or the expectation is corrected.',
      closureCondition: 'Pause History, payment expectation, and live Stripe all agree the student should be active.',
    };
  }

  if (!stripeSnapshot) {
    return {
      state: 'Records aligned',
      nextAction: pauseCoverageContext?.summary
        ? `${pauseCoverageContext.summary} Records are aligned; use the single-student Stripe check only if you need live billing confirmation.`
        : 'Records are aligned; refresh live Stripe only if this pause needs billing confirmation.',
      closureCondition: 'Records are aligned now; live Stripe confirmation closes the billing side of the loop.',
    };
  }

  return {
    state: 'Loop closed',
    nextAction: 'No pause action is currently visible from the available records.',
    closureCondition: 'Pause History, payment expectation, and live Stripe are aligned.',
  };
}

export function buildPauseWorkflowSummary({
  pauseSummary = null,
  paymentExpectation = '',
  stripeSnapshot = null,
  pauseCoverageContext = null,
} = {}) {
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
  const upcomingPause = Boolean(pauseSummary?.hasPauseHistory && pauseSummary.upcomingPause);
  const recordAligned = Boolean(
    pauseSummary?.hasPauseHistory &&
    !upcomingPause &&
    !needsPausedExpectation &&
    !needsActiveExpectation
  );
  const liveStripeChecked = Boolean(stripeSnapshot);
  const liveStripeAligned = liveStripeChecked && !liveStripeMismatch;
  const loopState = buildLoopState({ pauseSummary, paymentExpectation, stripeSnapshot, pauseCoverageContext });

  return {
    needsPausedExpectation,
    needsActiveExpectation,
    upcomingPause,
    liveStripeMismatch,
    recordAligned,
    liveStripeChecked,
    liveStripeAligned,
    isClosed: recordAligned && (!liveStripeChecked || liveStripeAligned),
    state: loopState.state,
    nextAction: loopState.nextAction,
    closureCondition: loopState.closureCondition,
    coverageStatus: pauseCoverageContext?.status || '',
    coverageSummary: pauseCoverageContext?.summary || '',
    coverageRecommendation: pauseCoverageContext?.recommendation || '',
    statusLine: buildStatusLine({ pauseSummary, paymentExpectation, stripeSnapshot, pauseCoverageContext }),
  };
}
