'use client';

import { useMemo, useState, useTransition } from 'react';

function formatDate(value = '') {
  if (!value) return 'No date set';
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function warningLines(warnings = {}) {
  return [
    [warnings.assignedStudents?.length || 0, 'student assignment'],
    [warnings.upcomingLessons?.length || 0, 'upcoming lesson in schedule cache'],
    [warnings.unpaidPayroll?.length || 0, 'unpaid payroll run'],
    [warnings.openPlanning?.length || 0, 'open planning item'],
    [warnings.openAbsences?.length || 0, 'open absence record'],
  ].filter(([count]) => count > 0);
}

function hasReachedFinalTeachingDate(value = '') {
  return Boolean(value) && value <= new Date().toISOString().slice(0, 10);
}

export default function AdminTutorLifecycleClient({ initialTutors = [] }) {
  const [tutors, setTutors] = useState(initialTutors);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(initialTutors.map((tutor) => [tutor.teacherId, {
    finalTeachingDate: tutor.finalTeachingDate || '',
    replacementTutorShortName: tutor.replacementTutorShortName || '',
    note: tutor.lifecycleNote || '',
  }])));
  const [context, setContext] = useState(null);
  const [message, setMessage] = useState({ error: '', success: '' });
  const [isPending, startTransition] = useTransition();
  const activeTutors = useMemo(() => tutors.filter((tutor) => tutor.lifecycleStatus !== 'retired'), [tutors]);

  function updateDraft(teacherId, key, value) {
    setDrafts((current) => ({ ...current, [teacherId]: { ...current[teacherId], [key]: value } }));
  }

  function save(tutor, action) {
    const draft = drafts[tutor.teacherId] || {};
    if (action === 'retire' && !window.confirm(`Retire ${tutor.fullName}? Warnings stay visible but will not block this.`)) return;
    startTransition(async () => {
      setMessage({ error: '', success: '' });
      const response = await fetch('/api/admin/tutors/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: tutor.teacherId, action, ...draft }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage({ error: data.error || 'Could not save tutor lifecycle.', success: '' });
        return;
      }
      setTutors((current) => current.map((entry) => entry.teacherId === tutor.teacherId ? data.tutor : entry));
      setContext((current) => current?.tutor?.teacherId === tutor.teacherId ? { ...current, tutor: data.tutor } : current);
      setMessage({ error: '', success: `${data.tutor.fullName} is now ${data.tutor.lifecycleStatus}.` });
    });
  }

  function review(tutor) {
    startTransition(async () => {
      setMessage({ error: '', success: '' });
      const response = await fetch(`/api/admin/tutors/lifecycle?teacherId=${encodeURIComponent(tutor.teacherId)}`);
      const data = await response.json();
      if (!response.ok) {
        setMessage({ error: data.error || 'Could not load retirement checks.', success: '' });
        return;
      }
      setContext(data);
    });
  }

  return (
    <div className="space-y-5">
      {message.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message.error}</p> : null}
      {message.success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message.success}</p> : null}

      {context ? (
        <section className="rounded-[1.3rem] border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Retirement checks · {context.tutor.fullName}</h3>
              <p className="mt-1 text-sm text-slate-600">Warnings inform the handover; they do not block retirement.</p>
            </div>
            <button type="button" onClick={() => setContext(null)} className="text-sm font-medium text-slate-600 hover:text-slate-900">Close</button>
          </div>
          {warningLines(context.warnings).length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {warningLines(context.warnings).map(([count, label]) => <li key={label}>{count} {label}{count === 1 ? '' : 's'}</li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-emerald-800">No dashboard checks are outstanding.</p>}
          <button type="button" disabled={isPending || context.tutor.lifecycleStatus === 'retired' || !hasReachedFinalTeachingDate(context.tutor.finalTeachingDate)} onClick={() => save(context.tutor, 'retire')} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {isPending ? 'Saving…' : context.tutor.lifecycleStatus === 'retired' ? 'Retired' : hasReachedFinalTeachingDate(context.tutor.finalTeachingDate) ? 'Retire tutor' : `Available after ${formatDate(context.tutor.finalTeachingDate)}`}
          </button>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[1.4rem] border border-blue-100 bg-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-semibold text-slate-900">Active and leaving</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {activeTutors.map((tutor) => {
            const draft = drafts[tutor.teacherId] || {};
            const leaving = tutor.lifecycleStatus === 'leaving';
            return (
              <article key={tutor.teacherId} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-900">{tutor.fullName}</h4>
                    <p className="mt-1 text-sm text-slate-600">{tutor.shortName} · {tutor.instruments.join(', ')}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${leaving ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>{leaving ? `Leaving · ${formatDate(tutor.finalTeachingDate)}` : 'Active'}</span>
                </div>
                {!leaving ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-[12rem_12rem_1fr_auto]">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Final teaching date<input type="date" value={draft.finalTeachingDate} onChange={(event) => updateDraft(tutor.teacherId, 'finalTeachingDate', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900" /></label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Handover to<select value={draft.replacementTutorShortName} onChange={(event) => updateDraft(tutor.teacherId, 'replacementTutorShortName', event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900"><option value="">Not set</option>{activeTutors.filter((entry) => entry.teacherId !== tutor.teacherId).map((entry) => <option key={entry.teacherId} value={entry.shortName}>{entry.fullName}</option>)}</select></label>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Handover note<input value={draft.note} onChange={(event) => updateDraft(tutor.teacherId, 'note', event.target.value)} placeholder="Optional context" className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900" /></label>
                    <button type="button" disabled={isPending} onClick={() => save(tutor, 'mark_leaving')} className="self-end rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Mark leaving</button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={isPending} onClick={() => review(tutor)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Review warnings</button>
                    <button type="button" disabled={isPending} onClick={() => save(tutor, 'restore_active')} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60">Keep active</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {tutors.some((tutor) => tutor.lifecycleStatus === 'retired') ? <section className="rounded-[1.3rem] border border-slate-200 bg-slate-50 p-5"><h3 className="font-semibold text-slate-900">Retired</h3><div className="mt-3 flex flex-wrap gap-2">{tutors.filter((tutor) => tutor.lifecycleStatus === 'retired').map((tutor) => <button key={tutor.teacherId} type="button" disabled={isPending} onClick={() => save(tutor, 'restore_active')} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60">Restore {tutor.fullName}</button>)}</div></section> : null}
    </div>
  );
}
