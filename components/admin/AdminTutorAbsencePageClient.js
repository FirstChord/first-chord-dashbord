'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, Loader2, Search, Trash2 } from 'lucide-react';
import { buildTutorAbsenceMessage, formatTutorAbsenceDate, summariseTutorAbsenceState } from '@/lib/admin/tutor-absence-helpers.mjs';

function cardClasses(extra = '') {
  return `rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] ${extra}`;
}

function statusLabel(status = '') {
  const labels = {
    draft: 'Draft',
    in_progress: 'In Progress',
    parents_to_message: 'Parents to message',
    resolved: 'Resolved',
  };
  return labels[status] || status || 'Draft';
}

function decisionLabel(decision = '') {
  if (decision === 'cancel_day') return 'Cancel day';
  if (decision === 'cover') return 'Cover lessons';
  return 'No decision yet';
}

function MessageButton({ body, copiedId, copyId, onCopy }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(copyId, body)}
      className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-blue-50"
    >
      {copiedId === copyId ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
      Copy message
    </button>
  );
}

export default function AdminTutorAbsencePageClient({ workflow }) {
  const [decision, setDecision] = useState(workflow.state.decision || '');
  const [coverTutorShortName, setCoverTutorShortName] = useState(workflow.state.coverTutorShortName || '');
  const [messageState, setMessageState] = useState(workflow.state.messageState || {});
  const [note, setNote] = useState(workflow.state.note || '');
  const [saveState, setSaveState] = useState({ pending: false, error: '', savedAt: '' });
  const [copiedId, setCopiedId] = useState('');
  const hasSavedAbsence = Boolean(workflow.state.createdAt || workflow.state.updatedAt || workflow.state.resolvedAt);

  const selectedCoverTutor = workflow.coverOptions.find((tutor) => tutor.shortName === coverTutorShortName) || null;
  const summary = useMemo(() => summariseTutorAbsenceState({
    lessons: workflow.lessons,
    messageState,
  }), [workflow.lessons, messageState]);

  function updateMessageState(eventId, patch) {
    setMessageState((current) => ({
      ...current,
      [eventId]: {
        ...(current[eventId] || {}),
        ...patch,
      },
    }));
    setSaveState({ pending: false, error: '', savedAt: '' });
  }

  function setAllMessaged() {
    const next = {};
    for (const lesson of workflow.lessons) {
      next[lesson.eventId] = {
        ...(messageState[lesson.eventId] || {}),
        messaged: true,
      };
    }
    setMessageState(next);
    setSaveState({ pending: false, error: '', savedAt: '' });
  }

  async function copyMessage(copyId, body) {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = body;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopiedId(copyId);
    window.setTimeout(() => setCopiedId((current) => (current === copyId ? '' : current)), 1800);
  }

  async function saveAbsence(status = 'in_progress') {
    setSaveState({ pending: true, error: '', savedAt: '' });
    try {
      const response = await fetch('/api/admin/tutor-absence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absenceId: workflow.absenceId,
          tutorShortName: workflow.selectedTutor?.shortName || '',
          tutorName: workflow.selectedTutor?.fullName || '',
          absenceDate: workflow.selectedDate,
          status,
          decision,
          coverTutorShortName: selectedCoverTutor?.shortName || '',
          coverTutorName: selectedCoverTutor?.fullName || '',
          affectedLessons: workflow.lessons,
          messageState,
          note,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setSaveState({ pending: false, error: payload.error || 'Save failed', savedAt: '' });
        return;
      }
      setSaveState({ pending: false, error: '', savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
    } catch (error) {
      setSaveState({ pending: false, error: error.message || 'Save failed', savedAt: '' });
    }
  }

  async function deleteAbsence() {
    const confirmed = window.confirm('Delete this logged tutor absence date? Use this when the tutor is no longer off and the date should disappear from the workflow.');
    if (!confirmed) return;

    setSaveState({ pending: true, error: '', savedAt: '' });
    try {
      const response = await fetch('/api/admin/tutor-absence', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absenceId: workflow.absenceId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setSaveState({ pending: false, error: payload.error || 'Delete failed', savedAt: '' });
        return;
      }
      window.location.href = '/admin/workflows/tutor-absence';
    } catch (error) {
      setSaveState({ pending: false, error: error.message || 'Delete failed', savedAt: '' });
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Same-day operations</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Tutor Absence
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Pick the tutor and date, choose cancel or cover, copy parent messages, then mark the day handled.
        </p>
      </section>

      <section className={cardClasses()}>
        <form action="/admin/workflows/tutor-absence" className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tutor off</label>
            <select name="tutor" defaultValue={workflow.selectedTutor?.shortName || ''} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <option value="">Choose tutor</option>
              {workflow.tutors.map((tutor) => (
                <option key={tutor.shortName} value={tutor.shortName}>{tutor.fullName}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</label>
            <input name="date" type="date" defaultValue={workflow.selectedDate} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" />
          </div>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            <Search className="h-4 w-4" />
            Find lessons
          </button>
        </form>
        {workflow.loadError ? <p className="mt-3 text-sm text-red-700">{workflow.loadError}</p> : null}
      </section>

      {workflow.selectedTutor ? (
        <section className="grid gap-4 md:grid-cols-4">
          <div className={cardClasses()}>
            <p className="text-sm text-slate-500">Tutor</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{workflow.selectedTutor.fullName}</p>
          </div>
          <div className={cardClasses()}>
            <p className="text-sm text-slate-500">Date</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatTutorAbsenceDate(workflow.selectedDate)}</p>
          </div>
          <div className={cardClasses()}>
            <p className="text-sm text-slate-500">Affected lessons</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{workflow.lessons.length}</p>
          </div>
          <div className={cardClasses()}>
            <p className="text-sm text-slate-500">Messages left</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{summary.remainingMessages}</p>
          </div>
        </section>
      ) : null}

      {workflow.selectedTutor && workflow.lessons.length ? (
        <section className={cardClasses()}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Decision</h3>
              <p className="mt-1 text-sm text-slate-600">Keep the choice simple: cancel the day or cover the lessons.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{decisionLabel(decision)}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setDecision('cancel_day');
                setCoverTutorShortName('');
                setSaveState({ pending: false, error: '', savedAt: '' });
              }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${decision === 'cancel_day' ? 'border-red-200 bg-red-50 text-red-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Cancel day
            </button>
            <button
              type="button"
              onClick={() => {
                setDecision('cover');
                setSaveState({ pending: false, error: '', savedAt: '' });
              }}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${decision === 'cover' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Find cover
            </button>
          </div>
          {decision === 'cover' ? (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Cover tutor</label>
              <select
                value={coverTutorShortName}
                onChange={(event) => {
                  setCoverTutorShortName(event.target.value);
                  setSaveState({ pending: false, error: '', savedAt: '' });
                }}
                className="mt-2 w-full max-w-md rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="">Choose cover tutor</option>
                {workflow.coverOptions.map((tutor) => (
                  <option key={tutor.shortName} value={tutor.shortName}>
                    {tutor.fullName} ({tutor.matchedInstruments.join(', ')})
                  </option>
                ))}
              </select>
              {!workflow.coverOptions.length ? <p className="mt-2 text-sm text-amber-800">No same-instrument cover tutors found from the current tutor instrument map.</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {workflow.selectedTutor ? (
        <section className={cardClasses()}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Affected Lessons</h3>
              <p className="mt-1 text-sm text-slate-600">
                Parent messages stay manual: copy, send in WhatsApp, then mark messaged.
              </p>
            </div>
            {workflow.lessons.length ? (
              <button type="button" onClick={setAllMessaged} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50">
                Mark all messaged
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {workflow.lessons.length ? workflow.lessons.map((lesson) => {
              const message = buildTutorAbsenceMessage({
                lesson,
                tutorName: workflow.selectedTutor.fullName,
                absenceDate: workflow.selectedDate,
                decision,
                coverTutorName: selectedCoverTutor?.fullName || '',
              });
              const state = messageState[lesson.eventId] || {};

              return (
                <div key={lesson.eventId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{lesson.lessonTime} · {lesson.studentName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {lesson.instrument || 'Instrument unknown'} · {lesson.durationMinutes || '—'} mins · Parent: {lesson.parentName || 'not visible'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <MessageButton body={message} copiedId={copiedId} copyId={lesson.eventId} onCopy={copyMessage} />
                      <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(state.messaged)}
                          onChange={(event) => updateMessageState(lesson.eventId, { messaged: event.target.checked })}
                        />
                        Messaged
                      </label>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                No student lessons found for this tutor/date.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {workflow.selectedTutor ? (
        <section className={cardClasses()}>
          <h3 className="text-lg font-semibold text-slate-900">Save & Close</h3>
          <textarea
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setSaveState({ pending: false, error: '', savedAt: '' });
            }}
            rows={3}
            placeholder="Internal note from WhatsApp or decision context"
            className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => saveAbsence(summary.remainingMessages ? 'parents_to_message' : 'in_progress')}
              disabled={saveState.pending}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-5 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70"
            >
              {saveState.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save progress
            </button>
            <button
              type="button"
              onClick={() => saveAbsence('resolved')}
              disabled={saveState.pending || !summary.allMessaged}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Resolve absence
            </button>
            {hasSavedAbsence ? (
              <button
                type="button"
                onClick={deleteAbsence}
                disabled={saveState.pending}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-5 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:cursor-wait disabled:opacity-70"
              >
                {saveState.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete logged date
              </button>
            ) : null}
            {saveState.savedAt ? <span className="text-sm text-emerald-700">Saved at {saveState.savedAt}</span> : null}
            {saveState.error ? <span className="text-sm text-red-700">{saveState.error}</span> : null}
          </div>
          {!summary.allMessaged && workflow.lessons.length ? (
            <p className="mt-3 text-sm text-amber-800">Resolve unlocks once all affected parents are marked messaged.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
