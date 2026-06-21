// Shown instantly while any /admin page fetches its server data (Sheets/MMS), so
// navigation feels immediate instead of the previous page sitting frozen. The
// admin layout (nav + header) stays put; only this content area swaps to the
// skeleton. Covers every admin route via the segment Suspense boundary.
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded bg-slate-200/70" />
        <div className="h-8 w-64 rounded bg-slate-300/70" />
        <div className="h-4 w-full max-w-2xl rounded bg-slate-200/60" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm">
            <div className="h-3 w-24 rounded bg-slate-200/70" />
            <div className="mt-4 h-7 w-16 rounded bg-slate-300/70" />
            <div className="mt-3 h-3 w-full rounded bg-slate-200/60" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-48 rounded bg-slate-300/70" />
              <div className="h-6 w-20 rounded-full bg-slate-200/70" />
            </div>
            <div className="mt-3 h-3 w-full max-w-xl rounded bg-slate-200/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
