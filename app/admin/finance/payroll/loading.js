// Shown during hard navigations (initial load, the "Load payroll" pay-date form)
// while the server re-fetches MMS attendance — avoids a blank white page.
export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Loading payroll">
      <header>
        <div className="h-4 w-16 rounded bg-slate-200" />
        <div className="mt-4 h-3 w-40 rounded bg-slate-100" />
        <div className="mt-3 h-8 w-64 rounded bg-slate-200" />
        <div className="mt-3 h-3 w-full max-w-3xl rounded bg-slate-100" />
      </header>

      <div className="h-24 rounded-[1.6rem] border border-blue-100 bg-white/60" />

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-white/60" />
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-[1.4rem] border border-slate-200 bg-white/60" />
        ))}
      </div>
    </div>
  );
}
