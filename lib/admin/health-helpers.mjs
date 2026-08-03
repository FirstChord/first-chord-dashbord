function parseIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildWorkflowRunHealth(run, { label = 'Workflow', maxAgeHours = null, now = new Date() } = {}) {
  if (!run) {
    return {
      label,
      status: 'Unknown',
      detail: 'No workflow runs found yet.',
      updatedAt: null,
      conclusion: '',
      htmlUrl: '',
    };
  }

  const updatedAt = run.updated_at || run.run_started_at || run.created_at || null;
  if (run.status !== 'completed') {
    return {
      label,
      status: 'Running',
      detail: `${run.name || label} is currently ${run.status}.`,
      updatedAt,
      conclusion: run.conclusion || '',
      htmlUrl: run.html_url || '',
    };
  }

  if (run.conclusion !== 'success') {
    return {
      label,
      status: 'Failing',
      detail: `Latest workflow run concluded with ${run.conclusion || 'an unknown state'}.`,
      updatedAt,
      conclusion: run.conclusion || '',
      htmlUrl: run.html_url || '',
    };
  }

  const updated = parseIsoDate(updatedAt);
  const current = now instanceof Date ? now : new Date(now);
  const ageHours = updated && !Number.isNaN(current.getTime())
    ? Math.max(0, Math.floor((current.getTime() - updated.getTime()) / (60 * 60 * 1000)))
    : null;
  if (Number.isFinite(maxAgeHours) && (ageHours === null || ageHours > maxAgeHours)) {
    return {
      label,
      status: 'Stale',
      detail: ageHours === null ? 'Latest success time is unavailable.' : `Latest success is ${ageHours} hours old.`,
      updatedAt,
      conclusion: run.conclusion || '',
      htmlUrl: run.html_url || '',
    };
  }

  return {
    label,
    status: 'Healthy',
    detail: 'Latest workflow run succeeded.',
    updatedAt,
    conclusion: run.conclusion || '',
    htmlUrl: run.html_url || '',
  };
}

function utcMonthKey(at, offset = 0) {
  const current = at instanceof Date ? at : new Date(at);
  const shifted = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1));
  return shifted.toISOString().slice(0, 7);
}

export function buildFinanceAutomationHealth({ snapshotRows = [], forecastRows = [], collectedRows = [], now = new Date() } = {}) {
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error('A valid health-check time is required');
  const currentMonth = utcMonthKey(current);
  const previousMonth = utcMonthKey(current, -1);
  const monthlySnapshot = snapshotRows.find((row) => (
    `${row.period_type || ''}`.trim() === 'monthly'
    && `${row.snapshot_at || ''}`.startsWith(currentMonth)
  )) || null;
  const collected = collectedRows.find((row) => `${row.month || ''}`.trim() === previousMonth) || null;
  const forecast = forecastRows.find((row) => `${row.month || ''}`.trim() === currentMonth) || null;
  const missing = [
    monthlySnapshot ? '' : `${currentMonth} monthly baseline`,
    forecast ? '' : `${currentMonth} blind Stripe forecast`,
    collected ? '' : `${previousMonth} Stripe collections`,
  ].filter(Boolean);
  const updatedAt = [monthlySnapshot?.snapshot_at, forecast?.forecasted_at, collected?.refreshed_at]
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  if (!missing.length) {
    return {
      status: 'Healthy',
      detail: `${currentMonth} baseline and blind forecast, plus ${previousMonth} Stripe collections, are present.`,
      updatedAt,
      currentMonth,
      previousMonth,
      monthlySnapshotPresent: true,
      forecastPresent: true,
      collectedPresent: true,
    };
  }

  const pendingToday = current.getUTCDate() === 1;
  return {
    status: pendingToday ? 'Running' : 'Stale',
    detail: `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} missing${pendingToday ? '; first-of-month jobs may still be running.' : '.'}`,
    updatedAt,
    currentMonth,
    previousMonth,
    monthlySnapshotPresent: Boolean(monthlySnapshot),
    forecastPresent: Boolean(forecast),
    collectedPresent: Boolean(collected),
  };
}

export function buildFlagsFreshnessSummary(flags = []) {
  const generatedDates = [...new Set(flags.map((flag) => `${flag.generated_date || ''}`.trim()).filter(Boolean))];
  const parsedDates = generatedDates.map(parseIsoDate).filter(Boolean).sort((a, b) => b.getTime() - a.getTime());
  const latestGeneratedAt = parsedDates[0] || null;

  if (!latestGeneratedAt) {
    return {
      latestGeneratedAt: null,
      distinctGeneratedDates: generatedDates,
      status: 'Unknown',
      statusDetail: 'No generated_date found on Review_Flags.',
      ageDays: null,
    };
  }

  const ageMs = Date.now() - latestGeneratedAt.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  if (ageDays <= 1) {
    return {
      latestGeneratedAt,
      distinctGeneratedDates: generatedDates,
      status: 'Fresh',
      statusDetail: 'Review flags look current.',
      ageDays,
    };
  }

  if (ageDays <= 7) {
    return {
      latestGeneratedAt,
      distinctGeneratedDates: generatedDates,
      status: 'Aging',
      statusDetail: 'Review flags are usable but no longer very fresh.',
      ageDays,
    };
  }

  return {
    latestGeneratedAt,
    distinctGeneratedDates: generatedDates,
    status: 'Stale',
    statusDetail: 'Review flags should be regenerated before heavy triage.',
    ageDays,
  };
}

export function buildIssueEvidenceSummary(issue = {}, flagsFreshness = {}) {
  if (!issue.sourcePresent) {
    return {
      label: 'System-cleared',
      status: 'Cleared',
      detail: 'The latest source check no longer detects this issue.',
      updatedAt: issue.lastSeenAt || null,
    };
  }

  if (issue.source === 'review_flags') {
    return {
      label: 'Review Flags',
      status: flagsFreshness?.status || 'Unknown',
      detail: flagsFreshness?.statusDetail || 'Generated Review_Flags freshness is unknown.',
      updatedAt: flagsFreshness?.latestGeneratedAt || issue.generatedDate || null,
    };
  }

  if (issue.source === 'payment_static') {
    return {
      label: 'Sheets payment state',
      status: 'Current',
      detail: 'Checked from the current Students sheet read when this page loaded.',
      updatedAt: issue.lastSeenAt || null,
    };
  }

  if (issue.source === 'stripe_live') {
    return {
      label: 'Manual Stripe scan',
      status: 'Manual',
      detail: 'Based on the latest manual Stripe scan stored in the issue queue.',
      updatedAt: issue.lastSeenAt || null,
    };
  }

  return {
    label: issue.source || 'Unknown source',
    status: 'Unknown',
    detail: 'Evidence source freshness is not classified yet.',
    updatedAt: issue.lastSeenAt || issue.generatedDate || null,
  };
}

export function formatDateTime(value) {
  if (!value) return '—';
  const parsed = value instanceof Date ? value : parseIsoDate(value);
  if (!parsed) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}
