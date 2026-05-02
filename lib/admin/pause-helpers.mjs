function pickFirst(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (`${value || ''}`.trim() !== '') {
      return `${value}`.trim();
    }
  }
  return '';
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalisePauseHistoryRow(row) {
  return {
    studentName: pickFirst(row, ['studentName', 'Student Name', 'student_name']),
    email: pickFirst(row, ['email', 'Email', 'student_email']),
    tutor: pickFirst(row, ['tutor', 'Tutor']),
    subscriptionId: pickFirst(row, ['subscriptionId', 'Subscription ID', 'stripe_subscription_id']),
    startDate: pickFirst(row, ['startDate', 'Start Date', 'start_date']),
    endDate: pickFirst(row, ['endDate', 'End Date', 'end_date']),
    stripeStatus: pickFirst(row, ['stripeStatus', 'Stripe Status', 'stripe_status']),
  };
}

export function buildPauseSummary({ studentEmail = '', stripeSubscriptionId = '', pauseRows = [] } = {}) {
  const normalisedEmail = `${studentEmail || ''}`.trim().toLowerCase();
  const normalisedSubscriptionId = `${stripeSubscriptionId || ''}`.trim();

  const candidates = pauseRows
    .map(normalisePauseHistoryRow)
    .filter((row) => {
      if (normalisedSubscriptionId && row.subscriptionId && row.subscriptionId === normalisedSubscriptionId) {
        return true;
      }

      if (normalisedEmail && row.email && row.email.toLowerCase() === normalisedEmail) {
        return true;
      }

      return false;
    })
    .sort((a, b) => {
      const aDate = parseDate(a.endDate)?.getTime() || 0;
      const bDate = parseDate(b.endDate)?.getTime() || 0;
      return bDate - aDate;
    });

  const latest = candidates[0] || null;
  if (!latest) {
    return {
      hasPauseHistory: false,
      currentlyPaused: false,
      latestPause: null,
    };
  }

  const endDate = parseDate(latest.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    hasPauseHistory: true,
    currentlyPaused: Boolean(endDate && endDate.getTime() >= today.getTime()),
    latestPause: latest,
  };
}
