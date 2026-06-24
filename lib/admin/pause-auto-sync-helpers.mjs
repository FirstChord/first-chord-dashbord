function dateOnly(value) {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function todayInput(currentDate = new Date()) {
  const parsed = currentDate instanceof Date ? currentDate : new Date(currentDate);
  if (Number.isNaN(parsed.getTime())) return dateOnly(new Date().toISOString().slice(0, 10));
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function hasReliablePauseIdentity(student = {}) {
  return Boolean(
    student.pauseSummary?.hasPauseHistory
      && student.pauseSummary?.matchedBy === 'subscription_id'
      && student.pauseSummary?.matchConfidence === 'high',
  );
}

function hasReliableLessonCoverage(coverage = {}) {
  return Boolean(
    coverage
      && coverage.coveredLessonCount > 0
      && !['no_pause_history', 'invalid_pause_window', 'schedule_missing', 'no_usual_lesson_covered'].includes(coverage.status),
  );
}

export function derivePauseExpectationDecision(student = {}, { currentDate = new Date() } = {}) {
  const today = todayInput(currentDate);
  const pauseSummary = student.pauseSummary || null;
  const coverage = student.pauseCoverageContext || null;
  const base = {
    mmsId: student.mmsId || '',
    expectedPaymentExpectation: student.paymentExpectation || '',
    shouldAutoSync: false,
    shouldCreateIssue: false,
    allowsActiveBillingBeforeNextLesson: false,
    confidence: 'low',
    reason: '',
  };

  if (!student.mmsId || student.paymentMode !== 'stripe') {
    return { ...base, reason: 'Student is not Stripe-managed.' };
  }

  if (student.paymentExpectation === 'setup_pending' || student.paymentExpectation === 'inactive_or_stopped') {
    return { ...base, reason: 'Payment expectation is intentionally outside active/pause sync.' };
  }

  if (!hasReliablePauseIdentity(student)) {
    return {
      ...base,
      shouldCreateIssue: Boolean(pauseSummary?.hasPauseHistory && pauseSummary.matchConfidence !== 'low'),
      reason: pauseSummary?.hasPauseHistory
        ? 'Pause History exists but is not matched by high-confidence Stripe subscription ID.'
        : 'No Pause History row is available for this student.',
    };
  }

  if (!hasReliableLessonCoverage(coverage)) {
    return {
      ...base,
      shouldCreateIssue: Boolean(
        pauseSummary.currentlyPaused && student.paymentExpectation !== 'stripe_paused_expected',
      ),
      confidence: 'medium',
      reason: coverage?.summary || 'Pause History matched, but lesson coverage could not be confirmed.',
    };
  }

  if (pauseSummary.currentlyPaused) {
    const expectedPaymentExpectation = 'stripe_paused_expected';
    return {
      ...base,
      expectedPaymentExpectation,
      shouldAutoSync: student.paymentExpectation !== expectedPaymentExpectation,
      shouldCreateIssue: false,
      confidence: coverage.confidence === 'high' ? 'high' : 'medium',
      reason: [
        'Pause History is active, matched by Stripe subscription ID, and covers a usual lesson.',
        coverage.summary,
      ].filter(Boolean).join(' '),
    };
  }

  const nextBillableLessonDate = dateOnly(coverage.nextBillableLessonDate || '');
  const beforeNextBillableLesson = Boolean(
    nextBillableLessonDate
      && today
      && today < nextBillableLessonDate
      && !pauseSummary.upcomingPause,
  );

  if (
    student.paymentExpectation === 'stripe_paused_expected'
    && !pauseSummary.upcomingPause
    && beforeNextBillableLesson
  ) {
    return {
      ...base,
      expectedPaymentExpectation: 'stripe_paused_expected',
      allowsActiveBillingBeforeNextLesson: true,
      shouldAutoSync: false,
      shouldCreateIssue: false,
      confidence: coverage.confidence === 'high' ? 'high' : 'medium',
      reason: [
        'The covered pause lesson has passed, but the next usual billable lesson has not arrived yet.',
        coverage.nextBillableLessonLabel ? `Next billable lesson: ${coverage.nextBillableLessonLabel}.` : '',
      ].filter(Boolean).join(' '),
    };
  }

  if (!pauseSummary.upcomingPause && student.paymentExpectation === 'stripe_paused_expected') {
    const expectedPaymentExpectation = 'stripe_active_expected';
    return {
      ...base,
      expectedPaymentExpectation,
      shouldAutoSync: true,
      shouldCreateIssue: false,
      confidence: coverage.confidence === 'high' ? 'high' : 'medium',
      reason: [
        'Pause History window has ended and the next billable lesson is due or no later lesson was found.',
        coverage.summary,
        coverage.nextBillableLessonLabel ? `Next billable lesson: ${coverage.nextBillableLessonLabel}.` : '',
      ].filter(Boolean).join(' '),
    };
  }

  return {
    ...base,
    shouldCreateIssue: false,
    confidence: coverage.confidence === 'high' ? 'high' : 'medium',
    reason: pauseSummary.upcomingPause
      ? 'Pause History has an upcoming pause; no expectation change is needed yet.'
      : 'Pause History and payment expectation do not require a change.',
  };
}

export function buildPauseExpectationAutoSyncPlan(students = [], options = {}) {
  return students
    .filter((student) => student.mmsId)
    .map((student) => ({
      student,
      decision: derivePauseExpectationDecision(student, options),
    }))
    .filter(({ decision }) => decision.shouldAutoSync)
    .flatMap((student) => {
      const { student: sourceStudent, decision } = student;
      return [{
        mmsId: sourceStudent.mmsId,
        previousPaymentExpectation: sourceStudent.paymentExpectation || '',
        nextPaymentExpectation: decision.expectedPaymentExpectation,
        reason: decision.reason,
      }];
    });
}
