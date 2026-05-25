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
  const normalised = `${value}`.trim();
  const dateOnlyMatch = normalised.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(normalised);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normaliseIdentityName(value) {
  return `${value || ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function getPauseMatch(row, { normalisedEmail, normalisedSubscriptionId, normalisedStudentName }) {
  if (normalisedSubscriptionId && row.subscriptionId && row.subscriptionId === normalisedSubscriptionId) {
    return {
      confidence: 'high',
      matchedBy: 'subscription_id',
      evidence: 'Matched Pause History by Stripe subscription ID.',
    };
  }

  if (normalisedEmail && row.email && row.email.toLowerCase() === normalisedEmail) {
    const rowName = normaliseIdentityName(row.studentName);
    if (normalisedStudentName && rowName && rowName === normalisedStudentName) {
      return {
        confidence: 'medium',
        matchedBy: 'email_and_student_name',
        evidence: 'Matched Pause History by email and student name.',
      };
    }

    return {
      confidence: 'low',
      matchedBy: 'email_only',
      evidence: 'Matched Pause History by email only; check this is the right student before acting.',
    };
  }

  return null;
}

export function buildPauseSummary({
  studentEmail = '',
  studentName = '',
  stripeSubscriptionId = '',
  pauseRows = [],
  currentDate = new Date(),
} = {}) {
  const normalisedEmail = `${studentEmail || ''}`.trim().toLowerCase();
  const normalisedStudentName = normaliseIdentityName(studentName);
  const normalisedSubscriptionId = `${stripeSubscriptionId || ''}`.trim();

  const candidates = pauseRows
    .map(normalisePauseHistoryRow)
    .map((row) => ({
      ...row,
      match: getPauseMatch(row, { normalisedEmail, normalisedSubscriptionId, normalisedStudentName }),
    }))
    .filter((row) => row.match)
    .sort((a, b) => {
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      const confidenceDelta = confidenceOrder[a.match.confidence] - confidenceOrder[b.match.confidence];
      if (confidenceDelta) return confidenceDelta;
      const aDate = parseDate(a.endDate)?.getTime() || 0;
      const bDate = parseDate(b.endDate)?.getTime() || 0;
      return bDate - aDate;
    })

  const latest = candidates[0] || null;
  if (!latest) {
    return {
      hasPauseHistory: false,
      currentlyPaused: false,
      upcomingPause: false,
      latestPause: null,
      matchConfidence: '',
      matchedBy: '',
      matchEvidence: '',
    };
  }

  const startDate = parseDate(latest.startDate);
  const endDate = parseDate(latest.endDate);
  const today = parseDate(currentDate) || new Date();
  today.setHours(0, 0, 0, 0);
  const startsOnOrBeforeToday = Boolean(startDate && startDate.getTime() <= today.getTime());
  const endsOnOrAfterToday = Boolean(endDate && endDate.getTime() >= today.getTime());
  const startsAfterToday = Boolean(startDate && startDate.getTime() > today.getTime());

  return {
    hasPauseHistory: true,
    currentlyPaused: startsOnOrBeforeToday && endsOnOrAfterToday,
    upcomingPause: startsAfterToday,
    latestPause: {
      studentName: latest.studentName,
      email: latest.email,
      tutor: latest.tutor,
      subscriptionId: latest.subscriptionId,
      startDate: latest.startDate,
      endDate: latest.endDate,
      stripeStatus: latest.stripeStatus,
    },
    matchConfidence: latest.match.confidence,
    matchedBy: latest.match.matchedBy,
    matchEvidence: latest.match.evidence,
  };
}
