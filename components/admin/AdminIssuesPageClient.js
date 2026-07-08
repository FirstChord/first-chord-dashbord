'use client';

import { useEffect, useMemo, useState } from 'react';
import { AgeChip } from '@/components/admin/ui/AgeChip';
import { SelectField } from '@/components/admin/ui/fields';
import { SlideOverPanel, panelActionClass } from '@/components/admin/ui/SlideOverPanel';
import { buildIssueEvidenceSummary, formatDateTime } from '@/lib/admin/health-helpers.mjs';
import { buildPauseWorkflowSummary } from '@/lib/admin/pause-workflow-helpers.mjs';
import {
  ISSUE_TYPE_OPTIONS,
  ISSUE_VIEW_OPTIONS,
  freshnessClasses,
  buildPaymentQuickActionAuditNote,
  paymentQuickActionResolvesIssue,
  isPaymentIssue,
  issueMatchesView,
  needsLiveStripeReview,
  isPauseIssue,
  shouldRefreshStripeFirst,
  getPrimaryPaymentQuickAction,
  getIssueKeyFact,
  getRecommendedActionText,
  getPaymentActionHint,
  shouldShowLifecycleContext,
  getLifecycleContextText,
  shouldShowPaymentValueContext,
  getPaymentValueContextText,
  getPaymentActionPath,
  getStudentLabel,
  getIssueStory,
  getIssueWhatToDo,
  getIssueCategoryLabel,
  severityEdgeClass,
  summariseStripeSnapshot,
} from '@/lib/admin/issues-client-helpers.mjs';

const STRIPE_DASHBOARD_BASE = process.env.NEXT_PUBLIC_STRIPE_DASHBOARD_BASE_URL || 'https://dashboard.stripe.com';

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

  function getPaymentQuickActions(issue) {
    if (issue.paymentMode !== 'stripe' && !['PAYMENT SETUP PENDING', 'SETUP PENDING STRIPE LINKED'].includes(issue.type)) {
      return [];
    }

    if (['PAYMENT SETUP PENDING', 'SETUP PENDING STRIPE LINKED'].includes(issue.type)) {
      return [
        { label: 'Expect payments active', payload: { paymentMode: 'stripe', paymentExpectation: 'stripe_active_expected' } },
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
        { label: 'Expect payments active', payload: { paymentExpectation: 'stripe_active_expected' } },
        { label: 'Set inactive / stopped', payload: { paymentExpectation: 'inactive_or_stopped' } },
      ];
    }

    if (issue.type === 'PAUSE EXPECTATION MISMATCH') {
      return [
        { label: 'Confirm pause — expect payments paused', payload: { paymentExpectation: 'stripe_paused_expected' } },
        { label: 'Expect payments active', payload: { paymentExpectation: 'stripe_active_expected' } },
      ];
    }

    if (issue.type === 'PAUSE EXPECTATION STALE') {
      return [
        { label: 'Expect payments active', payload: { paymentExpectation: 'stripe_active_expected' } },
        { label: 'Set inactive / stopped', payload: { paymentExpectation: 'inactive_or_stopped' } },
      ];
    }

    if (issue.type === 'INACTIVE_STILL_BILLING') {
      return [
        { label: 'Set Stripe paused expected', payload: { paymentExpectation: 'stripe_paused_expected' } },
        { label: 'Expect payments active', payload: { paymentExpectation: 'stripe_active_expected' } },
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
            <article
              key={issue.id}
              className={`rounded-2xl border bg-white p-6 shadow-sm transition-opacity duration-700 ${severityEdgeClass(issue.severity)} ${fadingIssues[issue.issueId] ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}
              style={fadingIssues[issue.issueId]?.fading ? { opacity: 0 } : undefined}
            >
              {(() => {
                const fadingEntry = fadingIssues[issue.issueId] || null;
                if (fadingEntry) {
                  return (
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-lg text-emerald-600" aria-hidden>✓</span>
                      <div>
                        <p className="text-base font-semibold text-emerald-900">
                          {getStudentLabel(issue)} — sorted
                        </p>
                        <p className="mt-1 text-sm text-emerald-800">{fadingEntry.message}</p>
                      </div>
                    </div>
                  );
                }
                const paymentActionPath = isPaymentIssue(issue) ? getPaymentActionPath(issue) : [];
                const liveStripeState = stripeRefreshState[issue.issueId] || null;
                const paymentQuickActions = getPaymentQuickActions(issue);
                const primaryQuickAction = issue.sourcePresent ? getPrimaryPaymentQuickAction(issue, paymentQuickActions) : null;
                const secondaryQuickActions = issue.sourcePresent
                  ? paymentQuickActions.filter((action) => action.label !== primaryQuickAction?.label)
                  : [];
                const keyFact = getIssueKeyFact(issue);
                const refreshStripeFirst = issue.sourcePresent && shouldRefreshStripeFirst(issue);
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

                // One obvious primary action per card; everything else lives under Details.
                let primaryKind = 'none';
                if (!issue.sourcePresent) primaryKind = 'resolve';
                else if (refreshStripeFirst) primaryKind = 'refresh';
                else if (primaryQuickAction) primaryKind = 'quick';
                else if (needsLiveStripeReview(issue)) primaryKind = 'refresh';
                else if (issue.type === 'SHEETS ONLY') primaryKind = 'create';
                else if (issue.type === 'PRACTICE NOTE DELIVERY FAILED' && issue.practiceNote) primaryKind = 'follow_up';
                else if (issue.adminStudentPath) primaryKind = 'open';

                return (
                  <>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">{getStudentLabel(issue)}</h3>
                      {issue.reappeared ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          Reappeared
                        </span>
                      ) : null}
                      {!issue.sourcePresent ? (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          No longer detected
                        </span>
                      ) : null}
                      {issue.status === 'resolved' && issue.sourcePresent ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800">
                          Resolved but still detected
                        </span>
                      ) : null}
                      <AgeChip updatedAt={issue.updatedAt} />
                    </div>
                    <p className="text-base leading-relaxed text-slate-800">{getIssueStory(issue)}</p>
                    {getIssueWhatToDo(issue) ? (
                      <p className="text-sm text-slate-500">
                        <span className="font-medium text-slate-600">What to do:</span> {getIssueWhatToDo(issue)}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-400">
                    {getIssueCategoryLabel(issue)} · {issue.severity?.toLowerCase()}
                  </span>
                </div>

                {issue.identityMismatchHint ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {issue.identityMismatchHint.description}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                {primaryKind === 'resolve' ? (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(issue, 'resolved')}
                    disabled={actionState.pendingId === issue.issueId}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionState.pendingId === issue.issueId ? 'Saving…' : 'Mark resolved'}
                  </button>
                ) : null}
                {primaryKind === 'refresh' ? (
                  <button
                    type="button"
                    onClick={() => handleRefreshIssueStripe(issue)}
                    disabled={Boolean(liveStripeState?.loading)}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {liveStripeState?.loading ? 'Checking…' : 'Refresh Stripe'}
                  </button>
                ) : null}
                {primaryKind === 'quick' && primaryQuickAction ? (
                  <button
                    type="button"
                    onClick={() => handlePaymentQuickAction(issue, primaryQuickAction)}
                    disabled={actionState.pendingId === issue.issueId}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionState.pendingId === issue.issueId ? 'Saving…' : primaryQuickAction.label}
                  </button>
                ) : null}
                {primaryKind === 'create' ? (
                  <button
                    type="button"
                    onClick={() => handleCreateRegistry(issue)}
                    disabled={actionState.pendingId === issue.issueId}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionState.pendingId === issue.issueId ? 'Creating…' : 'Create registry entry'}
                  </button>
                ) : null}
                {primaryKind === 'follow_up' ? (
                  <>
                    {issue.adminStudentPath ? (
                      <button
                        type="button"
                        onClick={() => setRecordPanel({ path: issue.adminStudentPath, name: getStudentLabel(issue) })}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                      >
                        Open student record
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handlePracticeFollowUpHandled(issue)}
                      disabled={actionState.pendingId === issue.issueId}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {actionState.pendingId === issue.issueId ? 'Saving…' : 'Mark follow-up handled'}
                    </button>
                  </>
                ) : null}
                {primaryKind === 'open' && issue.adminStudentPath ? (
                  <button
                    type="button"
                    onClick={() => setRecordPanel({ path: issue.adminStudentPath, name: getStudentLabel(issue) })}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Open student record
                  </button>
                ) : null}
                {issue.stripeCustomerId ? (
                  <a
                    href={`${STRIPE_DASHBOARD_BASE}/customers/${encodeURIComponent(issue.stripeCustomerId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 transition hover:bg-violet-100"
                  >
                    View customer in Stripe ↗
                  </a>
                ) : null}
                <details className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                  <summary className="cursor-pointer list-none font-medium text-slate-900">Details</summary>
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap gap-3">
                      {issue.email ? (
                        <button
                          type="button"
                          onClick={() => copyEmail(issue)}
                          title="Copy email to search in Stripe"
                          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                        >
                          {copiedEmailIssueId === issue.issueId ? 'Email copied ✓' : `Copy email: ${issue.email}`}
                        </button>
                      ) : null}
                      {issue.adminStudentPath && primaryKind !== 'open' ? (
                        <button
                          type="button"
                          onClick={() => setRecordPanel({ path: issue.adminStudentPath, name: getStudentLabel(issue) })}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                        >
                          Open student record
                        </button>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Recommended next action</p>
                      <p className="mt-2 text-sm text-slate-700">{recommendedActionText}</p>
                      {keyFact ? (
                        <p className="mt-3 text-sm font-medium text-slate-900">{keyFact}</p>
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
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(issue, 'acknowledged')}
                        disabled={actionState.pendingId === issue.issueId}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionState.pendingId === issue.issueId ? 'Saving…' : 'Keep active'}
                      </button>
                      {issue.sourcePresent && primaryKind !== 'resolve' ? (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(issue, 'resolved')}
                          disabled={actionState.pendingId === issue.issueId}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionState.pendingId === issue.issueId ? 'Saving…' : 'Mark resolved'}
                        </button>
                      ) : null}
                      {issue.type === 'REGISTRY ONLY' ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(issue)}
                          disabled={actionState.pendingId === issue.id}
                          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionState.pendingId === issue.id ? 'Removing…' : 'Remove from portal'}
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
                      <button
                        type="button"
                        onClick={() => handleStatusChange(issue, 'ignored')}
                        disabled={actionState.pendingId === issue.issueId}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionState.pendingId === issue.issueId ? 'Saving…' : 'Ignore'}
                      </button>
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
                {actionState.issueId === issue.issueId && (actionState.error || actionState.success) ? (
                  <p className={`text-sm ${actionState.error ? 'text-red-700' : 'text-emerald-700'}`}>
                    {actionState.error || actionState.success}
                  </p>
                ) : null}
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
