import Link from 'next/link';
import { getOperationalAdminStudents } from '@/lib/admin/students';
import { getScheduleContextRows } from '@/lib/admin/sheets';
import { enrichScheduleContextsWithSharedSlots } from '@/lib/admin/schedule-context-helpers.mjs';
import { buildRevenueRunRate, formatMoney } from '@/lib/admin/finance-helpers.mjs';

function StatCard({ label, value, helper = '', tone = 'border-blue-100 bg-white/90' }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] backdrop-blur-sm ${tone}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-600">{helper}</p> : null}
    </div>
  );
}

function BreakdownRow({ label, bucket }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <span className="text-sm text-slate-700">{label}<span className="text-slate-400"> · {bucket.count}</span></span>
      <span className="text-sm font-semibold text-slate-900">{formatMoney(bucket.weekly)}/wk</span>
    </div>
  );
}

export default async function AdminFinancePage() {
  const [students, scheduleRows] = await Promise.all([
    getOperationalAdminStudents(),
    getScheduleContextRows(),
  ]);
  // Attach cached MMS schedule context so group/orchestra detection and durations are
  // accurate (the bulk student list omits it). Read-only; reuses the sheet read cache.
  const scheduleByMmsId = enrichScheduleContextsWithSharedSlots(scheduleRows);
  const enrichedStudents = students.map((student) => ({
    ...student,
    scheduleContext: scheduleByMmsId.get(student.mmsId) || student.scheduleContext || null,
  }));
  const runRate = buildRevenueRunRate(enrichedStudents);

  const lessonKindLabels = { one_to_one: 'One-to-one', group: 'Group', orchestra: 'Orchestra', unknown: 'Unmatched' };
  const modeLabels = { stripe: 'Stripe-managed', manual: 'Manual payers', unknown: 'Unknown mode' };

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Finance context</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Revenue Run-Rate
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Estimated recurring revenue from currently active students, grouped by lesson type and payment mode.
        </p>
      </section>

      {runRate.isEstimateOnly ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Estimate, not Stripe actuals.</span> These figures come from cached lesson
          duration × the school price table — not real Stripe charges. Manual payers are estimated the same way.
          A future slice swaps this for cached Stripe amounts.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {StatCard({
          label: 'Active recurring (weekly)',
          value: formatMoney(runRate.active.weekly),
          helper: `${runRate.active.count} active students${runRate.activeUnpriced ? ` · ${runRate.activeUnpriced} unpriced (excluded)` : ''}`,
        })}
        {StatCard({ label: 'Active recurring (monthly)', value: formatMoney(runRate.active.monthly), helper: 'Weekly × 52 ÷ 12' })}
        {StatCard({ label: 'Indicative annual', value: formatMoney(runRate.activeAnnual), helper: 'Weekly × 52 — rough, ignores holidays/pauses' })}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {StatCard({
          label: 'Currently paused (not billing)',
          value: formatMoney(runRate.paused.weekly),
          helper: `${runRate.paused.count} paused students · resumes when they return`,
          tone: 'border-violet-100 bg-violet-50/60',
        })}
        {StatCard({
          label: 'Setup pending',
          value: String(runRate.setupPendingCount),
          helper: 'Students not yet billing — potential future recurring',
          tone: 'border-slate-200 bg-slate-50/80',
        })}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
          <h3 className="text-base font-semibold text-slate-900">By lesson type</h3>
          <div className="mt-4 space-y-2">
            {['one_to_one', 'group', 'orchestra', 'unknown'].map((kind) => (
              runRate.byLessonKind[kind].count
                ? <BreakdownRow key={kind} label={lessonKindLabels[kind]} bucket={runRate.byLessonKind[kind]} />
                : null
            ))}
          </div>
        </div>
        <div className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
          <h3 className="text-base font-semibold text-slate-900">By payment mode</h3>
          <div className="mt-4 space-y-2">
            {['stripe', 'manual', 'unknown'].map((mode) => (
              runRate.byPaymentMode[mode].count
                ? <BreakdownRow key={mode} label={modeLabels[mode]} bucket={runRate.byPaymentMode[mode]} />
                : null
            ))}
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Read-only context, not accounting. Active = lifecycle "active"; paused students are excluded from the live
        figure. See <Link href="/admin/planning" className="underline-offset-2 hover:underline">Planning</Link> for
        capacity and schedule health.
      </p>
    </div>
  );
}
