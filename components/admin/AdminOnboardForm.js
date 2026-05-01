'use client';

import { useMemo, useState, useTransition } from 'react';

function deriveWeekday(dateValue) {
  if (!dateValue) return '';
  const parsed = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-GB', { weekday: 'long' });
}

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

function TextArea(props) {
  return (
    <textarea
      {...props}
      className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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

function Checkbox({ checked, onChange }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
    />
  );
}

function statusClasses(status) {
  if (status === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (status === 'pending') return 'border-slate-200 bg-slate-50 text-slate-700';
  return 'border-red-200 bg-red-50 text-red-900';
}

function preflightClasses(status) {
  if (status === 'ready' || status === 'clear') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (status === 'warning' || status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (status === 'blocked') return 'border-red-200 bg-red-50 text-red-900';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function AdminOnboardForm({ initialData, tutorOptions, initialDuplicateState = null }) {
  const [form, setForm] = useState(initialData);
  const [result, setResult] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [preflightState, setPreflightState] = useState(null);
  const [preflightError, setPreflightError] = useState('');
  const [isPending, startTransition] = useTransition();

  const filteredTutors = useMemo(() => {
    const instrument = (form.instrument || '').toLowerCase();
    return tutorOptions.filter((tutor) => !instrument || tutor.instruments.includes(instrument));
  }, [form.instrument, tutorOptions]);

  const derivedWeekday = useMemo(() => deriveWeekday(form.lessonDate), [form.lessonDate]);
  const initialWarnings = initialDuplicateState?.warnings || [];

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handlePreflight() {
    setPreflightError('');

    startTransition(async () => {
      const response = await fetch('/api/admin/onboard/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        setPreflightState(null);
        setPreflightError(payload.error || 'Preflight check failed');
        return;
      }

      setPreflightState(payload);
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    setErrorState(null);
    setResult(null);

    startTransition(async () => {
      const response = await fetch('/api/admin/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const payload = await response.json();
      if (!response.ok) {
        setErrorState({
          message: payload.error || 'Onboarding failed',
          steps: payload.steps || null,
          recoveryGuidance: payload.recoveryGuidance || [],
          duplicateWarnings: payload.duplicateWarnings || [],
        });
        return;
      }

      setResult(payload);
    });
  }

  return (
    <div className="space-y-8">
      <form className="space-y-8" onSubmit={handleSubmit}>
        {initialWarnings.length > 0 ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Existing record warning</p>
            <ul className="mt-2 list-disc pl-5">
              {initialWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Student + parent details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="MMS ID">
                <Input value={form.mmsId} readOnly />
              </Field>
              <Field label="Is adult?">
                <Select value={form.isAdult ? 'yes' : 'no'} onChange={(e) => updateField('isAdult', e.target.value === 'yes')}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </Select>
              </Field>
              <Field label="Student first name">
                <Input value={form.studentFirstName} onChange={(e) => updateField('studentFirstName', e.target.value)} />
              </Field>
              <Field label="Student last name">
                <Input value={form.studentLastName} onChange={(e) => updateField('studentLastName', e.target.value)} />
              </Field>
              <Field label="Parent first name">
                <Input value={form.parentFirstName} onChange={(e) => updateField('parentFirstName', e.target.value)} />
              </Field>
              <Field label="Parent last name">
                <Input value={form.parentLastName} onChange={(e) => updateField('parentLastName', e.target.value)} />
              </Field>
              <Field label="Parent / contact email">
                <Input value={form.parentEmail} onChange={(e) => updateField('parentEmail', e.target.value)} />
              </Field>
              <Field label="Student email">
                <Input value={form.studentEmail} onChange={(e) => updateField('studentEmail', e.target.value)} />
              </Field>
              <Field label="Contact number" hint="Prefilled from student phone, else parent phone">
                <Input value={form.contactNumber} onChange={(e) => updateField('contactNumber', e.target.value)} />
              </Field>
              <Field label="Age">
                <Input value={form.age} onChange={(e) => updateField('age', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Lesson + portal setup</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Instrument">
                <Input value={form.instrument} onChange={(e) => updateField('instrument', e.target.value)} />
              </Field>
              <Field label="Lesson length">
                <Select value={form.lessonLength} onChange={(e) => updateField('lessonLength', e.target.value)}>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </Select>
              </Field>
              <Field label="Lesson day" hint="Derived automatically from the selected date">
                <Input value={derivedWeekday} readOnly />
              </Field>
              <Field label="Lesson time">
                <Input type="time" required value={form.lessonTime} onChange={(e) => updateField('lessonTime', e.target.value)} />
              </Field>
              <Field label="First lesson date">
                <Input type="date" required value={form.lessonDate} onChange={(e) => updateField('lessonDate', e.target.value)} />
              </Field>
              <Field label="Recurring lesson">
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <Checkbox checked={Boolean(form.isRecurring)} onChange={(e) => updateField('isRecurring', e.target.checked)} />
                  <span className="text-sm text-slate-700">Create an ongoing weekly lesson series</span>
                </div>
              </Field>
              <Field label="Tutor">
                <Select required value={form.tutorShortName} onChange={(e) => updateField('tutorShortName', e.target.value)}>
                  <option value="">Select tutor</option>
                  {filteredTutors.map((tutor) => (
                    <option key={tutor.shortName} value={tutor.shortName}>
                      {tutor.shortName} ({tutor.fullName})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Theta username">
                <Input value={form.thetaUsername} onChange={(e) => updateField('thetaUsername', e.target.value)} />
              </Field>
              <Field label="Soundslice URL">
                <Input value={form.soundsliceUrl} onChange={(e) => updateField('soundsliceUrl', e.target.value)} />
              </Field>
              <Field label="Soundslice code">
                <Input value={form.soundsliceCode} onChange={(e) => updateField('soundsliceCode', e.target.value)} />
              </Field>
              <Field label="Experience level">
                <Select value={form.experienceLevel} onChange={(e) => updateField('experienceLevel', e.target.value)}>
                  <option value="1">1 - Beginner</option>
                  <option value="2">2 - Some experience</option>
                  <option value="3">3 - Intermediate</option>
                </Select>
              </Field>
            </div>
            <Field label="Interests / genres / songs">
              <TextArea value={form.interests} onChange={(e) => updateField('interests', e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Onboarding preflight</h3>
              <p className="mt-1 text-sm text-slate-600">
                Check Sheets, registry, and MMS state before the final onboarding write.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePreflight}
              disabled={isPending || !form.tutorShortName}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Checking…' : 'Run preflight'}
            </button>
          </div>

          {preflightError ? <p className="mt-4 text-sm text-red-700">{preflightError}</p> : null}

          {preflightState?.duplicateState?.warnings?.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Warnings</p>
              <ul className="mt-2 list-disc pl-5">
                {preflightState.duplicateState.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preflightState?.duplicateState?.blockingReasons?.length ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-semibold">Blocking duplicate state</p>
              <ul className="mt-2 list-disc pl-5">
                {preflightState.duplicateState.blockingReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preflightState?.summary ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(preflightState.summary).map(([key, item]) => (
                <div key={key} className={`rounded-xl border p-4 ${preflightClasses(item.status)}`}>
                  <p className="text-xs uppercase tracking-wide">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold">{item.status}</p>
                  <p className="mt-2 text-sm">{item.detail}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">MMS sign-up note</h3>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {form.rawNote || 'No MMS note available'}
          </pre>
        </section>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isPending ? 'Onboarding…' : 'Complete onboarding'}
          </button>
          {errorState ? <p className="text-sm text-red-700">{errorState.message}</p> : null}
        </div>
      </form>

      {errorState ? (
        <section className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6">
          <h3 className="text-lg font-semibold text-red-900">Onboarding needs attention</h3>
          {errorState.duplicateWarnings?.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Duplicate warnings</p>
              <ul className="mt-2 list-disc pl-5">
                {errorState.duplicateWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {errorState.steps ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(errorState.steps).map(([key, step]) => (
                <div key={key} className="rounded-xl border border-red-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{key}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{step.status}</p>
                  {step.detail ? <p className="mt-2 text-sm text-slate-700">{step.detail}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {errorState.recoveryGuidance?.length ? (
            <div className="rounded-xl border border-red-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Recovery guidance</p>
              <ul className="mt-2 list-disc pl-5">
                {errorState.recoveryGuidance.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {result ? (
        <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h3 className="text-lg font-semibold text-emerald-900">Onboarding complete</h3>
          {result.lessonWarning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              The student was added successfully, but MMS lesson creation still needs attention:
              <div className="mt-2 font-mono text-xs break-words">{result.lessonWarning}</div>
            </div>
          ) : null}
          {result.duplicateWarnings?.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Duplicate warnings</p>
              <ul className="mt-2 list-disc pl-5">
                {result.duplicateWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.steps ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(result.steps).map(([key, step]) => (
                <div key={key} className="rounded-xl border border-emerald-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{key}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{step.status}</p>
                  {step.detail ? <p className="mt-2 text-sm text-slate-700">{step.detail}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {result.completionStatus ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Onboarding completion status</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(result.completionStatus).map(([key, item]) => (
                  <div key={key} className={`rounded-xl border p-4 ${statusClasses(item.status)}`}>
                    <p className="text-xs uppercase tracking-wide opacity-70">{key}</p>
                    <p className="mt-2 text-sm font-semibold">{item.label}</p>
                    <p className="mt-2 text-sm">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">FC Student ID</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{result.fcStudentId}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Friendly URL</p>
              <p className="mt-2 text-sm font-medium text-slate-900">/{result.friendlyUrl}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Registry action</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{result.registryAction || 'Appended new entry'}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Lesson creation</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{result.lessonId ? `Created (${result.lessonId})` : 'Not created automatically'}</p>
              <p className="mt-1 text-xs text-slate-500">{form.isRecurring ? 'Configured as recurring weekly series' : 'Configured as one-off lesson'}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">MMS activation</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{result.mmsStatus?.activated ? 'Student activated' : 'Not completed automatically'}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">MMS billing profile</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{result.mmsStatus?.billingProfileReady ? 'Ready' : 'Not created automatically'}</p>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">WGCS label</p>
            <p className="mt-2 text-sm text-slate-700">{result.wgcs.whatsappGroupLabel}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Welcome message</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{result.wgcs.welcomeMessage}</pre>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Soundslice follow-up</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{result.wgcs.soundsliceFollowup}</pre>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Post-onboarding jobs are still manual in V1. Use the completion status panel above to track what is finished and what is still pending before the student is fully live.
          </div>
          {result.recoveryGuidance?.length ? (
            <div className="rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Recovery guidance</p>
              <ul className="mt-2 list-disc pl-5">
                {result.recoveryGuidance.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
