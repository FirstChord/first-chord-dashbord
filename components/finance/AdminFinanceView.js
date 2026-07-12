import Link from 'next/link';
import ScopeBadge from '@/components/admin/ui/ScopeBadge';
import SaveSpendButton from '@/components/admin/SaveSpendButton';
import { formatMoney } from '@/lib/admin/finance-helpers.mjs';
import { EXPENSE_LOG_CATEGORIES } from '@/lib/admin/cost-helpers.mjs';

function viewHref(view, extras = {}) {
  const query = new URLSearchParams({ view, ...extras });
  return `/admin/finance?${query.toString()}`;
}

function ViewNav({ active = 'overview' }) {
  const items = [
    ['overview', 'Overview'],
    ['plan', 'Plan'],
    ['details', 'Details'],
  ];
  return (
    <nav aria-label="Finance views" className="inline-flex rounded-full border border-slate-200 bg-white/75 p-1 shadow-sm">
      {items.map(([value, label]) => (
        <Link
          key={value}
          href={viewHref(value)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active === value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function FinanceHeader({ view, modelConfidenceLabel, pricedCount, activeCount }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="fc-display text-3xl text-slate-900">Finance</h1>
          <ScopeBadge>Planning estimate</ScopeBadge>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {modelConfidenceLabel} · {pricedCount}/{activeCount} active students priced
        </p>
      </div>
      <ViewNav active={view} />
    </header>
  );
}

function MarginChange({ delta }) {
  if (!delta || !Number.isFinite(delta.abs) || delta.abs === 0) {
    return <span className="text-sm text-slate-500">No change from the last snapshot</span>;
  }
  const improved = delta.abs > 0;
  return (
    <span className={`text-sm font-semibold ${improved ? 'text-emerald-700' : 'text-rose-700'}`}>
      {improved ? '↑' : '↓'} {formatMoney(Math.abs(delta.abs))} from the last snapshot
    </span>
  );
}

function BreakEvenBar({ active, target }) {
  if (!Number.isFinite(target) || target <= 0) return null;
  const scaleMax = Math.max(active, target) * 1.08;
  const activeWidth = Math.min(100, (active / scaleMax) * 100);
  const targetLeft = Math.min(98, (target / scaleMax) * 100);
  const distance = active - target;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-900">Active students</h2>
        <p className={`text-sm font-semibold ${distance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
          {distance >= 0 ? `${distance} above` : `${Math.abs(distance)} below`} break-even
        </p>
      </div>
      <div className="relative mt-4 h-3 rounded-full bg-slate-200" aria-label={`${active} active students; break-even is ${target}`}>
        <div className={`h-3 rounded-full ${distance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${activeWidth}%` }} />
        <div className="absolute -top-2 h-7 w-0.5 bg-slate-900" style={{ left: `${targetLeft}%` }} />
      </div>
      <div className="relative mt-2 h-5 text-xs text-slate-500">
        <span>{active} active</span>
        <span className="absolute -translate-x-1/2 font-medium text-slate-700" style={{ left: `${targetLeft}%` }}>{target} break-even</span>
      </div>
    </div>
  );
}

function ForecastChart({ weeks = [], summary = {} }) {
  const points = weeks.filter((week) => Number.isFinite(week.marginMonthly));
  if (!points.length) return null;
  const width = 720;
  const height = 170;
  const padX = 18;
  const padY = 18;
  const values = points.map((point) => point.marginMonthly);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (index) => padX + (index / Math.max(points.length - 1, 1)) * (width - padX * 2);
  const y = (value) => padY + ((max - value) / span) * (height - padY * 2);
  const line = points.map((point, index) => `${x(index).toFixed(1)},${y(point.marginMonthly).toFixed(1)}`).join(' ');
  const zeroY = y(0);
  const negative = summary.belowBreakEvenWeeks > 0;
  const firstDate = points[0]?.weekStart;
  const lastDate = points[points.length - 1]?.weekStart;
  const labelDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Projected monthly margin over ${points.length} weeks; ${summary.belowBreakEvenWeeks || 0} weeks below break-even`}
        className="block h-44 w-full overflow-visible"
      >
        <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="5 5" />
        <text x={width - padX} y={Math.max(12, zeroY - 6)} textAnchor="end" fill="#64748b" fontSize="11">£0</text>
        <polyline points={line} fill="none" stroke={negative ? '#e11d48' : '#059669'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={point.weekStart || index} cx={x(index)} cy={y(point.marginMonthly)} r={index === points.length - 1 ? 4 : 2.5} fill={negative ? '#e11d48' : '#059669'} />
        ))}
      </svg>
      <figcaption className="flex justify-between text-xs text-slate-500">
        <span>{labelDate(firstDate)}</span>
        <span>{labelDate(lastDate)}</span>
      </figcaption>
    </figure>
  );
}

function ActionLink({ href, children, primary = false }) {
  return (
    <Link
      href={href}
      className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${primary ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
    >
      {children}
    </Link>
  );
}

function Overview({ totals, revenue, trend, scenario, pauseForecast, attentionItems }) {
  const negative = totals.marginMonthly < 0;
  const visibleAttention = attentionItems.slice(0, 3);
  return (
    <div className="space-y-5">
      <section className={`grid gap-6 rounded-[1.5rem] border bg-white/90 p-6 shadow-sm lg:grid-cols-[0.8fr_1.2fr] ${negative ? 'border-rose-200' : 'border-emerald-200'}`}>
        <div>
          <p className="text-sm font-medium text-slate-500">Run-rate margin</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight text-slate-950 tabular-nums">{formatMoney(totals.marginMonthly)}<span className="ml-1 text-xl font-medium text-slate-500">/mo</span></p>
          <p className="mt-3"><MarginChange delta={trend.deltas?.marginMonthly} /></p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            <span><strong className="font-semibold text-slate-900">{revenue.active.count}</strong> active</span>
            <span><strong className="font-semibold text-slate-900">{revenue.paused.count}</strong> paused</span>
            <span><strong className="font-semibold text-slate-900">{formatMoney(totals.totalCostMonthly)}</strong> costs</span>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-5">
          <BreakEvenBar active={revenue.active.count} target={scenario.breakEvenActiveCount} />
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Next 12 weeks</h2>
            <p className="mt-1 text-sm text-slate-500">
              {pauseForecast.summary.belowBreakEvenWeeks
                ? `${pauseForecast.summary.belowBreakEvenWeeks} weeks below break-even`
                : 'Stays above break-even'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Lowest week</p>
            <p className="text-lg font-semibold text-slate-900 tabular-nums">{formatMoney(pauseForecast.summary.trough?.marginMonthly ?? pauseForecast.summary.baseMarginMonthly)}/mo</p>
          </div>
        </div>
        <div className="mt-3"><ForecastChart weeks={pauseForecast.weeks} summary={pauseForecast.summary} /></div>
      </section>

      {visibleAttention.length ? (
        <section className="overflow-hidden rounded-[1.5rem] border border-amber-200 bg-white/90 shadow-sm">
          <div className="border-b border-amber-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Needs attention</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleAttention.map((item) => (
              <div key={item.title} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                {item.href ? <Link href={item.href} className="shrink-0 text-sm font-semibold text-blue-700 hover:underline">Fix →</Link> : null}
              </div>
            ))}
          </div>
          {attentionItems.length > visibleAttention.length ? (
            <Link href={viewHref('details')} className="block border-t border-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">{attentionItems.length - visibleAttention.length} more in Details →</Link>
          ) : null}
        </section>
      ) : (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">✓ No finance checks need attention</p>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <ActionLink href="/admin/finance/payroll" primary>Review payroll</ActionLink>
        <ActionLink href="/admin/finance/reconciliation">Check absences</ActionLink>
        <ActionLink href={viewHref('spend')}>Log spend</ActionLink>
      </section>
    </div>
  );
}

function PlanView({ activeNow, pausedCount, scenario, scenarioStudents, scenarioPricePct, trendPeriod }) {
  const summerPreset = (pct) => -Math.round(activeNow * pct);
  return (
    <div className="space-y-5">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Plan a change</h2>
        <p className="mt-1 text-sm text-slate-500">Change active students or price. Nothing here changes live data.</p>
        <div className="mt-6 rounded-2xl bg-slate-50 p-5">
          <BreakEvenBar active={activeNow} target={scenario.breakEvenActiveCount} />
          <p className="mt-3 text-sm text-slate-500">{pausedCount} students are currently paused.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[['Light summer', 0.1], ['Typical summer', 0.2], ['Deep summer', 0.3]].map(([label, pct]) => (
            <Link key={label} href={viewHref('plan', { students: `${summerPreset(pct)}`, trend: trendPeriod })} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              {label} · {Math.abs(summerPreset(pct))} paused
            </Link>
          ))}
        </div>
        <form method="get" action="/admin/finance" className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="view" value="plan" />
          <input type="hidden" name="trend" value={trendPeriod} />
          <label className="text-sm font-medium text-slate-700">Change in active students<input name="students" type="number" defaultValue={scenarioStudents || ''} placeholder="e.g. -20" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" /></label>
          <label className="text-sm font-medium text-slate-700">Price change %<input name="pricePct" type="number" defaultValue={scenarioPricePct || ''} placeholder="e.g. 5" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" /></label>
          <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">Model it</button>
        </form>
      </section>

      {scenario.isChanged ? (
        <section className={`rounded-[1.5rem] border p-6 shadow-sm ${scenario.scenario.aboveBreakEven ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
          <p className="text-sm font-medium text-slate-600">Modelled margin</p>
          <p className="mt-2 text-4xl font-semibold text-slate-950 tabular-nums">{formatMoney(scenario.scenario.marginMonthly)}<span className="ml-1 text-lg font-medium text-slate-500">/mo</span></p>
          <p className="mt-3 text-sm text-slate-700">{scenario.scenario.activeCount} active · {scenario.scenario.aboveBreakEven ? 'above' : 'below'} break-even · {scenario.scenario.marginDelta >= 0 ? '+' : ''}{formatMoney(scenario.scenario.marginDelta)} vs now</p>
        </section>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value, strong = false }) {
  return <div className={`flex items-center justify-between gap-4 py-2 text-sm ${strong ? 'font-semibold text-slate-950' : 'text-slate-700'}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}

function DetailsView({ totals, revenue, cost, expenses, coverage, attentionItems, calibration, roster, trend }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Monthly model</h2>
          <div className="mt-3 divide-y divide-slate-100">
            <DetailRow label="Gross revenue" value={formatMoney(totals.grossRevenueMonthly)} />
            <DetailRow label="VAT" value={`−${formatMoney(totals.vatLiabilityMonthly)}`} />
            <DetailRow label="Revenue after VAT" value={formatMoney(totals.netRevenueMonthly)} strong />
            <DetailRow label={`Tutor pay · ${cost.slotCount} slots`} value={formatMoney(totals.variableMonthly)} />
            <DetailRow label="Salaries" value={formatMoney(totals.salariedMonthly)} />
            <DetailRow label="Overhead" value={formatMoney(totals.fixedMonthly)} />
            <DetailRow label="Run-rate margin" value={formatMoney(totals.marginMonthly)} strong />
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Model health</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{coverage.coveragePct ?? '—'}%</p>
          <p className="text-sm text-slate-500">{coverage.pricedCount}/{coverage.activeCount} active students priced</p>
          <div className="mt-4 divide-y divide-slate-100">
            {attentionItems.length ? attentionItems.map((item) => (
              <div key={item.title} className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-sm text-slate-700">{item.title}</span>
                {item.href ? <Link href={item.href} className="text-sm font-semibold text-blue-700">Fix →</Link> : null}
              </div>
            )) : <p className="py-3 text-sm font-semibold text-emerald-700">✓ No data-quality checks</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Roster · six months</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xl font-semibold text-emerald-700">+{roster.totals.onboarded}</p><p className="text-xs text-slate-500">joined</p></div>
            <div><p className="text-2xl font-semibold text-rose-700">−{roster.totals.left}</p><p className="text-xs text-slate-500">left</p></div>
            <div><p className="text-2xl font-semibold text-slate-900">{roster.totals.net >= 0 ? '+' : ''}{roster.totals.net}</p><p className="text-xs text-slate-500">net</p></div>
          </div>
          <details className="mt-5 border-t border-slate-100 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Monthly rows</summary>
            <div className="mt-3 divide-y divide-slate-100">{roster.months.map((month) => <DetailRow key={month.month} label={month.month} value={`${month.net >= 0 ? '+' : ''}${month.net}`} />)}</div>
          </details>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Estimate vs Stripe · {calibration.month}</h2>
          <div className="mt-4 divide-y divide-slate-100">
            <DetailRow label="Stripe collected" value={Number.isFinite(calibration.collectedTotal) ? formatMoney(calibration.collectedTotal) : '—'} />
            <DetailRow label="Estimated Stripe billing" value={calibration.estimatedStripeMonthly === null ? '—' : formatMoney(calibration.estimatedStripeMonthly)} />
            <DetailRow label="Gap" value={calibration.deltaPct === null ? '—' : `${calibration.deltaPct > 0 ? '+' : ''}${calibration.deltaPct}%`} strong />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">{calibration.estimateBasis === 'monthly_snapshot' ? 'Compared with the frozen monthly snapshot.' : 'No frozen snapshot for that month; comparison uses today’s estimate.'}</p>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-slate-900">More evidence</h2><p className="mt-1 text-sm text-slate-500">{trend.summary.count} snapshots · {revenue.paused.count} paused · {expenses.lines.length} overhead lines</p></div>
          <div className="flex flex-wrap gap-2">
            <ActionLink href={viewHref('spend')}>Actual spend</ActionLink>
            <ActionLink href="/admin/finance?view=legacy">Full evidence</ActionLink>
          </div>
        </div>
      </section>
    </div>
  );
}

function SpendView({ today, spend, totals, addExpenseLogAction, deleteExpenseLogAction }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <form action={addExpenseLogAction} className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Log spend</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Date<input name="date" type="date" required defaultValue={today} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base" /></label>
          <label className="text-sm font-medium text-slate-700">Amount<input name="amount" type="number" step="0.01" required placeholder="42.50" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base" /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Description<input name="description" required placeholder="Paint for the neighbouring room" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base" /></label>
          <label className="text-sm font-medium text-slate-700">Category<select name="category" defaultValue="Other" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base">{EXPENSE_LOG_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Area<input name="linked_area" placeholder="Room / Showcase" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base" /></label>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2"><input name="reimbursable" type="checkbox" className="h-4 w-4" /> Needs reimbursed</label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Notes<textarea name="notes" rows={2} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base" /></label>
        </div>
        <SaveSpendButton />
      </form>
      <section className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <p className="text-sm text-slate-500">This month</p>
        <p className="mt-1 text-4xl font-semibold text-slate-950 tabular-nums">{formatMoney(spend.monthTotal)}</p>
        <p className="mt-2 text-sm text-slate-500">Cash-view margin {formatMoney(totals.cashViewMarginMonthToDate)}</p>
        <div className="mt-5 divide-y divide-slate-100">
          {spend.latestEntries.length ? spend.latestEntries.map((entry) => (
            <div key={entry.expenseId || `${entry.date}-${entry.description}`} className="flex items-center justify-between gap-4 py-3">
              <div><p className="text-sm font-medium text-slate-900">{entry.description}</p><p className="text-xs text-slate-500">{entry.date} · {entry.category}</p></div>
              <div className="flex items-center gap-2"><span className="font-semibold tabular-nums text-slate-900">{formatMoney(entry.amount)}</span>{entry.expenseId ? <form action={deleteExpenseLogAction}><input type="hidden" name="expense_id" value={entry.expenseId} /><button type="submit" aria-label={`Delete ${entry.description}`} className="rounded-full px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">×</button></form> : null}</div>
            </div>
          )) : <p className="py-4 text-sm text-slate-500">No spend logged this month.</p>}
        </div>
      </section>
    </div>
  );
}

export default function AdminFinanceView({
  view = 'overview',
  modelConfidenceLabel,
  totals,
  revenue,
  cost,
  expenses,
  coverage,
  trend,
  scenario,
  scenarioStudents,
  scenarioPricePct,
  trendPeriod,
  pauseForecast,
  attentionItems,
  calibration,
  roster,
  spend,
  today,
  addExpenseLogAction,
  deleteExpenseLogAction,
}) {
  return (
    <div className="space-y-6">
      <FinanceHeader view={view} modelConfidenceLabel={modelConfidenceLabel} pricedCount={coverage.pricedCount} activeCount={coverage.activeCount} />
      {view === 'plan' ? <PlanView activeNow={revenue.active.count} pausedCount={revenue.paused.count} scenario={scenario} scenarioStudents={scenarioStudents} scenarioPricePct={scenarioPricePct} trendPeriod={trendPeriod} /> : null}
      {view === 'details' ? <DetailsView totals={totals} revenue={revenue} cost={cost} expenses={expenses} coverage={coverage} attentionItems={attentionItems} calibration={calibration} roster={roster} trend={trend} /> : null}
      {view === 'spend' ? <SpendView today={today} spend={spend} totals={totals} addExpenseLogAction={addExpenseLogAction} deleteExpenseLogAction={deleteExpenseLogAction} /> : null}
      {!['plan', 'details', 'spend'].includes(view) ? <Overview totals={totals} revenue={revenue} trend={trend} scenario={scenario} pauseForecast={pauseForecast} attentionItems={attentionItems} /> : null}
    </div>
  );
}
