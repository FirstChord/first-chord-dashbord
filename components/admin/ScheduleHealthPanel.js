'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';

function formatChecked(value) {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function reasonClass(reason) {
  if (reason === 'error' || reason === 'no schedule') return 'bg-red-50 text-red-700 border-red-100';
  if (reason === 'past lesson' || reason === 'stale') return 'bg-amber-50 text-amber-800 border-amber-100';
  if (reason === 'low confidence') return 'bg-blue-50 text-blue-800 border-blue-100';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function ScheduleHealthPanel({ items = [] }) {
  const router = useRouter();
  const [bulkPending, setBulkPending] = useState(false);
  const [rowPending, setRowPending] = useState({});
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  async function refreshIds(ids, { bulk = false } = {}) {
    if (!ids.length) return;
    setError('');
    setResult('');
    if (bulk) setBulkPending(true);
    else setRowPending((current) => ({ ...current, [ids[0]]: true }));
    try {
      const response = await fetch('/api/admin/schedule/refresh-stale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mmsIds: ids }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Schedule refresh failed');
      }
      const failedCount = (data.failed || []).length;
      setResult(
        `Refreshed ${data.refreshed} schedule${data.refreshed === 1 ? '' : 's'}`
        + (failedCount ? `, ${failedCount} failed` : '')
        + (data.capped ? ` (capped at 60 — run again for the rest)` : '')
        + '.',
      );
      router.refresh(); // re-run the server page so healed rows drop off the list
    } catch (caught) {
      setError(caught.message || 'Schedule refresh failed');
    } finally {
      if (bulk) setBulkPending(false);
      else setRowPending((current) => ({ ...current, [ids[0]]: false }));
    }
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
        All cached student schedules look current — nothing stale, missing, or behind MMS.
      </div>
    );
  }

  return (
    <div className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">Schedules needing a refresh</h4>
          <p className="mt-1 text-sm text-slate-600">
            {items.length} student{items.length === 1 ? '' : 's'} with a stale, missing, or behind-MMS cache. Refresh pulls the live lesson slot from MMS.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshIds(items.map((item) => item.mmsId), { bulk: true })}
          disabled={bulkPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {bulkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh all stale
        </button>
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {result ? <p className="mt-3 text-sm font-semibold text-emerald-700">{result}</p> : null}

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item.mmsId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {item.studentName}
                {item.teacherName ? <span className="font-normal text-slate-500"> · {item.teacherName}</span> : null}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {item.reasons.map((reason) => (
                  <span key={reason} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${reasonClass(reason)}`}>
                    {reason}
                  </span>
                ))}
                <span className="text-[11px] text-slate-400">checked {formatChecked(item.checkedAt)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refreshIds([item.mmsId])}
              disabled={Boolean(rowPending[item.mmsId]) || bulkPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rowPending[item.mmsId] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
