'use client';

import { useState } from 'react';

// Copies a given string (statement text or the share link) to the clipboard,
// with a brief "Copied ✓" confirmation.
export default function CopyStatementButton({ text = '', label = 'Copy', className = '', markSentPayrollId = '' }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      if (markSentPayrollId) {
        const response = await fetch('/api/admin/payroll/statement-sent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payrollId: markSentPayrollId }),
        });
        if (!response.ok) throw new Error('Could not mark statement sent');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={className || 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]'}
    >
      {copied ? (markSentPayrollId ? 'Copied · marked sent ✓' : 'Copied ✓') : label}
    </button>
  );
}
