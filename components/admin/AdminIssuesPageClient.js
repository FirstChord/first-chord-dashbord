'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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

export default function AdminIssuesPageClient({ issues, freshness }) {
  const [issueList, setIssueList] = useState(issues);
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');
  const [actionState, setActionState] = useState({ pendingId: '', error: '' });
  const [stripeScanState, setStripeScanState] = useState({ pending: false, error: '', scannedAt: '', scannedCount: 0 });

  const LIVE_STRIPE_TYPES = [
    'ACTIVE_WITHOUT_SUBSCRIPTION',
    'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY',
    'SUBSCRIPTION_STATE_MISMATCH',
    'INACTIVE_STILL_BILLING',
    'PAYMENT_FAILED',
  ];

  const filteredIssues = useMemo(
    () =>
      issueList.filter((issue) => {
        if (typeFilter !== 'all' && issue.type !== typeFilter) return false;
        if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
        if (systemFilter !== 'all' && !issue.systemsAffected.includes(systemFilter)) return false;
        return true;
      }),
    [issueList, severityFilter, systemFilter, typeFilter],
  );

  async function handleDelete(issue) {
    const confirmed = window.confirm(`Delete the registry entry for ${issue.studentName || issue.mmsId}? This will remove their portal-side record but will not touch MMS.`);
    if (!confirmed) return;

    setActionState({ pendingId: issue.id, error: '' });

    try {
      const response = await fetch(`/api/admin/issues/${issue.mmsId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueType: issue.type }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', error: payload.error || 'Delete failed' });
        return;
      }

      setIssueList((current) => current.filter((entry) => entry.id !== issue.id));
      setActionState({ pendingId: '', error: '' });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Delete failed' });
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
          <p className="text-sm text-slate-500">Open issues</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{issueList.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Needs action</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{issueList.filter((issue) => issue.severity === 'Needs action').length}</p>
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

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
        <Select
          label="Issue type"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          options={[
            { value: 'all', label: 'All types' },
            { value: 'TUTOR CONFLICT', label: 'Tutor conflict' },
            { value: 'SHEETS ONLY', label: 'Sheets only' },
            { value: 'REGISTRY ONLY', label: 'Registry only' },
            { value: 'STRIPE SETUP INCOMPLETE', label: 'Stripe setup incomplete' },
            { value: 'STRIPE CUSTOMER MISSING', label: 'Stripe customer missing' },
            { value: 'STRIPE SUBSCRIPTION MISSING', label: 'Stripe subscription missing' },
            { value: 'ACTIVE_WITHOUT_SUBSCRIPTION', label: 'Active without subscription' },
            { value: 'SUBSCRIPTION_CANCELLED_UNEXPECTEDLY', label: 'Subscription cancelled unexpectedly' },
            { value: 'SUBSCRIPTION_STATE_MISMATCH', label: 'Subscription state mismatch' },
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
                  <p className="mt-1 font-mono text-xs">{issue.mmsId || '—'}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Detail</p>
                  <p className="mt-2 text-sm text-slate-700">{issue.detail || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Current record state</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    <p>Sheets row: {issue.hasSheetRow ? 'Present' : 'Missing'}</p>
                    <p>Registry entry: {issue.hasRegistryEntry ? 'Present' : 'Missing'}</p>
                    <p>Sheets tutor: {issue.sheetTutor || '—'}</p>
                    <p>Registry tutor: {issue.registryTutor || '—'}</p>
                    <p>Payment mode: {issue.paymentMode || '—'}</p>
                    <p>Payment expectation: {issue.paymentExpectation || '—'}</p>
                    <p>Stripe customer: {issue.stripeCustomerId || '—'}</p>
                    <p>Stripe subscription: {issue.stripeSubscriptionId || '—'}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Recommended next action</p>
                  <p className="mt-2 text-sm text-slate-700">{issue.recommendedAction}</p>
                </div>
              </div>

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
