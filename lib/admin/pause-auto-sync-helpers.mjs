export function buildPauseExpectationAutoSyncPlan(students = []) {
  return students
    .filter((student) => student.mmsId)
    .filter((student) => student.paymentMode === 'stripe')
    .filter((student) => student.paymentExpectation !== 'setup_pending')
    .filter((student) => student.paymentExpectation !== 'inactive_or_stopped')
    .filter((student) => student.pauseSummary?.hasPauseHistory)
    .filter((student) => student.pauseSummary?.matchedBy === 'subscription_id')
    .filter((student) => student.pauseSummary?.matchConfidence === 'high')
    .flatMap((student) => {
      const pauseSummary = student.pauseSummary;
      const coverageSummary = student.pauseCoverageContext?.summary || '';

      // Start direction: the pause window is active but the expectation has not
      // caught up to "paused" yet.
      if (pauseSummary.currentlyPaused && student.paymentExpectation !== 'stripe_paused_expected') {
        return [{
          mmsId: student.mmsId,
          previousPaymentExpectation: student.paymentExpectation || '',
          nextPaymentExpectation: 'stripe_paused_expected',
          reason: [
            'Pause History is currently active and matched by Stripe subscription ID.',
            coverageSummary,
          ].filter(Boolean).join(' '),
        }];
      }

      // Revert direction: the pause window has ended (and none is upcoming) but the
      // expectation is still "paused". Stripe resumes billing on its own, so realign
      // the dashboard expectation back to active rather than leaving a stale flag.
      if (
        !pauseSummary.currentlyPaused
        && !pauseSummary.upcomingPause
        && student.paymentExpectation === 'stripe_paused_expected'
      ) {
        return [{
          mmsId: student.mmsId,
          previousPaymentExpectation: student.paymentExpectation || '',
          nextPaymentExpectation: 'stripe_active_expected',
          reason: [
            'Pause History window has ended and is matched by Stripe subscription ID; reverting expectation to active.',
            coverageSummary,
          ].filter(Boolean).join(' '),
        }];
      }

      return [];
    });
}
