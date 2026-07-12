function normaliseText(value) {
  return `${value || ''}`.trim();
}

export function normaliseIssueTypeKey(issueType) {
  return normaliseText(issueType)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normaliseContextKey(contextKey) {
  return normaliseText(contextKey)
    .replace(/[^A-Za-z0-9_:-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildIssueContextKey(issue = {}) {
  const type = normaliseText(issue.type).toUpperCase();

  if (type === 'TUTOR CONFLICT') {
    return 'registry_vs_sheets';
  }

  if (
    ['ACTIVE_WITHOUT_SUBSCRIPTION', 'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY', 'SUBSCRIPTION_STATE_MISMATCH', 'INACTIVE_STILL_BILLING', 'PAYMENT_FAILED', 'PAYMENT_RETRYING'].includes(type)
      && issue.stripeSubscriptionId
  ) {
    return normaliseContextKey(issue.stripeSubscriptionId);
  }

  return '';
}

export function buildIssueId({ source, issueType, mmsId, contextKey = '' }) {
  const parts = [
    normaliseText(source).toLowerCase(),
    normaliseIssueTypeKey(issueType),
    normaliseText(mmsId),
  ].filter(Boolean);

  const normalisedContextKey = normaliseContextKey(contextKey);
  if (normalisedContextKey) {
    parts.push(normalisedContextKey);
  }

  return parts.join(':');
}

export function normaliseIssueStatus(value) {
  const status = normaliseText(value).toLowerCase();

  if (['open', 'acknowledged', 'ignored', 'resolved'].includes(status)) {
    return status;
  }

  return 'open';
}
