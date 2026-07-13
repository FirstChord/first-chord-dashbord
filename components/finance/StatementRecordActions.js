'use client';

export default function StatementRecordActions({ reference = '', isReceipt = false }) {
  function printRecord() {
    const previousTitle = document.title;
    const kind = isReceipt ? 'payment-receipt' : 'payment-statement';
    document.title = `${reference || 'first-chord'}-${kind}`;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.print();
    // Some mobile browsers do not emit afterprint.
    window.setTimeout(restoreTitle, 3000);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm print:hidden">
      <div>
        <p className="text-sm font-semibold text-slate-800">Keep this for your records</p>
        <p className="text-xs text-slate-500">Print it or choose “Save as PDF” on your device.</p>
      </div>
      <button
        type="button"
        onClick={printRecord}
        className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
      >
        Print or save PDF
      </button>
    </div>
  );
}
