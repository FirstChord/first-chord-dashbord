export function buildPauseExpectationAutoSyncPlan(students = []) {
  return students
    .filter((student) => student.mmsId)
    .filter((student) => student.paymentMode === 'stripe')
    .filter((student) => student.paymentExpectation !== 'setup_pending')
    .filter((student) => student.paymentExpectation !== 'inactive_or_stopped')
    .filter((student) => student.pauseSummary?.hasPauseHistory)
    .filter((student) => student.pauseSummary?.currentlyPaused)
    .filter((student) => student.pauseSummary?.matchedBy === 'subscription_id')
    .filter((student) => student.pauseSummary?.matchConfidence === 'high')
    .filter((student) => student.paymentExpectation !== 'stripe_paused_expected')
    .map((student) => {
      const coverageSummary = student.pauseCoverageContext?.summary || '';
      return {
        mmsId: student.mmsId,
        previousPaymentExpectation: student.paymentExpectation || '',
        nextPaymentExpectation: 'stripe_paused_expected',
        reason: [
          'Pause History is currently active and matched by Stripe subscription ID.',
          coverageSummary,
        ].filter(Boolean).join(' '),
      };
    });
}
