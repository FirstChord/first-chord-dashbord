'use client';

import { useState, useTransition } from 'react';

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
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold text-slate-900">{student.fullName || student.mmsId}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Editable student detail. Sheets-lane fields and registry-lane fields are saved separately behind one form.
        </p>
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

      {student.pauseSummary?.hasPauseHistory ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-900">Pause state</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReadOnlyField label="Currently paused" value={student.pauseSummary.currentlyPaused ? 'Yes' : 'No'} />
            <ReadOnlyField label="Pause start" value={student.pauseSummary.latestPause?.startDate} />
            <ReadOnlyField label="Pause end" value={student.pauseSummary.latestPause?.endDate} />
            <ReadOnlyField label="Stripe pause status" value={student.pauseSummary.latestPause?.stripeStatus} />
          </div>
        </section>
      ) : null}

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
