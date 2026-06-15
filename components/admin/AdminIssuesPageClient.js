'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { buildIssueEvidenceSummary, formatDateTime } from '@/lib/admin/health-helpers.mjs';
import { buildPauseWorkflowSummary } from '@/lib/admin/pause-workflow-helpers.mjs';

function severityClasses(severity) {
  if (severity === 'Needs action') return 'border-red-200 bg-red-50 text-red-800';
  if (severity === 'Warning') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const ISSUE_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'TUTOR CONFLICT', label: 'Tutor conflict' },
  { value: 'SHEETS ONLY', label: 'Sheets only' },
  { value: 'REGISTRY ONLY', label: 'Registry only' },
  { value: 'PAYMENT SETUP PENDING', label: 'Payment setup pending' },
  { value: 'SETUP PENDING STRIPE LINKED', label: 'Setup pending but linked' },
  { value: 'STRIPE SETUP INCOMPLETE', label: 'Stripe setup incomplete' },
  { value: 'STRIPE CUSTOMER MISSING', label: 'Stripe customer missing' },
  { value: 'STRIPE SUBSCRIPTION MISSING', label: 'Stripe subscription missing' },
  { value: 'ACTIVE_WITHOUT_SUBSCRIPTION', label: 'Active without subscription' },
  { value: 'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY', label: 'Subscription cancelled unexpectedly' },
  { value: 'SUBSCRIPTION_STATE_MISMATCH', label: 'Subscription state mismatch' },
  { value: 'PAUSE EXPECTATION MISMATCH', label: 'Pause record alignment' },
  { value: 'PAUSE EXPECTATION STALE', label: 'Pause expectation stale' },
  { value: 'INACTIVE_STILL_BILLING', label: 'Inactive still billing' },
  { value: 'PAYMENT_FAILED', label: 'Payment failed' },
];

const ISSUE_VIEW_OPTIONS = [
  { value: 'all', label: 'All active', hint: 'Everything in the current queue.' },
  { value: 'payment_risk', label: 'Payment risk', hint: 'Failed payments and live Stripe/billing mismatches.' },
  { value: 'pause', label: 'Pause checks', hint: 'Pause History, Stripe state, and expectation alignment.' },
  { value: 'setup', label: 'Setup/linking', hint: 'Students not fully connected to Stripe yet.' },
  { value: 'records', label: 'Registry & Sheets', hint: 'Record mismatches between systems.' },
  { value: 'cleared', label: 'Ready to clear', hint: 'No longer detected by the latest source check.' },
];

function freshnessClasses(status) {
  if (status === 'Fresh') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'Aging') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Stale') return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'Current') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'Manual') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'Cleared') return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function isSetupIssue(issue) {
  return [
    'PAYMENT SETUP PENDING',
    'SETUP PENDING STRIPE LINKED',
    'STRIPE SETUP INCOMPLETE',
    'STRIPE CUSTOMER MISSING',
    'STRIPE SUBSCRIPTION MISSING',
  ].includes(issue.type);
}

function isRecordIssue(issue) {
  return [
    'TUTOR CONFLICT',
    'SHEETS ONLY',
    'REGISTRY ONLY',
  ].includes(issue.type);
}

function isPaymentIssue(issue) {
  return [
    'PAYMENT SETUP PENDING',
    'SETUP PENDING STRIPE LINKED',
    'STRIPE SETUP INCOMPLETE',
    'STRIPE CUSTOMER MISSING',
    'STRIPE SUBSCRIPTION MISSING',
    'ACTIVE_WITHOUT_SUBSCRIPTION',
    'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY',
    'SUBSCRIPTION_STATE_MISMATCH',
    'INACTIVE_STILL_BILLING',
    'PAYMENT_FAILED',
    'PAUSE EXPECTATION MISMATCH',
    'PAUSE EXPECTATION STALE',
  ].includes(issue.type);
}

function issueMatchesView(issue, view) {
  if (view === 'payment_risk') {
    return needsLiveStripeReview(issue);
  }
  if (view === 'pause') {
    return isPauseIssue(issue);
  }
  if (view === 'setup') {
    return isSetupIssue(issue);
  }
  if (view === 'records') {
    return isRecordIssue(issue);
  }
  if (view === 'cleared') {
    return ['open', 'acknowledged'].includes(issue.status) && !issue.sourcePresent;
  }
  return true;
}

function needsLiveStripeReview(issue) {
  return [
    'ACTIVE_WITHOUT_SUBSCRIPTION',
    'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY',
    'SUBSCRIPTION_STATE_MISMATCH',
    'INACTIVE_STILL_BILLING',
    'PAYMENT_FAILED',
    'PAUSE EXPECTATION MISMATCH',
    'PAUSE EXPECTATION STALE',
  ].includes(issue.type);
}

function isPauseIssue(issue) {
  return [
    'SUBSCRIPTION_STATE_MISMATCH',
    'PAUSE EXPECTATION MISMATCH',
    'PAUSE EXPECTATION STALE',
  ].includes(issue.type);
}

function shouldRefreshStripeFirst(issue) {
  return [
    'ACTIVE_WITHOUT_SUBSCRIPTION',
    'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY',
    'SUBSCRIPTION_STATE_MISMATCH',
    'INACTIVE_STILL_BILLING',
    'PAYMENT_FAILED',
  ].includes(issue.type);
}

function getPrimaryPaymentQuickAction(issue, actions = []) {
  if (issue.type === 'PAUSE EXPECTATION MISMATCH') {
    return actions.find((action) => action.label === 'Confirm pause and set paused expected') || null;
  }

  if (issue.type === 'PAUSE EXPECTATION STALE') {
    return actions.find((action) => action.label === 'Set Stripe active expected') || null;
  }

  return null;
}

function getIssueKeyFact(issue) {
  if (issue.pauseCoverageContext?.summary && isPauseIssue(issue)) {
    return issue.pauseCoverageContext.summary;
  }

  if (issue.pauseSummary?.latestPause) {
    return `Pause window: ${issue.pauseSummary.latestPause.startDate || '—'} to ${issue.pauseSummary.latestPause.endDate || '—'}`;
  }

  if (issue.type === 'PAYMENT_FAILED' && issue.detail) {
    return issue.detail;
  }

  if (issue.lastSeenAt) {
    return `Last seen: ${formatDateTime(issue.lastSeenAt)}`;
  }

  return '';
}

function getIssueReasonText(issue) {
  if (!issue.sourcePresent) {
    return 'This issue was detected previously, but the latest source check no longer sees it.';
  }

  return isPaymentIssue(issue) ? (issue.paymentReason || issue.summary) : (issue.issueReason || issue.summary);
}

function getRecommendedActionText(issue) {
  if (!issue.sourcePresent) {
    return 'If this matches the current record, mark it resolved. Keep it active only if you want to monitor it manually.';
  }

  if (issue.identityMismatchHint) {
    return `${issue.recommendedAction} Check the possible same-name match before creating or deleting records.`;
  }

  return issue.recommendedAction;
}

function getPaymentActionHint(issue) {
  if (issue.type === 'PAYMENT SETUP PENDING') {
    return 'Usually not a broken billing case yet. Finish setup or deliberately move the student into a different payment mode/expectation.';
  }

  if (issue.type === 'SETUP PENDING STRIPE LINKED') {
    return 'This is probably stale setup state rather than missing Stripe setup. Confirm the student should be live, then mark Stripe active expected.';
  }

  if (['STRIPE SETUP INCOMPLETE', 'STRIPE CUSTOMER MISSING', 'STRIPE SUBSCRIPTION MISSING'].includes(issue.type)) {
    return 'Usually a linkage/setup problem rather than a live billing failure. Check whether setup is still pending before treating it as broken Stripe.';
  }

  if (issue.type === 'PAYMENT_FAILED') {
    return 'This usually needs live Stripe review rather than only a sheet-field correction.';
  }

  if (issue.type === 'SUBSCRIPTION_STATE_MISMATCH') {
    return 'This usually means either the expectation is wrong or Stripe pause/billing state is wrong. Compare both before changing anything else.';
  }

  if (issue.type === 'INACTIVE_STILL_BILLING') {
    return 'The student state and billing state disagree. Keep this active until live Stripe no longer shows billing.';
  }

  if (issue.type === 'ACTIVE_WITHOUT_SUBSCRIPTION' || issue.type === 'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY') {
    return 'Treat this as a real live billing problem first, then use sheet-field changes only if the expectation itself is wrong.';
  }

  return '';
}

function shouldShowLifecycleContext(issue) {
  return Boolean(issue.lifecycleLabel) && (
    isPaymentIssue(issue)
    || ['SHEETS ONLY', 'REGISTRY ONLY'].includes(issue.type)
  );
}

function getLifecycleContextText(issue) {
  const firstWarning = issue.lifecycleWarnings?.[0] || '';
  const firstReason = issue.lifecycleReasons?.[0] || '';
  const explanation = firstWarning || firstReason;

  return [
    `Lifecycle: ${issue.lifecycleLabel}`,
    issue.lifecycleConfidence ? `(${issue.lifecycleConfidence} confidence)` : '',
    explanation ? `— ${explanation}` : '',
  ].filter(Boolean).join(' ');
}

function shouldShowPaymentValueContext(issue) {
  return isPaymentIssue(issue) && Boolean(issue.paymentValueContext?.baselineWeeklyLabel || issue.paymentValueContext?.baselineMonthlyLabel);
}

function getPaymentValueContextText(issue) {
  const value = issue.paymentValueContext || {};
  const weekly = value.baselineWeeklyLabel ? `${value.baselineWeeklyLabel}/week` : '';
  const monthly = value.baselineMonthlyLabel ? `${value.baselineMonthlyLabel}/month` : '';
  const confidence = value.confidence ? `${value.confidence} confidence` : '';

  return [
    'Baseline value:',
    [weekly, monthly].filter(Boolean).join(' · '),
    confidence ? `(${confidence})` : '',
  ].filter(Boolean).join(' ');
}

function getPaymentActionPath(issue) {
  if (issue.type === 'PAYMENT SETUP PENDING') {
    return [
      'Confirm this is genuinely still in setup rather than a broken active billing case.',
      'If setup is complete, move the expectation to Stripe active expected.',
      'If this student will not use Stripe, mark them as a manual payer instead.',
    ];
  }

  if (issue.type === 'SETUP PENDING STRIPE LINKED') {
    return [
      'Confirm the recorded Stripe customer and subscription belong to this student.',
      'If they should now be live, move the expectation to Stripe active expected.',
      'If they are not actually live, choose the correct expectation rather than leaving setup pending by habit.',
    ];
  }

  if (['STRIPE SETUP INCOMPLETE', 'STRIPE CUSTOMER MISSING', 'STRIPE SUBSCRIPTION MISSING'].includes(issue.type)) {
    return [
      'Treat this as a linkage/setup issue before assuming Stripe itself is broken.',
      'Use setup pending if the family is not fully live yet.',
      'If they should already be billing, open the student record and confirm the missing Stripe linkage.',
    ];
  }

  if (issue.type === 'PAYMENT_FAILED') {
    return [
      'Run a one-student live Stripe refresh first.',
      'If the failure is still live, keep the issue active and review the parent/payment follow-up path.',
      'Only downgrade this to setup pending if the student is not really live yet.',
    ];
  }

  if (issue.type === 'SUBSCRIPTION_STATE_MISMATCH') {
    return [
      'Check whether Pause History and payment expectation are correct first.',
      'If the school record is right, refresh live Stripe to confirm the remaining mismatch.',
      'Keep the issue active until live Stripe agrees with the expectation.',
    ];
  }

  if (issue.type === 'PAUSE EXPECTATION MISMATCH') {
    return [
      'Confirm Pause History really means this student is paused now.',
      'If the pause is correct, set payment expectation to Stripe paused expected. Stripe scans verify live billing; they do not update this expectation field automatically.',
      'Refresh Stripe if you need to confirm billing has stopped before resolving.',
    ];
  }

  if (issue.type === 'PAUSE EXPECTATION STALE') {
    return [
      'Confirm the latest pause window has actually ended.',
      'If lessons and billing should be active again, set payment expectation to Stripe active expected.',
      'Refresh Stripe if you need to confirm the subscription is no longer paused.',
    ];
  }

  if (issue.type === 'INACTIVE_STILL_BILLING') {
    return [
      'Confirm the student really should be inactive or stopped.',
      'Refresh live Stripe to confirm billing is still active.',
      'Keep this active until the billing state no longer contradicts the student state.',
    ];
  }

  if (issue.type === 'ACTIVE_WITHOUT_SUBSCRIPTION' || issue.type === 'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY') {
    return [
      'Treat this as a real live Stripe problem first.',
      'Refresh the student Stripe status to confirm the current live state.',
      'Only change the expectation if the school record itself is wrong.',
    ];
  }

  return [];
}

function summariseStripeSnapshot(snapshot, issues = []) {
  if (!snapshot) {
    return '';
  }

  const parts = [];

  if (snapshot.subscriptionFound) {
    parts.push(`Subscription ${snapshot.subscriptionStatus || 'found'}`);
  } else {
    parts.push('No live subscription found');
  }

  if (snapshot.pauseState && snapshot.pauseState !== '—') {
    parts.push(`Pause state: ${snapshot.pauseState}`);
  }

  parts.push(snapshot.activelyBilling ? 'Actively billing' : 'Not actively billing');

  if (snapshot.latestInvoiceStatus && snapshot.latestInvoiceStatus !== '—') {
    parts.push(`Invoice: ${snapshot.latestInvoiceStatus}`);
  }

  if (issues.length) {
    parts.push(`Issues: ${issues.join(', ')}`);
  }

  return parts.join(' • ');
}

export default function AdminIssuesPageClient({ issues, freshness }) {
  const [issueList, setIssueList] = useState(issues);
  const [viewFilter, setViewFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [actionState, setActionState] = useState({ pendingId: '', error: '', success: '' });
  const [stripeScanState, setStripeScanState] = useState({ pending: false, error: '', scannedAt: '', scannedCount: 0 });
  const [stripeRefreshState, setStripeRefreshState] = useState({});

  const LIVE_STRIPE_TYPES = [
    'ACTIVE_WITHOUT_SUBSCRIPTION',
    'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY',
    'SUBSCRIPTION_STATE_MISMATCH',
    'INACTIVE_STILL_BILLING',
    'PAYMENT_FAILED',
  ];

  useEffect(() => {
    setIssueList(issues);
  }, [issues]);

  const filteredIssues = useMemo(
    () =>
      issueList.filter((issue) => {
        if (!issueMatchesView(issue, viewFilter)) return false;
        if (typeFilter !== 'all' && issue.type !== typeFilter) return false;
        if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
        if (systemFilter !== 'all' && !issue.systemsAffected.includes(systemFilter)) return false;
        if (statusFilter === 'active' && !['open', 'acknowledged'].includes(issue.status)) return false;
        if (statusFilter !== 'all' && statusFilter !== 'active' && issue.status !== statusFilter) return false;
        return true;
      }),
    [issueList, severityFilter, statusFilter, systemFilter, typeFilter, viewFilter],
  );
  const visibleSystemClearedIssues = filteredIssues.filter(
    (issue) => ['open', 'acknowledged'].includes(issue.status) && !issue.sourcePresent,
  );

  async function handleDelete(issue) {
    const confirmed = window.confirm(`Delete the registry entry for ${issue.studentName || issue.mmsId}? This will remove their portal-side record but will not touch MMS.`);
    if (!confirmed) return;

    setActionState({ pendingId: issue.id, error: '', success: '' });

    try {
      const response = await fetch(`/api/admin/issues/${issue.mmsId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueType: issue.type, issueId: issue.issueId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', error: payload.error || 'Delete failed', success: '' });
        return;
      }

      setIssueList((current) => current.map((entry) => (
        entry.issueId === issue.issueId
          ? {
            ...entry,
            status: 'resolved',
            sourcePresent: false,
          }
          : entry
      )));
      setActionState({ pendingId: '', error: '', success: '' });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Delete failed', success: '' });
    }
  }

  async function handleCreateRegistry(issue) {
    const fallbackInstrument = `${issue.instrument || ''}`.trim();
    const instrumentPrompt = fallbackInstrument || 'Guitar';
    const instrumentValue = window.prompt(
      `Instrument for ${issue.studentName || issue.mmsId}. Required for registry creation.`,
      instrumentPrompt,
    );

    if (instrumentValue === null) {
      return;
    }

    const trimmedInstrument = instrumentValue.trim();
    if (!trimmedInstrument) {
      setActionState({ pendingId: '', error: 'Instrument is required to create a registry entry.', success: '' });
      return;
    }

    const soundsliceValue = window.prompt(
      `Soundslice URL for ${issue.studentName || issue.mmsId}. Leave blank only if you intentionally want to finish portal setup later.`,
      '',
    );

    if (soundsliceValue === null) {
      return;
    }

    setActionState({ pendingId: issue.issueId, error: '', success: '' });

    try {
      const response = await fetch(`/api/admin/issues/${issue.mmsId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueType: issue.type,
          issueId: issue.issueId,
          action: 'create_registry_entry',
          registryOverrides: {
            instrument: trimmedInstrument,
            soundsliceUrl: soundsliceValue.trim(),
          },
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', error: payload.error || 'Create registry entry failed', success: '' });
        return;
      }

      setIssueList((current) => current.map((entry) => (
        entry.issueId === issue.issueId
          ? {
            ...entry,
            status: 'resolved',
            sourcePresent: false,
            hasRegistryEntry: true,
            registryTutor: payload.student?.registryTutor || entry.registryTutor,
            lifecycleStatus: payload.student?.lifecycleStatus || entry.lifecycleStatus,
            lifecycleLabel: payload.student?.lifecycleLabel || entry.lifecycleLabel,
            lifecycleConfidence: payload.student?.lifecycleConfidence || entry.lifecycleConfidence,
            lifecycleReasons: payload.student?.lifecycleReasons || entry.lifecycleReasons,
            lifecycleWarnings: payload.student?.lifecycleWarnings || entry.lifecycleWarnings,
          }
          : entry
      )));
      setActionState({ pendingId: '', error: '', success: '' });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Create registry entry failed', success: '' });
    }
  }

  async function handleRunStripeScan() {
    setStripeScanState({ pending: true, error: '', scannedAt: '', scannedCount: 0 });

    try {
      const response = await fetch('/api/admin/flags/stripe-scan', {
        method: 'POST',
      });

      const payload = await response.json();

      if (!response.ok) {
        setStripeScanState({ pending: false, error: payload.error || 'Stripe scan failed', scannedAt: '', scannedCount: 0 });
        return;
      }

      setIssueList((current) => {
        const withoutLiveStripe = current.filter((issue) => !LIVE_STRIPE_TYPES.includes(issue.type));
        return [...withoutLiveStripe, ...(payload.issues || [])];
      });

      setStripeScanState({
        pending: false,
        error: '',
        scannedAt: payload.scannedAt || '',
        scannedCount: payload.scannedCount || 0,
      });
    } catch (error) {
      setStripeScanState({ pending: false, error: error.message || 'Stripe scan failed', scannedAt: '', scannedCount: 0 });
    }
  }

  async function handleRefreshIssueStripe(issue) {
    setStripeRefreshState((current) => ({
      ...current,
      [issue.issueId]: {
        ...(current[issue.issueId] || {}),
        loading: true,
        error: '',
      },
    }));

    try {
      const response = await fetch(`/api/admin/students/${issue.mmsId}/stripe`);
      const payload = await response.json();

      if (!response.ok) {
        setStripeRefreshState((current) => ({
          ...current,
          [issue.issueId]: {
            loading: false,
            error: payload.error || 'Stripe refresh failed',
            snapshot: null,
            issues: [],
            skippedReason: '',
          },
        }));
        return;
      }

      setStripeRefreshState((current) => ({
        ...current,
        [issue.issueId]: {
          loading: false,
          error: '',
          snapshot: payload.snapshot || null,
          issues: payload.issues || [],
          skippedReason: payload.skippedReason || '',
        },
      }));
    } catch (error) {
      setStripeRefreshState((current) => ({
        ...current,
        [issue.issueId]: {
          loading: false,
          error: error.message || 'Stripe refresh failed',
          snapshot: null,
          issues: [],
          skippedReason: '',
        },
      }));
    }
  }

  async function handleStatusChange(issue, nextStatus) {
    let note = '';
    if (nextStatus === 'ignored') {
      const prompted = window.prompt(`Optional note for ignoring ${issue.studentName || issue.mmsId}`, issue.resolutionNote || '');
      if (prompted === null) {
        return;
      }
      note = prompted.trim();
    }

    setActionState({ pendingId: issue.issueId, error: '', success: '' });

    try {
      const response = await fetch(`/api/admin/issues/${issue.mmsId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: issue.issueId,
          nextStatus,
          note,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', error: payload.error || 'Issue update failed', success: '' });
        return;
      }

      setIssueList((current) => current.map((entry) => (
        entry.issueId === issue.issueId
          ? {
            ...entry,
            status: payload.issue.status,
            resolutionNote: payload.issue.resolutionNote,
            updatedAt: payload.issue.updatedAt,
            sourcePresent: payload.issue.sourcePresent,
          }
          : entry
      )));
      setActionState({ pendingId: '', error: '', success: '' });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Issue update failed', success: '' });
    }
  }

  async function handleResolveVisibleSystemCleared() {
    if (!visibleSystemClearedIssues.length) {
      return;
    }

    const confirmed = window.confirm(
      `Mark ${visibleSystemClearedIssues.length} system-cleared issue${visibleSystemClearedIssues.length === 1 ? '' : 's'} as resolved? These issues are not currently detected and will reappear if a future source check finds them again.`,
    );

    if (!confirmed) {
      return;
    }

    setActionState({ pendingId: 'bulk-system-cleared', error: '', success: '' });

    try {
      const response = await fetch('/api/admin/issues/system-cleared/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueIds: visibleSystemClearedIssues.map((issue) => issue.issueId),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', error: payload.error || 'Bulk issue update failed', success: '' });
        return;
      }

      const resolvedIssues = payload.issues || [];

      setIssueList((current) => current.map((entry) => {
        const resolved = resolvedIssues.find((issue) => issue.issueId === entry.issueId);
        return resolved
          ? {
            ...entry,
            status: resolved.status,
            resolutionNote: resolved.resolutionNote,
            updatedAt: resolved.updatedAt,
            sourcePresent: resolved.sourcePresent,
          }
          : entry;
      }));

      setActionState({
        pendingId: '',
        error: '',
        success: `Resolved ${payload.resolvedCount || 0} system-cleared issue${payload.resolvedCount === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Bulk issue update failed', success: '' });
    }
  }

  function getPaymentQuickActions(issue) {
    if (issue.paymentMode !== 'stripe' && !['PAYMENT SETUP PENDING', 'SETUP PENDING STRIPE LINKED'].includes(issue.type)) {
      return [];
    }

    if (['PAYMENT SETUP PENDING', 'SETUP PENDING STRIPE LINKED'].includes(issue.type)) {
      return [
        { label: 'Set Stripe active expected', payload: { paymentMode: 'stripe', paymentExpectation: 'stripe_active_expected' } },
        { label: 'Mark manual payer', payload: { paymentMode: 'manual', paymentExpectation: '' } },
      ];
    }

    if (['STRIPE SETUP INCOMPLETE', 'STRIPE CUSTOMER MISSING', 'STRIPE SUBSCRIPTION MISSING'].includes(issue.type)) {
      return [
        { label: 'Set setup pending', payload: { paymentExpectation: 'setup_pending' } },
        { label: 'Mark manual payer', payload: { paymentMode: 'manual', paymentExpectation: '' } },
      ];
    }

    if (issue.type === 'SUBSCRIPTION_STATE_MISMATCH') {
      return [
        { label: 'Set Stripe paused expected', payload: { paymentExpectation: 'stripe_paused_expected' } },
        { label: 'Set Stripe active expected', payload: { paymentExpectation: 'stripe_active_expected' } },
        { label: 'Set inactive / stopped', payload: { paymentExpectation: 'inactive_or_stopped' } },
      ];
    }

    if (issue.type === 'PAUSE EXPECTATION MISMATCH') {
      return [
        { label: 'Confirm pause and set paused expected', payload: { paymentExpectation: 'stripe_paused_expected' } },
        { label: 'Set Stripe active expected', payload: { paymentExpectation: 'stripe_active_expected' } },
      ];
    }

    if (issue.type === 'PAUSE EXPECTATION STALE') {
      return [
        { label: 'Set Stripe active expected', payload: { paymentExpectation: 'stripe_active_expected' } },
        { label: 'Set inactive / stopped', payload: { paymentExpectation: 'inactive_or_stopped' } },
      ];
    }

    if (issue.type === 'INACTIVE_STILL_BILLING') {
      return [
        { label: 'Set Stripe paused expected', payload: { paymentExpectation: 'stripe_paused_expected' } },
        { label: 'Set Stripe active expected', payload: { paymentExpectation: 'stripe_active_expected' } },
      ];
    }

    if (['ACTIVE_WITHOUT_SUBSCRIPTION', 'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY', 'PAYMENT_FAILED'].includes(issue.type)) {
      return [
        { label: 'Set setup pending', payload: { paymentExpectation: 'setup_pending' } },
        { label: 'Mark manual payer', payload: { paymentMode: 'manual', paymentExpectation: '' } },
      ];
    }

    return [];
  }

  async function handlePaymentQuickAction(issue, action) {
    const note = window.prompt(
      `Why are you taking "${action.label}" for ${issue.studentName || issue.mmsId}? This note is saved to the payment audit log.`,
      '',
    );

    if (note === null) {
      return;
    }

    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setActionState({ pendingId: '', error: 'A short note is required for payment actions from the issues page.', success: '' });
      return;
    }

    setActionState({ pendingId: issue.issueId, error: '', success: '' });

    try {
      const response = await fetch(`/api/admin/students/${issue.mmsId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...action.payload,
          auditContext: {
            source: 'admin_flags_payment_action',
            issueId: issue.issueId,
            issueType: issue.type,
            actionLabel: action.label,
            note: trimmedNote,
          },
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', issueId: issue.issueId, error: payload.error || 'Payment action failed', success: '' });
        return;
      }

      // When the action sets the expectation that resolves this flag's condition,
      // clear the card optimistically so it visibly goes away (the next detection
      // pass agrees). Otherwise update the row in place and keep it.
      const nextExpectation = action.payload.paymentExpectation;
      const resolvesIssue = (
        (issue.type === 'PAUSE EXPECTATION MISMATCH' && nextExpectation === 'stripe_paused_expected')
        || (issue.type === 'PAUSE EXPECTATION STALE' && ['stripe_active_expected', 'inactive_or_stopped'].includes(nextExpectation))
      );

      setIssueList((current) => {
        if (resolvesIssue) {
          return current.filter((entry) => entry.issueId !== issue.issueId);
        }
        return current.map((entry) => (
          entry.issueId === issue.issueId
            ? {
              ...entry,
              paymentMode: payload.student.paymentMode || entry.paymentMode,
              paymentExpectation: payload.student.paymentExpectation || '',
              lifecycleStatus: payload.student.lifecycleStatus || entry.lifecycleStatus,
              lifecycleLabel: payload.student.lifecycleLabel || entry.lifecycleLabel,
              lifecycleConfidence: payload.student.lifecycleConfidence || entry.lifecycleConfidence,
              lifecycleReasons: payload.student.lifecycleReasons || entry.lifecycleReasons,
              lifecycleWarnings: payload.student.lifecycleWarnings || entry.lifecycleWarnings,
            }
            : entry
        ));
      });
      const actionLogged = Boolean(payload.audit?.issueActionLogged);
      setActionState({
        pendingId: '',
        issueId: issue.issueId,
        error: '',
        success: resolvesIssue
          ? `Set ${issue.studentName || issue.mmsId} to ${payload.student.paymentExpectation || 'updated'} — flag cleared.`
          : actionLogged
            ? `Payment action logged for ${issue.studentName || issue.mmsId}. The issue remains active until the source check clears it or you resolve it.`
            : `No payment field changed for ${issue.studentName || issue.mmsId}; the issue remains active.`,
      });
    } catch (error) {
      setActionState({ pendingId: '', issueId: issue.issueId, error: error.message || 'Payment action failed', success: '' });
    }
  }

  const activeIssues = issueList.filter((issue) => ['open', 'acknowledged'].includes(issue.status));
  const activeIssueCount = activeIssues.length;
  const activeDetectedIssueCount = activeIssues.filter((issue) => issue.sourcePresent).length;
  const activeRegistryIssueCount = activeIssues.filter((issue) => issue.systemsAffected.includes('Registry')).length;
  const activeSheetsIssueCount = activeIssues.filter((issue) => issue.systemsAffected.includes('Sheets')).length;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold text-slate-900">Flags & Issues</h2>
        <p className="mt-2 text-sm text-slate-600">
          Operational issues queue for data drift, tutor mismatches, and missing cross-system records. This page is intended to become the main review surface for human and future agent triage.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Evidence freshness</h3>
            <p className="mt-1 text-sm text-slate-600">
              Review flags are generated; Sheets/payment issues are checked from the current page load; live Stripe issues come from manual scans.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${freshnessClasses(freshness?.status)}`}>
            Review flags: {freshness?.status || 'Unknown'}
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Latest generated</p>
            <p className="mt-1 text-sm text-slate-800">{formatDateTime(freshness?.latestGeneratedAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Age</p>
            <p className="mt-1 text-sm text-slate-800">
              {typeof freshness?.ageDays === 'number' ? `${freshness.ageDays} day${freshness.ageDays === 1 ? '' : 's'}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Distinct generated dates</p>
            <p className="mt-1 text-sm text-slate-800">{freshness?.distinctGeneratedDates?.length || 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">How to read cards</p>
            <p className="mt-1 text-sm text-slate-800">Use each card&apos;s evidence badge before deciding whether to fix, refresh, or resolve.</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Live Stripe scan</h3>
            <p className="mt-1 text-sm text-slate-600">
              Manual only. This checks Stripe-managed students against the current rule set and adds live payment issues to the queue without polling Stripe on every page load.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunStripeScan}
            disabled={stripeScanState.pending}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {stripeScanState.pending ? 'Scanning…' : 'Run Stripe scan'}
          </button>
        </div>
        {stripeScanState.error ? <p className="mt-3 text-sm text-red-700">{stripeScanState.error}</p> : null}
        {stripeScanState.scannedAt ? (
          <p className="mt-3 text-sm text-slate-600">
            Last Stripe scan: {formatDateTime(stripeScanState.scannedAt)} • Students checked: {stripeScanState.scannedCount}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Active queue issues</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeIssueCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Active + detected</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeDetectedIssueCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Active Registry-related</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeRegistryIssueCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Active Sheets-related</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeSheetsIssueCount}</p>
        </div>
      </section>

      {visibleSystemClearedIssues.length ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-emerald-950">System-cleared issues ready to remove</h3>
              <p className="mt-1 text-sm text-emerald-900">
                {visibleSystemClearedIssues.length} visible issue{visibleSystemClearedIssues.length === 1 ? '' : 's'} are no longer detected by the latest source check. Marking them resolved clears them from the active queue; they will reappear if detected again.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResolveVisibleSystemCleared}
              disabled={actionState.pendingId === 'bulk-system-cleared'}
              className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionState.pendingId === 'bulk-system-cleared' ? 'Resolving…' : 'Resolve system-cleared'}
            </button>
          </div>
        </section>
      ) : null}

      {actionState.error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {actionState.error}
        </section>
      ) : null}
      {actionState.success ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {actionState.success}
        </section>
      ) : null}

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Start here</h3>
          <p className="mt-1 text-sm text-slate-600">
            Use a simple work view first. Exact issue types are still available under advanced filters.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {ISSUE_VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setViewFilter(option.value);
                setTypeFilter('all');
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                viewFilter === option.value
                  ? 'border-blue-300 bg-blue-50 text-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.08)]'
                  : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-200 hover:bg-white'
              }`}
            >
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className={`mt-1 block text-xs leading-5 ${viewFilter === option.value ? 'text-slate-700' : 'text-slate-500'}`}>
                {option.hint}
              </span>
            </button>
          ))}
        </div>
        <details className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Advanced filters
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <Select
              label="Exact issue type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              options={ISSUE_TYPE_OPTIONS}
            />
            <Select
              label="Severity"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              options={[
                { value: 'all', label: 'All severities' },
                { value: 'Needs action', label: 'Needs action' },
                { value: 'Warning', label: 'Warning' },
                { value: 'Info', label: 'Info' },
              ]}
            />
            <Select
              label="System"
              value={systemFilter}
              onChange={(event) => setSystemFilter(event.target.value)}
              options={[
                { value: 'all', label: 'All systems' },
                { value: 'Sheets', label: 'Sheets' },
                { value: 'Registry', label: 'Registry' },
                { value: 'Stripe', label: 'Stripe' },
                { value: 'Pause', label: 'Pause' },
              ]}
            />
            <Select
              label="Queue status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              options={[
                { value: 'active', label: 'Open + acknowledged' },
                { value: 'all', label: 'All statuses' },
                { value: 'open', label: 'Open' },
                { value: 'acknowledged', label: 'Acknowledged' },
                { value: 'ignored', label: 'Ignored' },
                { value: 'resolved', label: 'Resolved' },
              ]}
            />
          </div>
        </details>
      </section>

      <section className="space-y-4">
        {filteredIssues.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No issues match the current filters.
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <article key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {(() => {
                const paymentActionPath = isPaymentIssue(issue) ? getPaymentActionPath(issue) : [];
                const liveStripeState = stripeRefreshState[issue.issueId] || null;
                const paymentQuickActions = getPaymentQuickActions(issue);
                const primaryQuickAction = issue.sourcePresent ? getPrimaryPaymentQuickAction(issue, paymentQuickActions) : null;
                const secondaryQuickActions = issue.sourcePresent
                  ? paymentQuickActions.filter((action) => action.label !== primaryQuickAction?.label)
                  : [];
                const keyFact = getIssueKeyFact(issue);
                const refreshStripeFirst = issue.sourcePresent && shouldRefreshStripeFirst(issue);
                const reasonText = getIssueReasonText(issue);
                const recommendedActionText = getRecommendedActionText(issue);
                const evidence = buildIssueEvidenceSummary(issue, freshness);
                const pauseWorkflow = isPauseIssue(issue)
                  ? buildPauseWorkflowSummary({
                    pauseSummary: issue.pauseSummary,
                    pauseCoverageContext: issue.pauseCoverageContext,
                    paymentExpectation: issue.paymentExpectation || '',
                    stripeSnapshot: liveStripeState?.snapshot || null,
                  })
                  : null;

                return (
                  <>
              <div className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${severityClasses(issue.severity)}`}>{issue.severity}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                        {issue.status}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${issue.sourcePresent ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                        {issue.sourcePresent ? 'Detected now' : 'Not currently detected'}
                      </span>
                      {issue.reappeared ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                          Reappeared
                        </span>
                      ) : null}
                      {issue.status === 'resolved' && issue.sourcePresent ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-800">
                          Resolved but still detected
                        </span>
                      ) : null}
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${freshnessClasses(evidence.status)}`}>
                        {evidence.label}: {evidence.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{issue.type}</p>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">{issue.studentName || issue.mmsId}</h3>
                      <p className="mt-1 text-sm text-slate-700">
                        {reasonText}
                      </p>
                      {keyFact ? (
                        <p className="mt-3 text-sm font-medium text-slate-900">{keyFact}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    <p>{issue.generatedDate || '—'}</p>
                    <p className="mt-1">Last seen: {formatDateTime(issue.lastSeenAt)}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Recommended next action</p>
                  <p className="mt-2 text-sm text-slate-700">{recommendedActionText}</p>
                  {issue.resolutionNote ? (
                    <p className="mt-3 text-sm text-slate-600">
                      Resolution note: {issue.resolutionNote}
                    </p>
                  ) : null}
                  {issue.detail && !isPaymentIssue(issue) ? (
                    <p className="mt-3 text-sm text-slate-600">
                      Source detail: {issue.detail}
                    </p>
                  ) : null}
                  {issue.identityMismatchHint ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {issue.identityMismatchHint.description}
                    </p>
                  ) : null}
                  {shouldShowLifecycleContext(issue) ? (
                    <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950">
                      {getLifecycleContextText(issue)}
                    </p>
                  ) : null}
                  {shouldShowPaymentValueContext(issue) ? (
                    <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                      {getPaymentValueContextText(issue)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                {refreshStripeFirst ? (
                  <button
                    type="button"
                    onClick={() => handleRefreshIssueStripe(issue)}
                    disabled={Boolean(liveStripeState?.loading)}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {liveStripeState?.loading ? 'Checking…' : 'Refresh Stripe'}
                  </button>
                ) : null}
                {primaryQuickAction ? (
                  <button
                    type="button"
                    onClick={() => handlePaymentQuickAction(issue, primaryQuickAction)}
                    disabled={actionState.pendingId === issue.issueId}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionState.pendingId === issue.issueId ? 'Saving…' : primaryQuickAction.label}
                  </button>
                ) : null}
                {actionState.issueId === issue.issueId && (actionState.error || actionState.success) ? (
                  <p className={`basis-full text-sm ${actionState.error ? 'text-red-700' : 'text-emerald-700'}`}>
                    {actionState.error || actionState.success}
                  </p>
                ) : null}
                {issue.adminStudentPath ? (
                  <Link
                    href={issue.adminStudentPath}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Open student record
                  </Link>
                ) : null}
                {issue.type === 'REGISTRY ONLY' ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(issue)}
                    disabled={actionState.pendingId === issue.id}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionState.pendingId === issue.id ? 'Deleting…' : 'Delete registry entry'}
                  </button>
                ) : null}
                {issue.type === 'SHEETS ONLY' ? (
                  <button
                    type="button"
                    onClick={() => handleCreateRegistry(issue)}
                    disabled={actionState.pendingId === issue.issueId}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionState.pendingId === issue.issueId ? 'Creating…' : 'Create registry entry'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleStatusChange(issue, 'acknowledged')}
                  disabled={actionState.pendingId === issue.issueId}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionState.pendingId === issue.issueId ? 'Saving…' : 'Keep active'}
                  </button>
                {!issue.sourcePresent ? (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(issue, 'resolved')}
                    disabled={actionState.pendingId === issue.issueId}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionState.pendingId === issue.issueId ? 'Saving…' : 'Mark resolved'}
                  </button>
                ) : null}
                {!refreshStripeFirst && needsLiveStripeReview(issue) && !primaryQuickAction ? (
                  <button
                    type="button"
                    onClick={() => handleRefreshIssueStripe(issue)}
                    disabled={Boolean(liveStripeState?.loading)}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {liveStripeState?.loading ? 'Checking…' : 'Refresh Stripe'}
                  </button>
                ) : null}
                <details className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                  <summary className="cursor-pointer list-none font-medium text-slate-900">More details</summary>
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(issue, 'ignored')}
                        disabled={actionState.pendingId === issue.issueId}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionState.pendingId === issue.issueId ? 'Saving…' : 'Ignore'}
                      </button>
                      {issue.sourcePresent ? (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(issue, 'resolved')}
                        disabled={actionState.pendingId === issue.issueId}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionState.pendingId === issue.issueId ? 'Saving…' : 'Mark resolved'}
                      </button>
                      ) : null}
                      {!refreshStripeFirst && needsLiveStripeReview(issue) && primaryQuickAction ? (
                        <button
                          type="button"
                          onClick={() => handleRefreshIssueStripe(issue)}
                          disabled={Boolean(liveStripeState?.loading)}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {liveStripeState?.loading ? 'Checking…' : 'Refresh Stripe'}
                        </button>
                      ) : null}
                      {secondaryQuickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handlePaymentQuickAction(issue, action)}
                        disabled={actionState.pendingId === issue.issueId}
                        className="rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionState.pendingId === issue.issueId ? 'Saving…' : action.label}
                      </button>
                      ))}
                    </div>
                    {isPaymentIssue(issue) && getPaymentActionHint(issue) ? (
                      <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                        {getPaymentActionHint(issue)}
                      </p>
                    ) : null}
                    {paymentActionPath.length ? (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Suggested path</p>
                        <ol className="mt-2 space-y-2 text-sm text-slate-700">
                          {paymentActionPath.map((step, index) => (
                            <li key={step} className="flex gap-2">
                              <span className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                                {index + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {pauseWorkflow ? (
                      <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-3">
                        <p className="text-xs uppercase tracking-wide text-violet-800">Pause loop</p>
                        <p className="mt-2 text-sm font-medium text-violet-950">{pauseWorkflow.state}</p>
                        <p className="mt-2 text-sm text-violet-950">{pauseWorkflow.nextAction}</p>
                        {issue.pauseSummary?.matchEvidence ? (
                          <p className="mt-2 text-xs text-violet-900">Evidence: {issue.pauseSummary.matchEvidence}</p>
                        ) : null}
                        {issue.pauseCoverageContext?.summary ? (
                          <p className="mt-2 text-xs text-violet-900">Coverage: {issue.pauseCoverageContext.summary}</p>
                        ) : null}
                        <p className="mt-2 text-xs text-violet-900">Closes when: {pauseWorkflow.closureCondition}</p>
                      </div>
                    ) : null}
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Record state</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          <p>Sheets row: {issue.hasSheetRow ? 'Present' : 'Missing'}</p>
                          <p>Registry entry: {issue.hasRegistryEntry ? 'Present' : 'Missing'}</p>
                          <p>Sheets tutor: {issue.sheetTutor || '—'}</p>
                          <p>Registry tutor: {issue.registryTutor || '—'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Source context</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          <p>Generated: {issue.generatedDate || '—'}</p>
                          <p>Last seen: {formatDateTime(issue.lastSeenAt)}</p>
                          <p>MMS ID: <span className="font-mono text-xs">{issue.mmsId || '—'}</span></p>
                          <p>Issue ID: <span className="font-mono text-xs">{issue.issueId || '—'}</span></p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Evidence</p>
                        <div className="mt-2 space-y-1 text-sm text-slate-700">
                          <p>Source: {evidence.label}</p>
                          <p>Status: {evidence.status}</p>
                          <p>Updated: {formatDateTime(evidence.updatedAt)}</p>
                          <p>{evidence.detail}</p>
                        </div>
                      </div>
                      {issue.lifecycleLabel ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Lifecycle context</p>
                          <div className="mt-2 space-y-1 text-sm text-slate-700">
                            <p>{issue.lifecycleLabel} ({issue.lifecycleConfidence || 'low'} confidence)</p>
                            {issue.lifecycleReasons?.map((reason) => (
                              <p key={reason}>{reason}</p>
                            ))}
                            {issue.lifecycleWarnings?.map((warning) => (
                              <p key={warning} className="text-amber-800">{warning}</p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {issue.identityMismatchHint ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Possible identity match</p>
                          <div className="mt-2 space-y-1 text-sm text-slate-700">
                            <p>System: {issue.identityMismatchHint.system}</p>
                            <p>Name: {issue.identityMismatchHint.studentName || '—'}</p>
                            <p>MMS ID: <span className="font-mono text-xs">{issue.identityMismatchHint.mmsId || '—'}</span></p>
                            <p>Tutor: {issue.identityMismatchHint.tutor || '—'}</p>
                          </div>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Systems involved</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {issue.systemsAffected.map((system) => (
                            <span key={system} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                              {system}
                            </span>
                          ))}
                        </div>
                      </div>
                      {isPaymentIssue(issue) ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500">Payment context</p>
                          <div className="mt-2 space-y-1 text-sm text-slate-700">
                            <p>Payment mode: {issue.paymentMode || '—'}</p>
                            <p>Payment expectation: {issue.paymentExpectation || '—'}</p>
                            <p>Stripe customer: {issue.stripeCustomerId || '—'}</p>
                            <p>Stripe subscription: {issue.stripeSubscriptionId || '—'}</p>
                            <p>Currently paused: {issue.pauseSummary?.hasPauseHistory ? (issue.pauseSummary.currentlyPaused ? 'Yes' : 'No') : 'No pause history'}</p>
                            {issue.pauseSummary?.matchConfidence ? (
                              <p>Pause match: {issue.pauseSummary.matchConfidence} confidence</p>
                            ) : null}
                            {issue.paymentValueContext?.baselineWeeklyLabel || issue.paymentValueContext?.baselineMonthlyLabel ? (
                              <p>
                                Baseline value: {[issue.paymentValueContext.baselineWeeklyLabel ? `${issue.paymentValueContext.baselineWeeklyLabel}/week` : '', issue.paymentValueContext.baselineMonthlyLabel ? `${issue.paymentValueContext.baselineMonthlyLabel}/month` : ''].filter(Boolean).join(' · ')}
                              </p>
                            ) : null}
                            {issue.pauseSummary?.latestPause ? (
                              <p>
                                Latest pause window: {issue.pauseSummary.latestPause.startDate || '—'} to {issue.pauseSummary.latestPause.endDate || '—'}
                              </p>
                            ) : null}
                            {issue.pauseCoverageContext?.summary ? (
                              <p>Likely coverage: {issue.pauseCoverageContext.summary}</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </details>
                </div>
              </div>
              {needsLiveStripeReview(issue) && (liveStripeState?.error || liveStripeState?.skippedReason || liveStripeState?.snapshot) ? (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-800">Latest live Stripe check</p>
                  {liveStripeState?.error ? (
                    <p className="mt-2 text-sm text-red-700">{liveStripeState.error}</p>
                  ) : liveStripeState?.skippedReason ? (
                    <p className="mt-2 text-sm text-slate-700">{liveStripeState.skippedReason}</p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-800">
                      {summariseStripeSnapshot(liveStripeState?.snapshot, liveStripeState?.issues)}
                    </p>
                  )}
                </div>
              ) : null}
                  </>
                );
              })()}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
