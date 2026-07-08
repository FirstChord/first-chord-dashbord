// The right-side slide-over shell used for focused panels (edit plan, student
// record, workflow/pause-tool iframes): full-screen overlay that closes on
// click, panel sliding in from the right with an eyebrow/title header and a
// Close button. Callers own the body: pass an iframe (h-full w-full flex-1
// border-0) or a scrollable div (flex-1 overflow-y-auto p-5) as children, and
// any extra header buttons via `actions` (panelActionClass matches Close).

export const panelActionClass = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100';

export function SlideOverPanel({ eyebrow, title, onClose, actions = null, maxWidth = 'max-w-3xl', children }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside className={`flex h-full w-full ${maxWidth} flex-col border-l border-slate-200 bg-white shadow-2xl`}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-500">{eyebrow}</p>
            <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {actions}
            <button type="button" onClick={onClose} className={panelActionClass}>
              Close ✕
            </button>
          </div>
        </header>
        {children}
      </aside>
    </div>
  );
}
