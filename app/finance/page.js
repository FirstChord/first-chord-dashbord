import { getOperationalAdminStudents } from '@/lib/admin/students';
import { getScheduleContextRows, getTutorPayRows, getExpenseRows } from '@/lib/admin/sheets';
import { enrichScheduleContextsWithSharedSlots } from '@/lib/admin/schedule-context-helpers.mjs';
import { buildFinanceOverview, formatMoney } from '@/lib/admin/finance-helpers.mjs';
import { parseTutorPay } from '@/lib/admin/cost-helpers.mjs';

export const dynamic = 'force-dynamic';

function StatCard({ label, value, helper = '', tone = 'border-blue-100 bg-white/90' }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] ${tone}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-600">{helper}</p> : null}
    </div>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 ${strong ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm tabular-nums">{value}</span>
    </div>
  );
}

export default async function FinancePage() {
  const [students, scheduleRows, tutorPayRows, expenseRows] = await Promise.all([
    getOperationalAdminStudents(),
    getScheduleContextRows(),
    getTutorPayRows(),
    getExpenseRows(),
  ]);
  const scheduleByMmsId = enrichScheduleContextsWithSharedSlots(scheduleRows);
  const enriched = students.map((student) => ({
    ...student,
    scheduleContext: scheduleByMmsId.get(student.mmsId) || student.scheduleContext || null,
  }));
  const tutorPay = parseTutorPay(tutorPayRows);
  const o = buildFinanceOverview(enriched, { tutorPay, expenseRows });
  const { revenue, cost, expenses, totals } = o;

  const marginTone = totals.marginMonthly >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50';

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Internal · estimate</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Finance</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Estimated monthly run-rate and margin from active students × the price table, minus tutor pay and overhead.
          Not Stripe actuals, not accounting.
        </p>
      </header>

      <section className={`rounded-[1.6rem] border p-6 shadow-sm ${marginTone}`}>
        <p className="text-sm text-slate-600">Estimated monthly margin</p>
        <p className="mt-1 text-4xl font-bold text-slate-900">{formatMoney(totals.marginMonthly)}</p>
        <p className="mt-2 text-sm text-slate-700">
          {formatMoney(totals.revenueMonthly)} revenue − {formatMoney(totals.totalCostMonthly)} costs
          {totals.marginPct !== null ? ` · ${totals.marginPct}% margin` : ''}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Revenue (monthly)" value={formatMoney(totals.revenueMonthly)} helper={`${revenue.active.count} active · ${formatMoney(revenue.active.weekly)}/wk`} />
        <StatCard label="Costs (monthly)" value={formatMoney(totals.totalCostMonthly)} helper="Tutor pay + salaries + overhead" tone="border-amber-100 bg-amber-50/60" />
        <StatCard label="Paused (not billing)" value={formatMoney(revenue.paused.weekly)} helper={`${revenue.paused.count} students · per week`} tone="border-violet-100 bg-violet-50/60" />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-5">
          <h2 className="px-4 text-base font-semibold text-slate-900">Revenue (monthly)</h2>
          <div className="mt-3 divide-y divide-slate-100">
            <Row label={`One-to-one · ${revenue.byLessonKind.one_to_one.count}`} value={`${formatMoney(revenue.byLessonKind.one_to_one.weekly)}/wk`} />
            <Row label={`Group · ${revenue.byLessonKind.group.count}`} value={`${formatMoney(revenue.byLessonKind.group.weekly)}/wk`} />
            <Row label={`Orchestra · ${revenue.byLessonKind.orchestra.count}`} value={`${formatMoney(revenue.byLessonKind.orchestra.weekly)}/wk`} />
            <Row label="Total revenue" value={formatMoney(totals.revenueMonthly)} strong />
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-amber-100 bg-white/90 p-5">
          <h2 className="px-4 text-base font-semibold text-slate-900">Costs (monthly)</h2>
          <div className="mt-3 divide-y divide-slate-100">
            <Row label={`Variable tutor pay · ${cost.slotCount} slots`} value={formatMoney(totals.variableMonthly)} />
            <Row label={`Salaries · ${cost.salariedTutors.length}`} value={formatMoney(totals.salariedMonthly)} />
            <Row label="Fixed overhead" value={formatMoney(totals.fixedMonthly)} />
            <Row label="Total costs" value={formatMoney(totals.totalCostMonthly)} strong />
          </div>
          {cost.unpricedSlots ? (
            <p className="mt-3 px-4 text-xs text-amber-700">{cost.unpricedSlots} slot(s) excluded — no duration on file.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Overhead lines</h2>
        <div className="mt-2 divide-y divide-slate-100">
          {expenses.lines.length
            ? expenses.lines.map((line) => (
                <Row key={line.name} label={`${line.name}${line.category ? ` · ${line.category}` : ''}`} value={`${formatMoney(line.monthly)}/mo`} />
              ))
            : <p className="px-4 py-2 text-sm text-slate-500">No expense lines yet — add them to the Expenses sheet.</p>}
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Estimate from schedule × price table; tutor pay modelled from scheduled active slots (per slot, paused excluded).
        Salaries and overhead come from the Tutor_Pay and Expenses sheets. Weekly snapshots are logged to Finance_Snapshot.
      </p>
    </div>
  );
}
