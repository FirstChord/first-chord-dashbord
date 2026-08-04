'use client';

// Without this boundary any throw in an /admin server component renders Next's
// bare "Application error: a server-side exception has occurred" page, which
// tells whoever is standing in front of it nothing and offers no way out. The
// common cause here is a Google Sheets rate limit (60 reads/minute, shared by
// the whole app), which clears on its own within the minute — so the useful
// thing to show is "try again", not a stack trace.
import { useEffect } from 'react';
import Link from 'next/link';

function isRateLimit(error) {
  return /quota|rate limit|429/iu.test(`${error?.message || ''}`);
}

export default function AdminError({ error, reset }) {
  useEffect(() => {
    // The digest is the only handle that ties this screen to the server log
    // line, so make sure it reaches the browser console too.
    console.error('Admin page error', { digest: error?.digest, message: error?.message });
  }, [error]);

  const rateLimited = isRateLimit(error);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">
        {rateLimited ? 'This page hit the Google Sheets read limit' : 'This page could not load'}
      </h1>

      <p className="mt-2 max-w-2xl text-sm text-slate-700">
        {rateLimited
          ? 'The dashboard reads more from Sheets than Google allows in a single minute. It usually clears within a minute — try again.'
          : 'Something failed while loading this page from Sheets or MMS. Nothing was changed.'}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400"
        >
          Back to overview
        </Link>
      </div>

      {error?.digest ? (
        <p className="mt-4 text-xs text-slate-500">
          Reference <code className="font-mono">{error.digest}</code> — quote this to find the matching server log line.
        </p>
      ) : null}
    </div>
  );
}
