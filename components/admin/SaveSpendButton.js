'use client';

import { useFormStatus } from 'react-dom';

// Submit button for the add-spend form. Uses the parent <form>'s pending state so the
// user gets immediate feedback ("Saving…") while the server action runs.
export default function SaveSpendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          Saving…
        </>
      ) : (
        'Save spend'
      )}
    </button>
  );
}
