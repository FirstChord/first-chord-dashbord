'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

// Soft client-side navigation for the per-tutor window override so the page
// doesn't blank out (full GET nav) while the server re-fetches MMS attendance.
// useTransition keeps the current cards on screen and shows a pending state.
export default function AdjustWindowForm({ payDate, tutor, start, end }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    params.set('payDate', payDate);
    params.set('tutor', tutor);
    const startValue = `${form.get('start') || ''}`.trim();
    const endValue = `${form.get('end') || ''}`.trim();
    if (startValue) params.set('start', startValue);
    if (endValue) params.set('end', endValue);
    startTransition(() => {
      router.push(`/admin/finance/payroll?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-wrap items-center gap-2">
      <label className="text-xs text-slate-500">
        Window start
        <input type="date" name="start" defaultValue={start} className="ml-1 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
      </label>
      <label className="text-xs text-slate-500">
        end
        <input type="date" name="end" defaultValue={end} className="ml-1 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
      </label>
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Adjusting…' : 'Adjust window'}
      </button>
    </form>
  );
}
