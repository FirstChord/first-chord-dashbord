'use client';

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

function lifecycleClasses(status) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'paused') return 'border-violet-200 bg-violet-50 text-violet-800';
  if (status === 'waiting' || status === 'onboarding' || status === 'setup_pending') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'stopped') return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default function AdminStudentDetailClient({ student, tutorOptions }) {
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
  const [isPending, startTransition] = useTransition();
  const pauseWorkflow = buildPauseWorkflowSummary({
    pauseSummary: student.pauseSummary,
    pauseCoverageContext,
    paymentExpectation: form.paymentExpectation,
    stripeSnapshot: stripeState.snapshot,
  });

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

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold text-slate-900">{student.fullName || student.mmsId}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Editable student detail. Sheets-lane fields and registry-lane fields are saved separately behind one form.
        </p>
      </section>

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
