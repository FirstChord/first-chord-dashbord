// Shown during hard navigations (initial load, the "Load payroll" pay-date form,
// and the deliberate "↻ Refresh MMS & recalculate" wait). Normal loads now
// stream: the page shell renders straight from the URL and the tutor workspace
// fills in behind its own Suspense boundary, so this is a brief flash rather
// than the whole MMS fetch. Shaped like the real page so the swap isn't jarring.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-pulse" aria-busy="true" aria-label="Loading payroll">
      <header className="border-b border-slate-200 pb-6">
        <div className="h-4 w-20 rounded bg-slate-200" />
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <div className="h-9 w-48 rounded bg-slate-200" />
            <div className="mt-3 h-4 w-80 max-w-full rounded bg-slate-100" />
          </div>
          <div className="h-11 w-44 rounded-xl bg-slate-100" />
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <div className="h-3 w-72 max-w-full rounded bg-slate-100" />
        <div className="h-11 w-56 rounded-xl bg-blue-50" />
      </div>

      <div className="h-16 rounded-2xl border border-slate-200 bg-white/60" />
      <div className="h-96 rounded-[1.4rem] border border-slate-200 bg-white/60" />
    </div>
  );
}
