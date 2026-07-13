'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

// Soft client-side navigation for the per-tutor window override so the page
// doesn't blank out (full GET nav) while the server re-fetches MMS attendance.
// useTransition keeps the current cards on screen and shows a pending state.
export default function AdjustWindowForm({ payDate, tutor, start, end }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [startValue, setStartValue] = useState(start || '');
  const [endValue, setEndValue] = useState(end || '');

  // The selected tutor can change without a full page load, so keep the
  // controls aligned with the window shown on the active card.
  useEffect(() => {
    setStartValue(start || '');
    setEndValue(end || '');
  }, [start, end, tutor]);

  function adjustWindow() {
    const params = new URLSearchParams();
    params.set('payDate', payDate);
    params.set('tutor', tutor);
    const cleanStart = `${startValue || ''}`.trim();
    const cleanEnd = `${endValue || ''}`.trim();
    if (cleanStart) params.set('start', cleanStart);
    if (cleanEnd) params.set('end', cleanEnd);
    startTransition(() => {
      router.push(`/admin/finance/payroll?${params.toString()}`, { scroll: false });
    });
  }

  return (
    // This sits inside the main payroll save form. It must not render another
    // form: nested forms make browsers submit the outer payroll action instead
    // of applying the date window.
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label className="text-xs text-slate-500">
        Window start
        <input
          type="date"
          value={startValue}
          onChange={(event) => setStartValue(event.target.value)}
          className="ml-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
        />
      </label>
      <label className="text-xs text-slate-500">
        end
        <input
          type="date"
          value={endValue}
          onChange={(event) => setEndValue(event.target.value)}
          className="ml-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
        />
      </label>
      <button
        type="button"
        onClick={adjustWindow}
        disabled={isPending}
        aria-busy={isPending}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Adjusting…' : 'Adjust window'}
      </button>
    </div>
  );
}
