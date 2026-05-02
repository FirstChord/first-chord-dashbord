function isFailureInvoiceStatus(status) {
  return ['open', 'past_due', 'uncollectible'].includes((status || '').trim().toLowerCase());
}

export function deriveStripePauseState(subscription) {
  if (!subscription) {
    return 'not_found';
  }

  if (subscription.pause_collection) {
    return 'paused';
  }

  const hasZeroQuantityItem = Array.isArray(subscription.items?.data)
    && subscription.items.data.some((item) => Number(item?.quantity || 0) === 0);

  if (hasZeroQuantityItem) {
    return 'paused';
  }

  return 'active';
}

export function deriveStripeInvoiceSummary(invoice) {
  if (!invoice) {
    return {
      latestInvoiceId: '',
      latestInvoiceStatus: '',
      latestInvoicePaid: null,
      latestInvoiceAttemptCount: 0,
      latestPaymentIntentStatus: '',
      lastFailureAt: '',
      hasPaymentProblem: false,
    };
  }

  const latestInvoiceStatus = `${invoice.status || ''}`.trim().toLowerCase();
  const latestPaymentIntentStatus = `${invoice.payment_intent?.status || ''}`.trim().toLowerCase();
  const hasPaymentProblem = Boolean(
    isFailureInvoiceStatus(latestInvoiceStatus)
      || ['requires_payment_method', 'canceled'].includes(latestPaymentIntentStatus),
  );

  return {
    latestInvoiceId: invoice.id || '',
    latestInvoiceStatus,
    latestInvoicePaid: typeof invoice.paid === 'boolean' ? invoice.paid : null,
    latestInvoiceAttemptCount: Number(invoice.attempt_count || 0),
    latestPaymentIntentStatus,
    lastFailureAt: hasPaymentProblem
      ? new Date((invoice.status_transitions?.finalized_at || invoice.created || 0) * 1000).toISOString()
      : '',
    hasPaymentProblem,
  };
}

export function buildStripeSnapshot({ customer = null, subscription = null, invoice = null } = {}) {
  const customerFound = Boolean(customer?.id);
  const subscriptionFound = Boolean(subscription?.id);
  const pauseState = deriveStripePauseState(subscription);
  const subscriptionStatus = `${subscription?.status || ''}`.trim().toLowerCase();
  const invoiceSummary = deriveStripeInvoiceSummary(invoice);

  const activelyBilling = Boolean(
    subscriptionFound
      && pauseState !== 'paused'
      && ['active', 'trialing', 'past_due', 'unpaid'].includes(subscriptionStatus),
  );

  return {
    customerFound,
    subscriptionFound,
    resolvedCustomerId: customer?.id || '',
    resolvedSubscriptionId: subscription?.id || '',
    subscriptionStatus,
    pauseState,
    activelyBilling,
    scheduleId: subscription?.schedule || '',
    ...invoiceSummary,
    lastCheckedAt: new Date().toISOString(),
  };
}

export function buildLiveStripeIssues({ student, snapshot }) {
  if (!student || student.paymentMode !== 'stripe' || !snapshot) {
    return [];
  }

  const expectation = student.paymentExpectation || '';
  const issues = [];

  if (expectation === 'setup_pending') {
    return issues;
  }

  if (expectation === 'stripe_active_expected' && !snapshot.subscriptionFound) {
    issues.push('ACTIVE_WITHOUT_SUBSCRIPTION');
  }

  if (expectation === 'stripe_active_expected' && ['canceled', 'incomplete_expired'].includes(snapshot.subscriptionStatus)) {
    issues.push('SUBSCRIPTION_CANCELLED_UNEXPECTEDLY');
  }

  if (expectation === 'stripe_active_expected' && snapshot.pauseState === 'paused') {
    issues.push('SUBSCRIPTION_STATE_MISMATCH');
  }

  if (expectation === 'stripe_paused_expected' && snapshot.activelyBilling) {
    issues.push('SUBSCRIPTION_STATE_MISMATCH');
  }

  if (expectation === 'inactive_or_stopped' && snapshot.activelyBilling) {
    issues.push('INACTIVE_STILL_BILLING');
  }

  if (snapshot.hasPaymentProblem && expectation !== 'stripe_paused_expected') {
    issues.push('PAYMENT_FAILED');
  }

  return [...new Set(issues)];
}
