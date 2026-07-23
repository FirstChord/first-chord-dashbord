'use client';

import { useCallback, useEffect, useState } from 'react';
import StudentNotes from './StudentNotes';

export default function StudentNotesGate({ studentId, studentName = '' }) {
  const [state, setState] = useState({ status: 'loading', notes: null, notesSuccess: false, protectionEnabled: false });
  const [code, setCode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');

  const loadNotes = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`/api/student-portal/${encodeURIComponent(studentId)}/notes`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json();
      if (response.status === 401 && payload.status === 'locked') {
        setState({ status: 'locked', notes: null, notesSuccess: false, protectionEnabled: true });
        return;
      }
      if (!response.ok) {
        setState({
          status: 'unavailable',
          notes: null,
          notesSuccess: false,
          protectionEnabled: Boolean(payload.protectionEnabled),
          message: payload.message || 'Notes are temporarily unavailable. Please try again shortly.',
        });
        return;
      }
      setState(payload);
    } catch {
      setState({
        status: 'unavailable',
        notes: null,
        notesSuccess: false,
        protectionEnabled: false,
        message: 'Notes are temporarily unavailable. Please try again shortly.',
      });
    }
  }, [studentId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  async function unlock(event) {
    event.preventDefault();
    setUnlocking(true);
    setError('');
    try {
      const response = await fetch(`/api/student-portal/${encodeURIComponent(studentId)}/notes/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Unable to unlock notes');
        return;
      }
      setCode('');
      await loadNotes();
    } catch {
      setError('Unable to unlock notes right now. Please try again.');
    } finally {
      setUnlocking(false);
    }
  }

  async function lock() {
    await fetch(`/api/student-portal/${encodeURIComponent(studentId)}/notes/unlock`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => {});
    setState({ status: 'locked', notes: null, notesSuccess: false, protectionEnabled: true });
  }

  if (state.status === 'loading') {
    return (
      <section className="rounded-2xl bg-white/90 p-6 shadow-xl">
        <h2 className="text-xl font-bold text-gray-900">Practice Chat</h2>
        <p className="mt-3 text-sm text-gray-600">Loading lesson notes…</p>
      </section>
    );
  }

  if (state.status === 'locked') {
    return (
      <section className="rounded-2xl bg-white/95 p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Private lesson notes</p>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">Practice Chat</h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Enter the notes code from your First Chord WhatsApp group description. You’ll normally only need to do this once on this device.
        </p>
        <form onSubmit={unlock} className="mt-5 max-w-md">
          <label className="block text-sm font-semibold text-gray-800" htmlFor={`notes-code-${studentId}`}>
            Notes code
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id={`notes-code-${studentId}`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              required
              placeholder="e.g. otter-27"
              className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="submit"
              disabled={unlocking || !code.trim()}
              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {unlocking ? 'Checking…' : 'Unlock notes'}
            </button>
          </div>
          {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        </form>
      </section>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <section className="rounded-2xl bg-white/90 p-6 shadow-xl">
        <h2 className="text-xl font-bold text-gray-900">Practice Chat</h2>
        <p className="mt-3 text-sm text-gray-600">{state.message}</p>
        <button type="button" onClick={loadNotes} className="mt-4 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
          Try again
        </button>
      </section>
    );
  }

  return (
    <div>
      <StudentNotes notes={state.notes} notesSuccess={state.notesSuccess} studentName={studentName} />
      {state.protectionEnabled ? (
        <button type="button" onClick={lock} className="mt-3 text-sm font-medium text-gray-600 underline underline-offset-4">
          Lock notes on this device
        </button>
      ) : null}
    </div>
  );
}
