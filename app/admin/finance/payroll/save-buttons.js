'use client';

import { useFormStatus } from 'react-dom';
import { useState } from 'react';

// Mark reviewed / Mark paid buttons with real feedback: the clicked button
// depresses and shows a spinner + "Saving…" while the server action runs
// (useFormStatus), and once saved the button reflects the persisted state with a
// tick ("Reviewed ✓" / "Paid ✓") — the component remounts on revalidation, so
// the tick is driven by the actual saved status, not a transient toast.
export default function PayrollSaveButtons({ status }) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState('');

  const isReviewed = status === 'reviewed' || status === 'paid';
  const isPaid = status === 'paid';

  function Spinner() {
    return (
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="flex items-end gap-2">
      <button
        name="status"
        value="reviewed"
        onClick={() => setClicked('reviewed')}
        disabled={pending}
        aria-busy={pending && clicked === 'reviewed'}
        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && clicked === 'reviewed' ? (
          <><Spinner /> Saving…</>
        ) : isReviewed ? (
          'Reviewed ✓'
        ) : (
          'Mark reviewed'
        )}
      </button>
      <button
        name="status"
        value="paid"
        onClick={() => setClicked('paid')}
        disabled={pending}
        aria-busy={pending && clicked === 'paid'}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && clicked === 'paid' ? (
          <><Spinner /> Saving…</>
        ) : isPaid ? (
          'Paid ✓'
        ) : (
          'Mark paid'
        )}
      </button>
    </div>
  );
}
