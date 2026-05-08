'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/admin/health-helpers.mjs';

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

function freshnessClasses(status) {
  if (status === 'Fresh') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'Aging') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Stale') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function isPaymentIssue(issue) {
  return [
    'PAYMENT SETUP PENDING',
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

function getPaymentActionHint(issue) {
  if (issue.type === 'PAYMENT SETUP PENDING') {
    return 'Usually not a broken billing case yet. Finish setup or deliberately move the student into a different payment mode/expectation.';
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

export default function AdminIssuesPageClient({ issues, freshness }) {
  const [issueList, setIssueList] = useState(issues);
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [actionState, setActionState] = useState({ pendingId: '', error: '' });
  const [stripeScanState, setStripeScanState] = useState({ pending: false, error: '', scannedAt: '', scannedCount: 0 });

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
        if (typeFilter !== 'all' && issue.type !== typeFilter) return false;
        if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
        if (systemFilter !== 'all' && !issue.systemsAffected.includes(systemFilter)) return false;
        if (statusFilter === 'active' && !['open', 'acknowledged'].includes(issue.status)) return false;
        if (statusFilter !== 'all' && statusFilter !== 'active' && issue.status !== statusFilter) return false;
        return true;
      }),
    [issueList, severityFilter, statusFilter, systemFilter, typeFilter],
  );

  async function handleDelete(issue) {
    const confirmed = window.confirm(`Delete the registry entry for ${issue.studentName || issue.mmsId}? This will remove their portal-side record but will not touch MMS.`);
    if (!confirmed) return;

    setActionState({ pendingId: issue.id, error: '' });

    try {
      const response = await fetch(`/api/admin/issues/${issue.mmsId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueType: issue.type, issueId: issue.issueId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', error: payload.error || 'Delete failed' });
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
      setActionState({ pendingId: '', error: '' });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Delete failed' });
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
      setActionState({ pendingId: '', error: 'Instrument is required to create a registry entry.' });
      return;
    }

    const soundsliceValue = window.prompt(
      `Soundslice URL for ${issue.studentName || issue.mmsId}. Leave blank only if you intentionally want to finish portal setup later.`,
      '',
    );

    if (soundsliceValue === null) {
      return;
    }

    setActionState({ pendingId: issue.issueId, error: '' });

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
        setActionState({ pendingId: '', error: payload.error || 'Create registry entry failed' });
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
          }
          : entry
      )));
      setActionState({ pendingId: '', error: '' });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Create registry entry failed' });
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

  async function handleStatusChange(issue, nextStatus) {
    let note = '';
    if (nextStatus === 'ignored') {
      const prompted = window.prompt(`Optional note for ignoring ${issue.studentName || issue.mmsId}`, issue.resolutionNote || '');
      if (prompted === null) {
        return;
      }
      note = prompted.trim();
    }

    setActionState({ pendingId: issue.issueId, error: '' });

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
        setActionState({ pendingId: '', error: payload.error || 'Issue update failed' });
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
      setActionState({ pendingId: '', error: '' });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Issue update failed' });
    }
  }

  function getPaymentQuickActions(issue) {
    if (issue.paymentMode !== 'stripe' && issue.type !== 'PAYMENT SETUP PENDING') {
      return [];
    }

    if (issue.type === 'PAYMENT SETUP PENDING') {
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
        { label: 'Set Stripe paused expected', payload: { paymentExpectation: 'stripe_paused_expected' } },
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
    setActionState({ pendingId: issue.issueId, error: '' });

    try {
      const response = await fetch(`/api/admin/students/${issue.mmsId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', error: payload.error || 'Payment action failed' });
        return;
      }

      setIssueList((current) => current.map((entry) => (
        entry.issueId === issue.issueId
          ? {
            ...entry,
            paymentMode: payload.student.paymentMode || entry.paymentMode,
            paymentExpectation: payload.student.paymentExpectation || '',
          }
          : entry
      )));
      setActionState({ pendingId: '', error: '' });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Payment action failed' });
    }
  }

  const activeIssueCount = issueList.filter((issue) => ['open', 'acknowledged'].includes(issue.status)).length;
  const detectedIssueCount = issueList.filter((issue) => issue.sourcePresent).length;

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
            <h3 className="text-sm font-semibold text-slate-900">Review flags freshness</h3>
            <p className="mt-1 text-sm text-slate-600">{freshness?.statusDetail || 'Freshness unknown.'}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${freshnessClasses(freshness?.status)}`}>
            {freshness?.status || 'Unknown'}
          </span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
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
          <p className="text-sm text-slate-500">Currently detected</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{detectedIssueCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Registry-related</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{issueList.filter((issue) => issue.systemsAffected.includes('Registry')).length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Sheets-related</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{issueList.filter((issue) => issue.systemsAffected.includes('Sheets')).length}</p>
        </div>
      </section>

      {actionState.error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {actionState.error}
        </section>
      ) : null}

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-4">
        <Select
          label="Issue type"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          options={[
            { value: 'all', label: 'All types' },
            { value: 'TUTOR CONFLICT', label: 'Tutor conflict' },
            { value: 'SHEETS ONLY', label: 'Sheets only' },
            { value: 'REGISTRY ONLY', label: 'Registry only' },
            { value: 'PAYMENT SETUP PENDING', label: 'Payment setup pending' },
            { value: 'STRIPE SETUP INCOMPLETE', label: 'Stripe setup incomplete' },
            { value: 'STRIPE CUSTOMER MISSING', label: 'Stripe customer missing' },
            { value: 'STRIPE SUBSCRIPTION MISSING', label: 'Stripe subscription missing' },
            { value: 'ACTIVE_WITHOUT_SUBSCRIPTION', label: 'Active without subscription' },
            { value: 'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY', label: 'Subscription cancelled unexpectedly' },
            { value: 'SUBSCRIPTION_STATE_MISMATCH', label: 'Subscription state mismatch' },
            { value: 'PAUSE EXPECTATION MISMATCH', label: 'Pause expectation mismatch' },
            { value: 'PAUSE EXPECTATION STALE', label: 'Pause expectation stale' },
            { value: 'INACTIVE_STILL_BILLING', label: 'Inactive still billing' },
            { value: 'PAYMENT_FAILED', label: 'Payment failed' },
          ]}
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
      </section>

      <section className="space-y-4">
        {filteredIssues.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            No issues match the current filters.
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <article key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${severityClasses(issue.severity)}`}>{issue.severity}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">{issue.type}</span>
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
                    {issue.systemsAffected.map((system) => (
                      <span key={system} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                        {system}
                      </span>
                    ))}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{issue.studentName || issue.mmsId}</h3>
                    <p className="mt-1 text-sm text-slate-600">{issue.summary}</p>
                  </div>
                </div>
                <div className="text-sm text-slate-500">
                  <p>{issue.generatedDate || '—'}</p>
                  <p className="mt-1">Last seen: {formatDateTime(issue.lastSeenAt)}</p>
                  <p className="mt-1 font-mono text-xs">{issue.mmsId || '—'}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Why this issue exists</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {isPaymentIssue(issue) ? (issue.paymentReason || issue.summary) : (issue.issueReason || issue.summary)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Current record state</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    <p>Sheets row: {issue.hasSheetRow ? 'Present' : 'Missing'}</p>
                    <p>Registry entry: {issue.hasRegistryEntry ? 'Present' : 'Missing'}</p>
                    <p>Sheets tutor: {issue.sheetTutor || '—'}</p>
                    <p>Registry tutor: {issue.registryTutor || '—'}</p>
                    {!isPaymentIssue(issue) ? (
                      <>
                        <p>Payment mode: {issue.paymentMode || '—'}</p>
                        <p>Payment expectation: {issue.paymentExpectation || '—'}</p>
                        <p>Stripe customer: {issue.stripeCustomerId || '—'}</p>
                        <p>Stripe subscription: {issue.stripeSubscriptionId || '—'}</p>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Recommended next action</p>
                  <p className="mt-2 text-sm text-slate-700">{issue.recommendedAction}</p>
                  {isPaymentIssue(issue) && getPaymentActionHint(issue) ? (
                    <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                      {getPaymentActionHint(issue)}
                    </p>
                  ) : null}
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
                </div>
              </div>

              {isPaymentIssue(issue) ? (
                <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">
                    More payment context
                  </summary>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Payment context</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        <p>Payment mode: {issue.paymentMode || '—'}</p>
                        <p>Payment expectation: {issue.paymentExpectation || '—'}</p>
                        <p>Stripe customer: {issue.stripeCustomerId || '—'}</p>
                        <p>Stripe subscription: {issue.stripeSubscriptionId || '—'}</p>
                        <p>Currently paused: {issue.pauseSummary?.hasPauseHistory ? (issue.pauseSummary.currentlyPaused ? 'Yes' : 'No') : 'No pause history'}</p>
                        {issue.pauseSummary?.latestPause ? (
                          <p>
                            Latest pause window: {issue.pauseSummary.latestPause.startDate || '—'} to {issue.pauseSummary.latestPause.endDate || '—'}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Record state</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        <p>Sheets row: {issue.hasSheetRow ? 'Present' : 'Missing'}</p>
                        <p>Registry entry: {issue.hasRegistryEntry ? 'Present' : 'Missing'}</p>
                        <p>Sheets tutor: {issue.sheetTutor || '—'}</p>
                        <p>Registry tutor: {issue.registryTutor || '—'}</p>
                      </div>
                    </div>
                  </div>
                </details>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
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
                <button
                  type="button"
                  onClick={() => handleStatusChange(issue, 'ignored')}
                  disabled={actionState.pendingId === issue.issueId}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionState.pendingId === issue.issueId ? 'Saving…' : 'Ignore'}
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(issue, 'resolved')}
                  disabled={actionState.pendingId === issue.issueId}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {actionState.pendingId === issue.issueId ? 'Saving…' : 'Mark resolved'}
                  </button>
                {getPaymentQuickActions(issue).length ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">Quick fixes</span>
                    {getPaymentQuickActions(issue).map((action) => (
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
                ) : null}
                <span className="text-sm text-slate-500">
                  {issue.actionLabel}
                  {issue.messageable ? ' • future messageable issue' : ' • manual review for now'}
                </span>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
