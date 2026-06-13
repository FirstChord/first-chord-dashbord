'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { buildPauseWorkflowSummary } from '@/lib/admin/pause-workflow-helpers.mjs';

const INSTRUMENT_OPTIONS = ['Guitar', 'Piano', 'Bass', 'Singing', 'Ukulele', 'Ukulele Orchestra'];
const PAYMENT_MODE_OPTIONS = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'manual', label: 'Manual' },
  { value: 'unknown', label: 'Unknown' },
];
const PAYMENT_EXPECTATION_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'setup_pending', label: 'Setup pending' },
  { value: 'stripe_active_expected', label: 'Stripe active expected' },
  { value: 'stripe_paused_expected', label: 'Stripe paused expected' },
  { value: 'inactive_or_stopped', label: 'Inactive or stopped' },
];

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
    />
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-900 break-all">{value || '—'}</p>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTargetDate(value = '') {
  if (!value) return 'No date';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function lifecycleClasses(status) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'paused') return 'border-violet-200 bg-violet-50 text-violet-800';
  if (status === 'waiting' || status === 'onboarding' || status === 'setup_pending') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'stopped') return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function paymentExpectationLabel(value = '') {
  return PAYMENT_EXPECTATION_OPTIONS.find((option) => option.value === value)?.label || value || 'Not set';
}

function noteStatusLabel(note = {}) {
  if (note.emailSendStatus === 'sent') return 'Sent';
  if (note.emailSendStatus === 'failed') return 'Email follow-up needed';
  if (note.mmsAttendanceSaved) return 'Saved to MMS';
  return 'Draft/snapshot';
}

function noteStatusClasses(note = {}) {
  if (note.emailSendStatus === 'sent') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (note.emailSendStatus === 'failed' || note.manualFollowUpNeeded) return 'border-amber-200 bg-amber-50 text-amber-900';
  if (note.mmsAttendanceSaved) return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function notePreview(note = {}) {
  const text = note.practiceGoals || note.rawNoteText || note.whatWeDid || '';
  if (!text) return 'No note preview stored.';
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

export default function AdminStudentDetailClient({
  student,
  tutorOptions,
  linkedPlanningItems = [],
  recentPracticeNotes = [],
}) {
  const [form, setForm] = useState({
    firstName: student.firstName || '',
    lastName: student.lastName || '',
    tutor: student.tutor || '',
    registryTutor: student.registryTutor || '',
    instrument: student.instrument || '',
    lessonLength: student.lessonLength || '',
    parentFirstName: student.parentFirstName || '',
    parentLastName: student.parentLastName || '',
    email: student.email || '',
    contactNumber: student.contactNumber || '',
    paymentMode: student.paymentMode || 'stripe',
    paymentExpectation: student.paymentExpectation || '',
    soundsliceUrl: student.registry?.soundsliceUrl || '',
    thetaUsername: student.registry?.thetaUsername || '',
  });
  const [serverState, setServerState] = useState({
    error: '',
    success: '',
  });
  const [stripeState, setStripeState] = useState({
    error: '',
    loading: false,
    snapshot: null,
    issues: [],
    skippedReason: '',
  });
  const [scheduleState, setScheduleState] = useState({
    error: '',
    loading: false,
    scheduleContext: student.scheduleContext || null,
  });
  const [paymentValueContext, setPaymentValueContext] = useState(student.paymentValueContext || null);
  const [pauseCoverageContext, setPauseCoverageContext] = useState(student.pauseCoverageContext || null);
  const [exitState, setExitState] = useState({
    registryPresent: Boolean(student.registry),
    mmsInactive: false,
    sheetArchived: false,
  });
  const [isPending, startTransition] = useTransition();
  const pauseWorkflow = buildPauseWorkflowSummary({
    pauseSummary: student.pauseSummary,
    pauseCoverageContext,
    paymentExpectation: form.paymentExpectation,
    stripeSnapshot: stripeState.snapshot,
  });
  const hasStripeLinkage = Boolean(student.stripeCustomerId || student.stripeSubscriptionId);
  const archiveAlreadyMarked = form.paymentExpectation === 'inactive_or_stopped';
  const archiveScheduleLabel = scheduleState.scheduleContext
    ? [
      scheduleState.scheduleContext.usualWeekday,
      scheduleState.scheduleContext.usualTime,
      scheduleState.scheduleContext.teacherName ? `with ${scheduleState.scheduleContext.teacherName}` : '',
    ].filter(Boolean).join(' ')
    : 'No cached schedule context';

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setServerState({ error: '', success: '' });

    startTransition(async () => {
      const response = await fetch(`/api/admin/students/${student.mmsId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setServerState({ error: data.error || 'Update failed', success: '' });
        return;
      }

      setForm({
        firstName: data.student.firstName || '',
        lastName: data.student.lastName || '',
        tutor: data.student.tutor || '',
        registryTutor: data.student.registryTutor || '',
        instrument: data.student.instrument || '',
        lessonLength: data.student.lessonLength || '',
        parentFirstName: data.student.parentFirstName || '',
        parentLastName: data.student.parentLastName || '',
        email: data.student.email || '',
        contactNumber: data.student.contactNumber || '',
        paymentMode: data.student.paymentMode || 'stripe',
        paymentExpectation: data.student.paymentExpectation || '',
        soundsliceUrl: data.student.registry?.soundsliceUrl || '',
        thetaUsername: data.student.registry?.thetaUsername || '',
      });
      setServerState({ error: '', success: 'Student details saved.' });
    });
  }

  async function handleRefreshStripeStatus() {
    setStripeState((current) => ({
      ...current,
      error: '',
      loading: true,
    }));

    try {
      const response = await fetch(`/api/admin/students/${student.mmsId}/stripe`);
      const data = await response.json();

      if (!response.ok) {
        setStripeState({
          error: data.error || 'Stripe refresh failed',
          loading: false,
          snapshot: null,
          issues: [],
          skippedReason: '',
        });
        return;
      }

      setStripeState({
        error: '',
        loading: false,
        snapshot: data.snapshot || null,
        issues: data.issues || [],
        skippedReason: data.skippedReason || '',
      });
    } catch (error) {
      setStripeState({
        error: error.message || 'Stripe refresh failed',
        loading: false,
        snapshot: null,
        issues: [],
        skippedReason: '',
      });
    }
  }

  async function handleRefreshSchedule() {
    setScheduleState((current) => ({
      ...current,
      error: '',
      loading: true,
    }));

    try {
      const response = await fetch(`/api/admin/students/${student.mmsId}/schedule`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        setScheduleState((current) => ({
          ...current,
          error: data.error || 'Schedule refresh failed',
          loading: false,
        }));
        return;
      }

      setScheduleState({
        error: '',
        loading: false,
        scheduleContext: data.scheduleContext || null,
      });
      setPaymentValueContext(data.paymentValueContext || null);
      setPauseCoverageContext(data.pauseCoverageContext || null);
    } catch (error) {
      setScheduleState((current) => ({
        ...current,
        error: error.message || 'Schedule refresh failed',
        loading: false,
      }));
    }
  }

  function handleQuickPaymentExpectation(nextExpectation, actionLabel) {
    const note = window.prompt(
      `Why are you taking "${actionLabel}" for ${student.fullName || student.mmsId}? This note is saved to the payment audit log.`,
      '',
    );

    if (note === null) {
      return;
    }

    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setServerState({ error: 'A short note is required for pause workflow payment actions.', success: '' });
      return;
    }

    setServerState({ error: '', success: '' });

    startTransition(async () => {
      const response = await fetch(`/api/admin/students/${student.mmsId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentExpectation: nextExpectation,
          auditContext: {
            source: 'admin_pause_workflow_action',
            actionLabel,
            note: trimmedNote,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setServerState({ error: data.error || 'Update failed', success: '' });
        return;
      }

      setForm((current) => ({
        ...current,
        paymentExpectation: data.student.paymentExpectation || '',
      }));
      setServerState({
        error: '',
        success: data.audit?.pauseWorkflowActionLogged
          ? 'Pause workflow action logged.'
          : 'No payment expectation change was needed.',
      });
    });
  }

  function runExitAction({
    action,
    actionLabel,
    promptText,
    confirmText,
    onSuccess,
  }) {
    const note = window.prompt(
      promptText,
      '',
    );

    if (note === null) {
      return;
    }

    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setServerState({ error: 'A short note is required for student exit actions.', success: '' });
      return;
    }

    const confirmed = window.confirm(confirmText);

    if (!confirmed) {
      return;
    }

    setServerState({ error: '', success: '' });

    startTransition(async () => {
      const response = await fetch(`/api/admin/students/${student.mmsId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          note: trimmedNote,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setServerState({ error: data.error || `${actionLabel} failed`, success: '' });
        return;
      }

      onSuccess?.(data);
    });
  }

  function handleArchiveStudent() {
    runExitAction({
      action: 'mark_inactive_expectation',
      actionLabel: 'Mark inactive / stopped',
      promptText: `Why are you marking ${student.fullName || student.mmsId} inactive/stopped? This note is saved to the archive audit log.`,
      confirmText: archiveAlreadyMarked
        ? 'This will log an archive note only. Continue?'
        : 'This will set payment expectation to inactive/stopped and log the reason. Continue?',
      onSuccess: (data) => {
        setForm((current) => ({
          ...current,
          paymentExpectation: data.student.paymentExpectation || '',
        }));
        setServerState({
          error: '',
          success: data.audit?.paymentExpectationChanged
            ? 'Student marked inactive/stopped and archive note logged.'
            : 'Archive note logged. Payment expectation was already inactive/stopped.',
        });
      },
    });
  }

  function handleDeleteRegistryEntry() {
    runExitAction({
      action: 'delete_registry_entry',
      actionLabel: 'Delete registry entry',
      promptText: `Why are you deleting registry access for ${student.fullName || student.mmsId}?`,
      confirmText: 'This removes the portal/dashboard registry entry. It does not remove the Students sheet row or change MMS. Continue?',
      onSuccess: (data) => {
        setExitState((current) => ({
          ...current,
          registryPresent: Boolean(data.student?.registry),
        }));
        setServerState({
          error: '',
          success: data.audit?.registryDeleted
            ? 'Registry entry deleted and logged.'
            : 'No registry entry was present.',
        });
      },
    });
  }

  function handleMarkMmsInactive() {
    runExitAction({
      action: 'mark_mms_inactive',
      actionLabel: 'Mark inactive in MMS',
      promptText: `Why are you marking ${student.fullName || student.mmsId} inactive in MMS?`,
      confirmText: 'This updates the student status in MMS to Inactive. Continue?',
      onSuccess: (data) => {
        setExitState((current) => ({
          ...current,
          mmsInactive: true,
        }));
        setServerState({
          error: '',
          success: data.audit?.alreadyInactive
            ? 'MMS was already inactive. Confirmation logged.'
            : 'MMS student marked inactive and logged.',
        });
      },
    });
  }

  function handleArchiveSheetRow() {
    runExitAction({
      action: 'archive_students_sheet_row',
      actionLabel: 'Archive Students sheet row',
      promptText: `Why are you removing ${student.fullName || student.mmsId} from the active Students sheet?`,
      confirmText: 'Final step: this copies the row to Students_Archive, then removes it from the active Students sheet. The student detail page will no longer load after refresh. Continue?',
      onSuccess: () => {
        setExitState((current) => ({
          ...current,
          sheetArchived: true,
        }));
        setServerState({
          error: '',
          success: 'Students sheet row archived and removed. This page will no longer load after refresh.',
        });
      },
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold text-slate-900">{student.fullName || student.mmsId}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Editable student detail. Sheets-lane fields and registry-lane fields are saved separately behind one form.
        </p>
      </section>

      {serverState.success || serverState.error ? (
        <section className={`rounded-2xl border p-4 text-sm ${
          serverState.error
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}
        >
          {serverState.error || serverState.success}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Lifecycle</h3>
            <p className="mt-1 text-sm text-slate-600">Derived from current Sheets, waiting-list, pause, registry, and payment fields.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${lifecycleClasses(student.lifecycleStatus)}`}>
              {student.lifecycleLabel || 'Needs review'}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              {student.lifecycleConfidence || 'low'} confidence
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-6 border-t border-slate-200 pt-4 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Why</p>
            {student.lifecycleReasons?.length ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {student.lifecycleReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-700">No lifecycle reason was derived.</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Warnings</p>
            {student.lifecycleWarnings?.length ? (
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {student.lifecycleWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-700">No lifecycle warnings.</p>
            )}
          </div>
        </div>
      </section>

      {student.hasFlags ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-semibold text-amber-900">Review flags</h3>
          <ul className="mt-3 space-y-2 text-sm text-amber-950">
            {student.flags.map((flag, index) => (
              <li key={`${flag.category}-${index}`}>
                <strong>{flag.category || 'Flag'}:</strong> {flag.detail || 'No detail'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {linkedPlanningItems.length ? (
        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Open planning</h3>
              <p className="mt-1 text-sm text-slate-600">Planning items currently linked to this student.</p>
            </div>
            <Link
              href="/admin/planning?filter=linked"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-blue-50"
            >
              Open planning
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {linkedPlanningItems.map((item) => (
              <div key={item.planningId} className="rounded-xl border border-blue-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.owner || 'Unassigned'} · {item.statusLabel || item.status} · {item.momentumLabel || 'Planning'}
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                    {formatTargetDate(item.targetDate)}
                  </span>
                </div>
                {item.nextAction ? (
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-medium">Next action: </span>
                    {item.nextAction}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent practice notes</h3>
            <p className="mt-1 text-sm text-slate-600">
              Read-only learning memory from Practice Chat. This is context for handover and review, not AI analysis.
            </p>
          </div>
          {recentPracticeNotes.length ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              {recentPracticeNotes.length} recent
            </span>
          ) : null}
        </div>
        {recentPracticeNotes.length ? (
          <div className="mt-4 space-y-3">
            {recentPracticeNotes.map((note) => (
              <article key={note.noteId || `${note.lessonDate}-${note.createdAt}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDateTime(note.emailSentAt || note.createdAt || note.lessonDate)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {note.tutorName || 'Tutor unknown'} · Lesson {formatDateTime(note.lessonDate)}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${noteStatusClasses(note)}`}>
                    {noteStatusLabel(note)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{notePreview(note)}</p>
                <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                  <p>
                    <span className="font-medium text-slate-600">Recipient: </span>
                    {note.recipientName || '—'}{note.recipientEmail ? ` · ${note.recipientEmail}` : ''}
                  </p>
                  <p>
                    <span className="font-medium text-slate-600">MMS attendance: </span>
                    {note.mmsAttendanceId || '—'}{note.targetSelectionLabel ? ` · ${note.targetSelectionLabel}` : ''}
                  </p>
                </div>
                {note.emailError ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    Email issue: {note.emailError}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No Practice Chat notes have been logged for this student yet.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Student exit / archive</h3>
            <p className="mt-1 text-sm text-slate-600">
              Work through this when a student has left. Each step is explicit, logged, and can be done separately.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReadOnlyField label="Current expectation" value={paymentExpectationLabel(form.paymentExpectation)} />
          <ReadOnlyField label="Registry entry" value={exitState.registryPresent ? 'Present' : 'Missing'} />
          <ReadOnlyField label="Stripe linkage" value={hasStripeLinkage ? 'IDs present' : 'No Stripe IDs'} />
          <ReadOnlyField label="Usual lesson" value={archiveScheduleLabel} />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div className={`rounded-xl border p-4 ${archiveAlreadyMarked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1</p>
            <p className="mt-2 text-sm font-medium text-slate-900">Mark inactive/stopped</p>
            <p className="mt-1 text-xs text-slate-600">Updates the Students sheet payment expectation.</p>
            <button
              type="button"
              onClick={handleArchiveStudent}
              disabled={isPending || exitState.sheetArchived}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Saving…' : archiveAlreadyMarked ? 'Log note' : 'Mark inactive'}
            </button>
          </div>
          <div className={`rounded-xl border p-4 ${!exitState.registryPresent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2</p>
            <p className="mt-2 text-sm font-medium text-slate-900">Remove registry access</p>
            <p className="mt-1 text-xs text-slate-600">Deletes the portal/dashboard registry entry.</p>
            <button
              type="button"
              onClick={handleDeleteRegistryEntry}
              disabled={isPending || !archiveAlreadyMarked || !exitState.registryPresent || exitState.sheetArchived}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Saving…' : exitState.registryPresent ? 'Delete registry' : 'Done'}
            </button>
          </div>
          <div className={`rounded-xl border p-4 ${exitState.mmsInactive ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 3</p>
            <p className="mt-2 text-sm font-medium text-slate-900">Mark inactive in MMS</p>
            <p className="mt-1 text-xs text-slate-600">Updates MMS student status to Inactive.</p>
            <button
              type="button"
              onClick={handleMarkMmsInactive}
              disabled={isPending || !archiveAlreadyMarked || exitState.mmsInactive || exitState.sheetArchived}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Saving…' : exitState.mmsInactive ? 'Done' : 'Mark MMS inactive'}
            </button>
          </div>
          <div className={`rounded-xl border p-4 ${exitState.sheetArchived ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 4</p>
            <p className="mt-2 text-sm font-medium text-slate-900">Archive active row</p>
            <p className="mt-1 text-xs text-slate-600">Copies to Students_Archive, then removes from Students.</p>
            <button
              type="button"
              onClick={handleArchiveSheetRow}
              disabled={isPending || !archiveAlreadyMarked || exitState.sheetArchived}
              className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Saving…' : exitState.sheetArchived ? 'Archived' : 'Archive row'}
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Stripe is still separate.</p>
          <p className="mt-1">
            This workflow does not cancel Stripe. If Stripe is still billing after the student is inactive/stopped, the payment checks should flag it as inactive still billing.
          </p>
        </div>
      </section>

      {(student.tutor || student.registryTutor) ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-900">Tutor state</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Sheets tutor" value={student.tutor} />
            <ReadOnlyField label="Registry tutor" value={student.registryTutor} />
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Schedule</h3>
            <p className="mt-1 text-sm text-slate-600">Cached from MMS calendar events. Refresh only when the student is new or the lesson slot changes.</p>
          </div>
          <button
            type="button"
            onClick={handleRefreshSchedule}
            disabled={scheduleState.loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {scheduleState.loading ? 'Refreshing…' : 'Refresh schedule from MMS'}
          </button>
        </div>
        {scheduleState.error ? <p className="mt-3 text-sm text-red-700">{scheduleState.error}</p> : null}
        {scheduleState.scheduleContext ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ReadOnlyField
                label="Usual lesson"
                value={
                  scheduleState.scheduleContext.usualWeekday || scheduleState.scheduleContext.usualTime
                    ? `${scheduleState.scheduleContext.usualWeekday || '—'} ${scheduleState.scheduleContext.usualTime || ''}`.trim()
                    : 'Unknown'
                }
              />
              <ReadOnlyField label="Next lesson" value={formatDateTime(scheduleState.scheduleContext.nextLessonAt)} />
              <ReadOnlyField label="Teacher" value={scheduleState.scheduleContext.teacherName} />
              <ReadOnlyField label="Duration" value={scheduleState.scheduleContext.durationMinutes ? `${scheduleState.scheduleContext.durationMinutes} mins` : ''} />
              <ReadOnlyField
                label="Shared slot"
                value={scheduleState.scheduleContext.sharedStudentCount > 1
                  ? `${scheduleState.scheduleContext.sharedStudentCount} students`
                  : 'No'}
              />
              <ReadOnlyField label="MMS status" value={scheduleState.scheduleContext.status} />
              <ReadOnlyField label="Confidence" value={scheduleState.scheduleContext.confidence} />
              <ReadOnlyField label="Event category" value={scheduleState.scheduleContext.eventCategory} />
              <ReadOnlyField label="Checked" value={formatDateTime(scheduleState.scheduleContext.checkedAt)} />
            </div>
            {scheduleState.scheduleContext.warnings?.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-700">Schedule warnings</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-950">
                  {scheduleState.scheduleContext.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {scheduleState.scheduleContext.sharedStudentNames?.length > 1 ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-xs uppercase tracking-wide text-sky-700">Shared lesson slot</p>
                <p className="mt-2 text-sm text-sky-950">
                  {scheduleState.scheduleContext.sharedStudentNames.join(', ')}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No cached schedule context yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Payment value</h3>
            <p className="mt-1 text-sm text-slate-600">Estimated baseline operational value. Stripe remains the billing source of truth.</p>
          </div>
          {paymentValueContext ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              {paymentValueContext.confidence || 'low'} confidence
            </span>
          ) : null}
        </div>
        {paymentValueContext ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ReadOnlyField label="Weekly baseline" value={paymentValueContext.baselineWeeklyLabel} />
              <ReadOnlyField label="Monthly baseline" value={paymentValueContext.baselineMonthlyLabel} />
              <ReadOnlyField label="Pricing type" value={paymentValueContext.lessonKind?.replaceAll('_', ' ')} />
              <ReadOnlyField label="Duration used" value={paymentValueContext.durationMinutes ? `${paymentValueContext.durationMinutes} mins` : ''} />
            </div>
            {paymentValueContext.reasons?.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Why</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {paymentValueContext.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Warnings</p>
                  {paymentValueContext.warnings?.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-amber-800">
                      {paymentValueContext.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-700">No value warnings.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">No payment value context could be derived.</p>
        )}
      </section>

      {student.pauseSummary?.hasPauseHistory ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-900">Pause state</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReadOnlyField label="Currently paused" value={student.pauseSummary.currentlyPaused ? 'Yes' : 'No'} />
            <ReadOnlyField label="Upcoming pause" value={student.pauseSummary.upcomingPause ? 'Yes' : 'No'} />
            <ReadOnlyField label="Latest pause start" value={student.pauseSummary.latestPause?.startDate} />
            <ReadOnlyField label="Latest pause end" value={student.pauseSummary.latestPause?.endDate} />
            <ReadOnlyField label="Latest recorded Stripe pause status" value={student.pauseSummary.latestPause?.stripeStatus} />
            <ReadOnlyField label="Pause match confidence" value={student.pauseSummary.matchConfidence || '—'} />
          </div>
          {pauseCoverageContext?.summary ? (
            <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              pauseCoverageContext.status === 'no_usual_lesson_covered' || pauseCoverageContext.status === 'schedule_missing'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-blue-200 bg-blue-50 text-blue-950'
            }`}
            >
              <p className="font-medium">Likely lesson coverage</p>
              <p className="mt-1">{pauseCoverageContext.summary}</p>
              <p className="mt-1">{pauseCoverageContext.recommendation}</p>
            </div>
          ) : null}
          {student.pauseSummary.matchEvidence ? (
            <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              student.pauseSummary.matchConfidence === 'low'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
            >
              {student.pauseSummary.matchEvidence}
            </p>
          ) : null}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pause workflow</p>
            <p className="mt-2 text-sm text-slate-800">{pauseWorkflow.statusLine}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadOnlyField
                label="Loop state"
                value={pauseWorkflow.state}
              />
              <ReadOnlyField
                label="Pause History says"
                value={student.pauseSummary.currentlyPaused ? 'Paused now' : student.pauseSummary.upcomingPause ? 'Upcoming pause' : 'No active pause'}
              />
              <ReadOnlyField
                label="Payment expectation"
                value={form.paymentExpectation || 'Not set'}
              />
              <ReadOnlyField
                label="Live Stripe check"
                value={
                  stripeState.snapshot
                    ? stripeState.snapshot.activelyBilling
                      ? 'Actively billing'
                      : stripeState.snapshot.pauseState || 'Not billing'
                    : 'Not checked yet'
                }
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ReadOnlyField label="Next action" value={pauseWorkflow.nextAction} />
              <ReadOnlyField label="What closes it" value={pauseWorkflow.closureCondition} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleQuickPaymentExpectation('stripe_paused_expected', 'Confirm pause and set paused expected')}
                disabled={isPending}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirm pause and set paused expected
              </button>
              <button
                type="button"
                onClick={() => handleQuickPaymentExpectation('stripe_active_expected', 'Set Stripe active expected')}
                disabled={isPending}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Set Stripe active expected
              </button>
            </div>
            {pauseWorkflow.liveStripeMismatch ? (
              <p className="mt-3 text-sm text-amber-700">
                Live Stripe still disagrees with the current expectation. Refreshing Stripe here is the quickest way to confirm whether the pause loop is actually closed.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Live Stripe status</h3>
            <p className="mt-1 text-sm text-slate-600">Manual refresh only. This checks live Stripe state for this student without scanning the whole cohort.</p>
          </div>
          <button
            type="button"
            onClick={handleRefreshStripeStatus}
            disabled={stripeState.loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {stripeState.loading ? 'Checking…' : 'Refresh Stripe status'}
          </button>
        </div>

        {stripeState.error ? <p className="mt-3 text-sm text-red-700">{stripeState.error}</p> : null}
        {stripeState.skippedReason ? <p className="mt-3 text-sm text-slate-600">{stripeState.skippedReason}</p> : null}

        {stripeState.snapshot ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ReadOnlyField label="Customer found" value={stripeState.snapshot.customerFound ? 'Yes' : 'No'} />
              <ReadOnlyField label="Subscription found" value={stripeState.snapshot.subscriptionFound ? 'Yes' : 'No'} />
              <ReadOnlyField label="Subscription status" value={stripeState.snapshot.subscriptionStatus} />
              <ReadOnlyField label="Pause state" value={stripeState.snapshot.pauseState} />
              <ReadOnlyField label="Actively billing" value={stripeState.snapshot.activelyBilling ? 'Yes' : 'No'} />
              <ReadOnlyField label="Latest invoice status" value={stripeState.snapshot.latestInvoiceStatus} />
              <ReadOnlyField label="Latest payment intent" value={stripeState.snapshot.latestPaymentIntentStatus} />
              <ReadOnlyField label="Last checked" value={stripeState.snapshot.lastCheckedAt} />
            </div>

            {stripeState.issues.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-700">Live Stripe issues</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-950">
                  {stripeState.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-emerald-700">No live Stripe issues detected for the current rule set.</p>
            )}
          </div>
        ) : null}
      </section>

      <form className="space-y-8" onSubmit={handleSubmit}>
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Sheets lane</h3>
              <p className="mt-1 text-sm text-slate-600">Identity, contact, tutor, instrument, and lesson fields stored in the Students sheet.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Student first name">
                <Input value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} />
              </Field>
              <Field label="Student last name">
                <Input value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} />
              </Field>
              <Field label="Tutor">
                <Select value={form.tutor} onChange={(event) => updateField('tutor', event.target.value)}>
                  <option value="">Select tutor</option>
                  {tutorOptions.map((tutor) => (
                    <option key={tutor.shortName} value={tutor.fullName}>
                      {tutor.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Instrument">
                <Select value={form.instrument} onChange={(event) => updateField('instrument', event.target.value)}>
                  <option value="">Select instrument</option>
                  {INSTRUMENT_OPTIONS.map((instrument) => (
                    <option key={instrument} value={instrument}>
                      {instrument}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Lesson length">
                <Input value={form.lessonLength} onChange={(event) => updateField('lessonLength', event.target.value)} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
              </Field>
              <Field label="Parent first name">
                <Input
                  value={form.parentFirstName}
                  onChange={(event) => updateField('parentFirstName', event.target.value)}
                />
              </Field>
              <Field label="Parent last name">
                <Input
                  value={form.parentLastName}
                  onChange={(event) => updateField('parentLastName', event.target.value)}
                />
              </Field>
              <Field label="Contact number">
                <Input
                  value={form.contactNumber}
                  onChange={(event) => updateField('contactNumber', event.target.value)}
                />
              </Field>
              <Field label="Payment mode" hint="Stripe is the normal default. Use manual only for approved cash/bank-transfer exceptions.">
                <Select value={form.paymentMode} onChange={(event) => updateField('paymentMode', event.target.value)}>
                  {PAYMENT_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment expectation" hint="Use this to express whether Stripe should be active, paused, pending, or not currently expected.">
                <Select value={form.paymentExpectation} onChange={(event) => updateField('paymentExpectation', event.target.value)}>
                  {PAYMENT_EXPECTATION_OPTIONS.map((option) => (
                    <option key={option.value || 'blank'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Registry lane</h3>
              <p className="mt-1 text-sm text-slate-600">Portal configuration only. Friendly URL and FC ID stay read-only.</p>
            </div>
            <div className="grid gap-4">
              <Field label="Registry tutor" hint="Use this to resolve tutor conflicts between the registry and Sheets.">
                <Select value={form.registryTutor} onChange={(event) => updateField('registryTutor', event.target.value)}>
                  <option value="">Select tutor</option>
                  {tutorOptions.map((tutor) => (
                    <option key={tutor.shortName} value={tutor.shortName}>
                      {tutor.shortName} ({tutor.fullName})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Soundslice URL" hint="Must remain a Soundslice course URL">
                <Input
                  value={form.soundsliceUrl}
                  onChange={(event) => updateField('soundsliceUrl', event.target.value)}
                />
              </Field>
              <Field label="Theta username" hint="Lowercase letters and numbers only">
                <Input
                  value={form.thetaUsername}
                  onChange={(event) => updateField('thetaUsername', event.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="MMS ID" value={student.mmsId} />
            <ReadOnlyField label="FC Student ID" value={student.fcStudentId} />
            <ReadOnlyField label="Friendly URL" value={student.registry?.friendlyUrl} />
            <ReadOnlyField label="Registry FC ID" value={student.registry?.fcStudentId} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Stripe Customer" value={student.stripeCustomerId} />
            <ReadOnlyField label="Stripe Subscription" value={student.stripeSubscriptionId} />
          </div>
        </section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
          {serverState.success ? <p className="text-sm text-emerald-700">{serverState.success}</p> : null}
          {serverState.error ? <p className="text-sm text-red-700">{serverState.error}</p> : null}
        </div>
      </form>
    </div>
  );
}
