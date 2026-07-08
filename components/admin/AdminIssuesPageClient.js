'use client';

import { useEffect, useMemo, useState } from 'react';
import { SelectField } from '@/components/admin/ui/fields';
import { SlideOverPanel, panelActionClass } from '@/components/admin/ui/SlideOverPanel';
import IssueCard from '@/components/admin/issues/IssueCard';
import { formatDateTime } from '@/lib/admin/health-helpers.mjs';
import {
  ISSUE_TYPE_OPTIONS,
  ISSUE_VIEW_OPTIONS,
  freshnessClasses,
  buildPaymentQuickActionAuditNote,
  paymentQuickActionResolvesIssue,
  issueMatchesView,
} from '@/lib/admin/issues-client-helpers.mjs';

export default function AdminIssuesPageClient({ issues, freshness }) {
  const [issueList, setIssueList] = useState(issues);
  const [viewFilter, setViewFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [actionState, setActionState] = useState({ pendingId: '', error: '', success: '' });
  const [copiedEmailIssueId, setCopiedEmailIssueId] = useState('');
  // issueId -> { message, fading } for the brief "Sorted ✓" beat before a card leaves the queue.
  const [fadingIssues, setFadingIssues] = useState({});
  // { path, name } when the student-record slide-over is open; null when closed.
  const [recordPanel, setRecordPanel] = useState(null);

  // Show a card's "Sorted ✓" state, let it sit briefly, fade it, then run the list mutation.
  function startSortedFade(issueId, message, mutate) {
    setFadingIssues((current) => ({ ...current, [issueId]: { message, fading: false } }));
    window.setTimeout(() => {
      setFadingIssues((current) => (
        current[issueId] ? { ...current, [issueId]: { ...current[issueId], fading: true } } : current
      ));
    }, 800);
    window.setTimeout(() => {
      mutate();
      setFadingIssues((current) => {
        const next = { ...current };
        delete next[issueId];
        return next;
      });
    }, 1600);
  }

  async function copyEmail(issue) {
    if (!issue.email) return;
    try {
      await navigator.clipboard.writeText(issue.email);
    } catch {
      // best-effort; clipboard may be unavailable
    }
    setCopiedEmailIssueId(issue.issueId);
    window.setTimeout(() => setCopiedEmailIssueId((current) => (current === issue.issueId ? '' : current)), 1800);
  }
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

  useEffect(() => {
    if (!recordPanel) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') setRecordPanel(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recordPanel]);

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
    const confirmed = window.confirm(`Remove ${issue.studentName || issue.mmsId} from the portal? This deletes their portal access and dashboard record but will not touch MMS.`);
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

      setActionState({ pendingId: '', error: '', success: '' });
      startSortedFade(
        issue.issueId,
        'Deleted registry entry — done.',
        () => setIssueList((current) => current.map((entry) => (
          entry.issueId === issue.issueId
            ? {
              ...entry,
              status: 'resolved',
              sourcePresent: false,
            }
            : entry
        ))),
      );
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

      setActionState({ pendingId: '', error: '', success: '' });
      startSortedFade(
        issue.issueId,
        'Created registry entry — nice one.',
        () => setIssueList((current) => current.map((entry) => (
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
        ))),
      );
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

      // The endpoint re-evaluates the live rules. If this issue's type is no longer
      // detected against the fresh snapshot, the live state now matches the dashboard
      // expectation — close the loop: persist the resolution and give the "Sorted ✓" beat.
      const freshIssues = payload.issues || [];
      const clearedByLiveCheck = (
        LIVE_STRIPE_TYPES.includes(issue.type)
        && issue.sourcePresent
        && Boolean(payload.snapshot)
        && !freshIssues.includes(issue.type)
      );

      if (clearedByLiveCheck) {
        try {
          await fetch(`/api/admin/issues/${issue.mmsId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              issueId: issue.issueId,
              nextStatus: 'resolved',
              note: 'Cleared by live Stripe refresh — Stripe now matches the dashboard expectation.',
            }),
          });
        } catch {
          // Best-effort persistence; the optimistic clear below still applies for this session.
        }
        startSortedFade(
          issue.issueId,
          'Stripe now matches the dashboard — resolved.',
          () => setIssueList((current) => current.map((entry) => (
            entry.issueId === issue.issueId
              ? { ...entry, status: 'resolved', sourcePresent: false }
              : entry
          ))),
        );
      }
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

      const applyUpdate = () => setIssueList((current) => current.map((entry) => (
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

      // Resolving or ignoring takes the card out of the active queue — give it the
      // brief "Sorted ✓" beat first. Keeping active stays in place, no beat.
      if (['resolved', 'ignored'].includes(nextStatus)) {
        setActionState({ pendingId: '', error: '', success: '' });
        const beat = nextStatus === 'resolved' ? 'Marked resolved — done.' : 'Ignored — done.';
        startSortedFade(issue.issueId, beat, applyUpdate);
        return;
      }

      applyUpdate();
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
      `Clear ${visibleSystemClearedIssues.length} fixed issue${visibleSystemClearedIssues.length === 1 ? '' : 's'}? The system no longer detects ${visibleSystemClearedIssues.length === 1 ? 'it' : 'them'} — cleared issues will reappear if a future check finds them again.`,
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
        success: `Cleared ${payload.resolvedCount || 0} fixed issue${payload.resolvedCount === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      setActionState({ pendingId: '', error: error.message || 'Bulk issue update failed', success: '' });
    }
  }

  async function handlePaymentQuickAction(issue, action) {
    const auditNote = buildPaymentQuickActionAuditNote(issue, action);

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
            note: auditNote,
          },
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', issueId: issue.issueId, error: payload.error || 'Payment action failed', success: '' });
        return;
      }

      const resolvesIssue = paymentQuickActionResolvesIssue(issue, action);

      // When the action resolves this flag's condition, show a brief "Sorted ✓" beat
      // and then clear the card (the next detection pass agrees). Otherwise update the
      // row in place and keep it.
      if (resolvesIssue) {
        try {
          await fetch(`/api/admin/issues/${issue.mmsId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              issueId: issue.issueId,
              nextStatus: 'resolved',
              note: auditNote,
            }),
          });
        } catch {
          // Best-effort persistence; the optimistic clear below still applies for this session.
        }
        setActionState({ pendingId: '', issueId: '', error: '', success: '' });
        startSortedFade(
          issue.issueId,
          `Set to ${payload.student.paymentExpectation || 'updated'} — nice one.`,
          () => setIssueList((current) => current.filter((entry) => entry.issueId !== issue.issueId)),
        );
        return;
      }

      setIssueList((current) => current.map((entry) => (
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
      )));
      const actionLogged = Boolean(payload.audit?.issueActionLogged);
      setActionState({
        pendingId: '',
        issueId: issue.issueId,
        error: '',
        success: actionLogged
          ? `Payment action logged for ${issue.studentName || issue.mmsId}. The issue remains active until the source check clears it or you resolve it.`
          : `No payment field changed for ${issue.studentName || issue.mmsId}; the issue remains active.`,
      });
    } catch (error) {
      setActionState({ pendingId: '', issueId: issue.issueId, error: error.message || 'Payment action failed', success: '' });
    }
  }

  async function handlePracticeFollowUpHandled(issue) {
    setActionState({ pendingId: issue.issueId, error: '', success: '' });

    try {
      const response = await fetch('/api/admin/practice-notes/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryKey: issue.practiceNote?.deliveryKey || '',
          noteId: issue.practiceNote?.noteId || '',
          mmsId: issue.mmsId,
          studentName: issue.studentName || '',
          issueId: issue.issueId,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingId: '', issueId: issue.issueId, error: payload.error || 'Follow-up update failed', success: '' });
        return;
      }

      try {
        await fetch(`/api/admin/issues/${issue.mmsId}/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueId: issue.issueId,
            nextStatus: 'resolved',
            note: 'Follow-up handled — parent note dealt with manually.',
          }),
        });
      } catch {
        // Best-effort persistence; the optimistic clear below still applies for this session.
      }

      setActionState({ pendingId: '', issueId: '', error: '', success: '' });
      startSortedFade(
        issue.issueId,
        'Follow-up handled — nice one.',
        () => setIssueList((current) => current.filter((entry) => entry.issueId !== issue.issueId)),
      );
    } catch (error) {
      setActionState({ pendingId: '', issueId: issue.issueId, error: error.message || 'Follow-up update failed', success: '' });
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
              <h3 className="text-sm font-semibold text-emerald-950">Fixed issues ready to clear</h3>
              <p className="mt-1 text-sm text-emerald-900">
                {visibleSystemClearedIssues.length} visible issue{visibleSystemClearedIssues.length === 1 ? ' is' : 's are'} no longer detected by the latest source check. Clearing removes them from the active queue; they will reappear if detected again.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResolveVisibleSystemCleared}
              disabled={actionState.pendingId === 'bulk-system-cleared'}
              className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionState.pendingId === 'bulk-system-cleared' ? 'Clearing…' : 'Clear fixed issues'}
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
            <SelectField
              label="Exact issue type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              options={ISSUE_TYPE_OPTIONS}
            />
            <SelectField
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
            <SelectField
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
            <SelectField
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
            <IssueCard
              key={issue.id}
              issue={issue}
              freshness={freshness}
              fadingEntry={fadingIssues[issue.issueId] || null}
              liveStripeState={stripeRefreshState[issue.issueId] || null}
              actionState={actionState}
              copiedEmailIssueId={copiedEmailIssueId}
              onStatusChange={handleStatusChange}
              onRefreshStripe={handleRefreshIssueStripe}
              onPaymentQuickAction={handlePaymentQuickAction}
              onCreateRegistry={handleCreateRegistry}
              onDelete={handleDelete}
              onPracticeFollowUpHandled={handlePracticeFollowUpHandled}
              onCopyEmail={copyEmail}
              onOpenRecord={setRecordPanel}
            />
          ))
        )}
      </section>

      {recordPanel ? (
        <SlideOverPanel
          eyebrow="Student record"
          title={recordPanel.name}
          onClose={() => setRecordPanel(null)}
          actions={(
            <a href={recordPanel.path} target="_blank" rel="noreferrer" className={panelActionClass}>
              Open in full page ↗
            </a>
          )}
        >
          <iframe
            key={recordPanel.path}
            src={recordPanel.path}
            title={`Student record: ${recordPanel.name}`}
            className="h-full w-full flex-1 border-0"
          />
        </SlideOverPanel>
      ) : null}
    </div>
  );
}
