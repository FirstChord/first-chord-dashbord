import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { getOperationalAdminStudents } from '@/lib/admin/students';
import { appendExpenseLogRow, getScheduleContextRows, getTutorPayRows, getExpenseRows, getExpenseLogRows } from '@/lib/admin/sheets';
import { enrichScheduleContextsWithSharedSlots } from '@/lib/admin/schedule-context-helpers.mjs';
import { buildFinanceOverview, formatMoney } from '@/lib/admin/finance-helpers.mjs';
import { buildExpenseLogSummary, EXPENSE_LOG_CATEGORIES, parseTutorPay } from '@/lib/admin/cost-helpers.mjs';
import { buildFinanceCoverage, FLAG_LABELS as FINANCE_FLAG_LABELS } from '@/lib/admin/finance-coverage.mjs';
import { authOptions } from '@/lib/admin/auth';
import SaveSpendButton from '@/components/admin/SaveSpendButton';

export const dynamic = 'force-dynamic';

async function addExpenseLogAction(formData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new Error('Not authorised');
  }

  const amount = `${formData.get('amount') || ''}`.trim();
  const description = `${formData.get('description') || ''}`.trim();
  if (!amount || !description) {
    throw new Error('Expense amount and description are required');
  }

  const now = new Date();
  await appendExpenseLogRow({
    expense_id: `expense_${now.getTime()}_${randomUUID().slice(0, 8)}`,
    date: `${formData.get('date') || now.toISOString().slice(0, 10)}`.trim(),
    amount,
    category: `${formData.get('category') || 'Other'}`.trim(),
    description,
    paid_by: 'First Chord',
    reimbursable: formData.get('reimbursable') === 'on' ? 'yes' : 'no',
    linked_area: `${formData.get('linked_area') || ''}`.trim(),
    notes: `${formData.get('notes') || ''}`.trim(),
    created_at: now.toISOString(),
    created_by: session.user.email || '',
  });

  revalidatePath('/admin/finance');
}

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

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TextInput({ label, name, type = 'text', required = false, placeholder = '', defaultValue = '' }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

export default async function AdminFinancePage() {
  const [students, scheduleRows, tutorPayRows, expenseRows, expenseLogRows] = await Promise.all([
    getOperationalAdminStudents(),
    getScheduleContextRows(),
    getTutorPayRows(),
    getExpenseRows(),
    getExpenseLogRows(),
  ]);
  const scheduleByMmsId = enrichScheduleContextsWithSharedSlots(scheduleRows);
  const enriched = students.map((student) => ({
    ...student,
    scheduleContext: scheduleByMmsId.get(student.mmsId) || student.scheduleContext || null,
  }));
  const tutorPay = parseTutorPay(tutorPayRows);
  const o = buildFinanceOverview(enriched, { tutorPay, expenseRows, expenseLogRows });
  const { revenue, cost, expenses, totals } = o;
  const spend = o.actualSpend || buildExpenseLogSummary(expenseLogRows);
  const coverage = buildFinanceCoverage(enriched, { tutorPay });

  const marginTone = totals.marginMonthly >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Internal · estimate</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Finance
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Estimated monthly run-rate and margin from active students × the price table, minus tutor pay and overhead.
          Not Stripe actuals, not accounting.
        </p>
      </header>

      <section className={`rounded-[1.6rem] border p-6 shadow-sm ${marginTone}`}>
        <p className="text-sm text-slate-600">Estimated monthly margin</p>
        <p className="mt-1 text-4xl font-bold text-slate-900">{formatMoney(totals.marginMonthly)}</p>
        <p className="mt-2 text-sm text-slate-700">
          {formatMoney(totals.revenueMonthly)} revenue - {formatMoney(totals.totalCostMonthly)} costs
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
            <p className="mt-3 px-4 text-xs text-amber-700">{cost.unpricedSlots} slot(s) excluded - no duration on file.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Overhead lines</h2>
        <p className="mt-1 text-xs text-slate-500">Recurring assumptions that affect the run-rate margin.</p>
        <div className="mt-2 divide-y divide-slate-100">
          {expenses.lines.length
            ? expenses.lines.map((line) => (
                <Row key={line.name} label={`${line.name}${line.category ? ` · ${line.category}` : ''}`} value={`${formatMoney(line.monthly)}/mo`} />
              ))
            : <p className="px-4 py-2 text-sm text-slate-500">No expense lines yet - add them to the Expenses sheet.</p>}
        </div>
        {expenses.skippedGeneralMonthly ? (
          <p className="mt-3 px-4 text-xs text-slate-500">
            General buffer excluded: {formatMoney(expenses.skippedGeneralMonthly)}/mo. Miscellaneous spend now comes from Expense_Log.
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form action={addExpenseLogAction} className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Add actual spend</h2>
          <p className="mt-1 text-sm text-slate-600">
            Quick log for things from the bank account: paint, repairs, coffees, lunches, one-off room improvements.
            This does not change the run-rate margin.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TextInput label="Date" name="date" type="date" required defaultValue={today} />
            <TextInput label="Amount" name="amount" type="number" required placeholder="42.50" />
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Description</span>
              <input
                name="description"
                required
                placeholder="Paint for neighbouring room"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Category</span>
              <select
                name="category"
                defaultValue="Other"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                {EXPENSE_LOG_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
            <TextInput label="Area" name="linked_area" placeholder="Room / Showcase / Marketing" />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input name="reimbursable" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
              Needs reimbursed
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Notes</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Optional context for month-end bank check"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
          <SaveSpendButton />
        </form>

        <div className="rounded-[1.6rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Actual spend this month</h2>
              <p className="mt-1 text-sm text-slate-600">
                Use this at month-end to check the bank account and fill in any missing one-off spend.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-right">
              <p className="text-xs text-slate-500">{spend.currentMonth}</p>
              <p className="text-2xl font-semibold text-slate-900">{formatMoney(spend.monthTotal)}</p>
            </div>
          </div>
          <p className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Cash-view margin after this month&apos;s actual spend: <strong>{formatMoney(totals.cashViewMarginMonthToDate)}</strong>.
            This month-to-date spend is included in `Finance_Snapshot`; the main run-rate margin still excludes it.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">By category</h3>
              <div className="mt-2 divide-y divide-slate-100">
                {spend.byCategory.length
                  ? spend.byCategory.map((line) => (
                    <Row key={line.category} label={`${line.category} · ${line.count}`} value={formatMoney(line.amount)} />
                  ))
                  : <p className="px-4 py-2 text-sm text-slate-500">No spend logged this month yet.</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Latest entries</h3>
              <div className="mt-2 space-y-2">
                {spend.latestEntries.length
                  ? spend.latestEntries.map((entry) => (
                    <div key={entry.expenseId || `${entry.date}-${entry.description}`} className="rounded-xl bg-white px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{entry.description}</p>
                          <p className="text-xs text-slate-500">{formatDate(entry.date)} · {entry.category}{entry.paidBy ? ` · ${entry.paidBy}` : ''}</p>
                        </div>
                        <p className="font-semibold tabular-nums text-slate-900">{formatMoney(entry.amount)}</p>
                      </div>
                    </div>
                  ))
                  : <p className="text-sm text-slate-500">No actual spend rows yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Estimate coverage</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              How much of the active roster the estimate can actually price. Gaps here quietly distort revenue, cost,
              margin, and every logged snapshot — fix the source data to tighten the numbers.
            </p>
          </div>
          <div className={`rounded-2xl px-4 py-2 text-right ${coverage.isClean ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <p className="text-xs text-slate-500">priced / active</p>
            <p className="text-2xl font-semibold text-slate-900">
              {coverage.coveragePct === null ? '—' : `${coverage.coveragePct}%`}
            </p>
            <p className="text-xs text-slate-500">{coverage.pricedCount}/{coverage.activeCount}</p>
          </div>
        </div>

        {coverage.isClean ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            All active students are priced with a resolved tutor — no data gaps detected.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(coverage.flagCounts)
                .filter(([, count]) => count > 0)
                .map(([flag, count]) => (
                  <span key={flag} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                    {FINANCE_FLAG_LABELS[flag] || flag}: {count}
                  </span>
                ))}
            </div>

            {coverage.tutorsNotInPayTable.length ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Tutors on the default £24/hr rate</h3>
                <p className="mt-1 text-xs text-slate-600">
                  These tutors aren&apos;t listed in Tutor_Pay, so cost assumes £24/hr. Fine for hourly tutors — but if any
                  should be salaried or on a different rate (or this is a name variant of a salaried tutor), add a row/alias.
                </p>
                <div className="mt-2 divide-y divide-amber-100">
                  {coverage.tutorsNotInPayTable.map((t) => (
                    <Row key={t.tutor} label={t.tutor} value={`${t.studentCount} active`} />
                  ))}
                </div>
              </div>
            ) : null}

            <details className="mt-4 group">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                {coverage.flagged.length} student(s) with data gaps
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Tutor</th>
                      <th className="px-3 py-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {coverage.flagged.map((row) => (
                      <tr key={row.mmsId || row.name}>
                        <td className="px-3 py-2 text-slate-800">{row.name}</td>
                        <td className="px-3 py-2 text-slate-600">{row.tutor || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.flagLabels.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Estimate from schedule × price table; tutor pay modelled from scheduled active slots (per slot, paused excluded).
        Salaries and overhead come from the Tutor_Pay and Expenses sheets. Actual spend is logged separately in Expense_Log.
        Weekly and monthly snapshots include the current calendar month&apos;s actual spend so the number resets naturally each month.
      </p>
    </div>
  );
}
