import AdminWaitingPageClient from '@/components/admin/AdminWaitingPageClient';
import { getWaitingStudentsWithCapacity } from '@/lib/admin/waiting-capacity';
import { buildCapacityValue } from '@/lib/admin/capacity-value.mjs';
import { formatMoney } from '@/lib/admin/finance-helpers.mjs';

function ValueStat({ label, value, helper = '', tone = 'border-blue-100 bg-white/90' }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-600">{helper}</p> : null}
    </div>
  );
}

function CapacityValuePanel({ value }) {
  const reasonLabel = { not_taught: 'need a tutor', no_free_slots: 'taught but full — need hours' };
  return (
    <section className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
      <h2 className="text-base font-semibold text-slate-900">Waiting list value</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        What the waiting list is worth and what&apos;s blocking it. £ is the estimated monthly margin contribution from
        recent entries only (≤{value.freshDays} days), valued as a standard 30-min lesson — a conservative, honest figure.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ValueStat
          label="Bookable now"
          value={formatMoney(value.bookableNow.contributionMonthly)}
          helper={`${value.bookableNow.freshCount} recent fit a free slot — schedule these (${formatMoney(value.bookableNow.revenueMonthly)}/mo revenue)`}
          tone="border-emerald-200 bg-emerald-50"
        />
        <ValueStat
          label="Blocked on tutor-hours"
          value={formatMoney(value.blocked.contributionMonthly)}
          helper={`${value.needHours.freshCount} taught-but-full · ${value.needTutor.freshCount} need a new tutor`}
          tone="border-amber-100 bg-amber-50/60"
        />
        <ValueStat
          label="Fresh / total waiting"
          value={`${value.freshTotal} / ${value.waitingTotal}`}
          helper={value.staleCount ? `${value.staleCount} older than ${value.freshDays} days — re-confirm or archive` : 'all recent'}
          tone="border-slate-200 bg-slate-50/80"
        />
      </div>

      {value.recruitingTargets.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-900">Recruiting / capacity targets (recent demand)</h3>
          <p className="mt-1 text-xs text-slate-600">Where adding tutor-hours would convert waiting demand into revenue.</p>
          <div className="mt-2 divide-y divide-slate-100">
            {value.recruitingTargets.slice(0, 8).map((t) => (
              <div key={`${t.instrument}-${t.reason}`} className="flex items-center justify-between px-2 py-2 text-sm">
                <span className="text-slate-700">
                  {t.instrument} <span className="text-slate-400">· {reasonLabel[t.reason] || t.reason}</span>
                </span>
                <span className="tabular-nums text-slate-600">
                  {t.freshCount} waiting · ~{formatMoney(t.contributionMonthly)}/mo
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Estimate (standard 30-min lesson, fresh entries only), not a forecast. Use the list below to place bookable
        students and to steer tutor recruiting.
      </p>
    </section>
  );
}

export default async function AdminWaitingPage() {
  const { students, capacityContext } = await getWaitingStudentsWithCapacity();
  const capacityValue = buildCapacityValue(students);

  return (
    <div className="space-y-6">
      <CapacityValuePanel value={capacityValue} />
      <AdminWaitingPageClient initialStudents={students} initialCapacityContext={capacityContext} />
    </div>
  );
}
