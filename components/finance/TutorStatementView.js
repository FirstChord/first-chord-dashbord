import { formatPayrollDate } from '@/lib/admin/payroll-helpers.mjs';
import { formatMoney } from '@/lib/admin/finance-helpers.mjs';

function hoursLabel(minutes) {
  const m = Number(minutes) || 0;
  if (!m) return '0h';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h${rem ? ` ${rem}m` : ''}`;
}

// Presentational, read-only statement card. Shared by the admin view and the
// public signed-link view so the tutor sees exactly what the admin sees.
export default function TutorStatementView({ statement }) {
  if (!statement) return null;
  const lines = statement.lines || [];
  return (
    <article className="rounded-[1.4rem] border border-slate-200 bg-white/95 p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">First Chord Music School</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-900">Pay statement</h2>
      <p className="mt-1 text-lg font-semibold text-slate-800">{statement.tutor}</p>
      <p className="text-sm text-slate-500">
        {formatPayrollDate(statement.periodStart)} – {formatPayrollDate(statement.periodEnd)} · {statement.cadence}
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-sm">
          <tbody>
            {lines.length ? lines.map((line, index) => (
              <tr key={`${line.date}-${index}`} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatPayrollDate(line.date, { withTime: true })}</td>
                <td className="px-4 py-2 text-slate-900">
                  {line.student}
                  {line.isGroup ? <span className="ml-1 text-slate-400">(group)</span> : null}
                  {line.isCover ? <span className="ml-1 text-slate-400">(cover)</span> : null}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{line.minutes} min</td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-900">{line.amount !== null ? formatMoney(line.amount) : '—'}</td>
              </tr>
            )) : (
              <tr><td className="px-4 py-3 text-slate-400">No payable lessons found for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-sm font-semibold text-slate-700">{statement.lessonCount} lessons · {hoursLabel(statement.teachingMinutes)}</span>
        <span className="text-2xl font-bold text-slate-900">{formatMoney(statement.total)}</span>
      </div>

      {statement.hasUnrecorded ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Some lessons in this period aren’t yet marked in the register, so this figure may still change.
        </p>
      ) : null}

      <p className="mt-5 text-sm text-slate-500">If anything looks off, just reply and we’ll sort it before payment. Thank you!</p>
    </article>
  );
}
