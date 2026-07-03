'use client';

import { formatAgeChip } from '@/lib/admin/age-helpers.mjs';

// Quiet "how long has this sat here" signal for workflow cards. Renders
// nothing for fresh items (under 2 days) so calm stays the default.
export function AgeChip({ updatedAt, className = '' }) {
  const label = formatAgeChip(updatedAt);
  if (!label) return null;

  return (
    <span
      title={`Last updated ${String(updatedAt).slice(0, 10)}`}
      className={`rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ${className}`.trim()}
    >
      {label}
    </span>
  );
}
