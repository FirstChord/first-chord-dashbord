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
    studentName: pickFirst(row, ['studentName', 'Student Name', 'Student name', 'student_name']),
    email: pickFirst(row, ['email', 'Email', 'Student Email', 'Student email', 'student_email']),
    tutor: pickFirst(row, ['tutor', 'Tutor']),
    subscriptionId: pickFirst(row, [
      'subscriptionId',
      'Stripe Subscription ID',
      'Subscription ID',
      'Subscription Id',
      'Subscription id',
      'stripe_subscription_id',
    ]),
    startDate: pickFirst(row, [
      'startDate',
      'Pause Start Date',
      'Start Date',
      'Start date',
      'start_date',
      'start',
      'Start',
    ]),
    endDate: pickFirst(row, [
      'endDate',
      'Pause End Date',
      'End Date',
      'End date',
      'end_date',
      'end',
      'End',
    ]),
    stripeStatus: pickFirst(row, ['stripeStatus', 'Stripe Status', 'Stripe status', 'stripe_status']),
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
