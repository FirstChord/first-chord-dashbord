function isStripeManaged(student) {
  return student.paymentMode === 'stripe';
}

export function buildPaymentOperationsSummary(students = []) {
  const summary = {
    totalStudents: students.length,
    stripeManaged: 0,
    manualPayers: 0,
    unknownPaymentMode: 0,
    setupPending: 0,
    pausedExpected: 0,
    inactiveOrStopped: 0,
    activeExpected: 0,
    linkedStripeCustomers: 0,
    linkedStripeSubscriptions: 0,
    stripeLinkingGaps: 0,
  };

  for (const student of students) {
    if (student.paymentMode === 'stripe') {
      summary.stripeManaged += 1;
    } else if (student.paymentMode === 'manual') {
      summary.manualPayers += 1;
    } else {
      summary.unknownPaymentMode += 1;
    }

    if (student.paymentExpectation === 'setup_pending') {
      summary.setupPending += 1;
    } else if (student.paymentExpectation === 'stripe_paused_expected') {
      summary.pausedExpected += 1;
    } else if (student.paymentExpectation === 'inactive_or_stopped') {
      summary.inactiveOrStopped += 1;
    } else if (student.paymentExpectation === 'stripe_active_expected') {
      summary.activeExpected += 1;
    }

    if (!isStripeManaged(student)) {
      continue;
    }

    if (student.stripeCustomerId) {
      summary.linkedStripeCustomers += 1;
    }

    if (student.stripeSubscriptionId) {
      summary.linkedStripeSubscriptions += 1;
    }

    const hasLinkingGap = !student.stripeCustomerId || !student.stripeSubscriptionId;
    if (hasLinkingGap && student.paymentExpectation !== 'setup_pending') {
      summary.stripeLinkingGaps += 1;
    }
  }

  return summary;
}
