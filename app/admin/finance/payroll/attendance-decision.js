'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AttendanceDecision({
  studentId,
  studentName,
  eventId,
  attendanceId,
  pauseEvidence = null,
}) {
  const router = useRouter();
  const [state, setState] = useState({ pending: '', error: '', saved: '' });

  async function decide(attendanceStatus) {
    setState({ pending: attendanceStatus, error: '', saved: '' });
    try {
      const response = await fetch('/api/admin/payroll/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, eventId, attendanceId, attendanceStatus }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Attendance update failed');
      setState({ pending: '', error: '', saved: attendanceStatus });
      router.refresh();
    } catch (error) {
      setState({ pending: '', error: error.message || 'Attendance update failed', saved: '' });
    }
  }

  const disabled = Boolean(state.pending) || !attendanceId;
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
      {pauseEvidence?.found ? (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs ${pauseEvidence.actionable ? 'bg-violet-50 text-violet-900' : 'bg-amber-50 text-amber-900'}`}>
          <span className="font-semibold">Payment pause covers this lesson.</span>
          {' '}{pauseEvidence.startDate} to {pauseEvidence.endDate}
          {!pauseEvidence.actionable ? ' · Check the student match before using it.' : ''}
        </div>
      ) : null}
      <p className="text-xs font-semibold text-slate-700">Set attendance for {studentName || 'student'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {pauseEvidence?.actionable ? (
          <button
            type="button"
            onClick={() => decide('AbsentNotice')}
            disabled={disabled}
            className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {state.pending === 'AbsentNotice' ? 'Saving…' : 'Use pause · £0'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => decide('Present')}
          disabled={disabled}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          {state.pending === 'Present' ? 'Saving…' : 'Present'}
        </button>
        <button
          type="button"
          onClick={() => decide('AbsentNoMakeup')}
          disabled={disabled}
          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
        >
          {state.pending === 'AbsentNoMakeup' ? 'Saving…' : 'Absent · tutor paid'}
        </button>
        {!pauseEvidence?.actionable ? (
          <button
            type="button"
            onClick={() => decide('AbsentNotice')}
            disabled={disabled}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {state.pending === 'AbsentNotice' ? 'Saving…' : 'Cancelled · £0'}
          </button>
        ) : null}
      </div>
      {state.error ? <p className="mt-2 text-xs text-rose-700">{state.error}</p> : null}
      {state.saved ? <p className="mt-2 text-xs font-medium text-emerald-700">Saved to MMS · refreshing payroll…</p> : null}
    </div>
  );
}
