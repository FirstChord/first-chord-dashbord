import { getAdminStudents } from '@/lib/admin/students';
import { getReviewFlagsRows } from '@/lib/admin/sheets';
import { getAdminHealthSummary } from '@/lib/admin/health';
import { formatDateTime } from '@/lib/admin/health-helpers.mjs';
import { buildPaymentOperationsSummary } from '@/lib/admin/payment-summary.mjs';

function statusClasses(status) {
  if (status === 'Healthy' || status === 'Fresh') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'Running' || status === 'Aging') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Failing' || status === 'Stale') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default async function AdminHomePage() {
  const [students, flags, health] = await Promise.all([getAdminStudents(), getReviewFlagsRows(), getAdminHealthSummary()]);
  const paymentSummary = buildPaymentOperationsSummary(students);

  const stats = [
    { label: 'Students in Sheets', value: students.length },
    { label: 'Flagged students', value: students.filter((student) => student.hasFlags).length },
    { label: 'Open review flags', value: flags.length },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Operational view</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Overview
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          High-level admin control for onboarding, issues, and system health. Existing tutor and student dashboard routes are unchanged.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Payment operations</h3>
          <p className="mt-1 text-sm text-slate-600">
            Operational payment-state view for the school. This is not revenue accounting yet; it shows how students are currently segmented for billing and setup follow-up.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Stripe managed', value: paymentSummary.stripeManaged, tone: 'border-sky-100 bg-sky-50/70' },
            { label: 'Manual payers', value: paymentSummary.manualPayers, tone: 'border-emerald-100 bg-emerald-50/70' },
            { label: 'Setup pending', value: paymentSummary.setupPending, tone: 'border-amber-100 bg-amber-50/70' },
            { label: 'Paused expected', value: paymentSummary.pausedExpected, tone: 'border-violet-100 bg-violet-50/70' },
            { label: 'Inactive / stopped', value: paymentSummary.inactiveOrStopped, tone: 'border-slate-200 bg-slate-50/80' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-[1.6rem] border p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] backdrop-blur-sm ${stat.tone}`}
            >
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-slate-900">Stripe readiness</h4>
                <p className="mt-1 text-sm text-slate-600">How many Stripe-managed students have core linkage already in place.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Stripe managed</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{paymentSummary.stripeManaged}</p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Customer linked</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{paymentSummary.linkedStripeCustomers}</p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Subscription linked</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{paymentSummary.linkedStripeSubscriptions}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <h4 className="text-base font-semibold text-slate-900">Watchlist</h4>
            <p className="mt-1 text-sm text-slate-600">Students who look operationally worth reviewing before you even run a live Stripe scan.</p>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
                <span className="text-sm text-slate-700">Stripe linking gaps outside setup pending</span>
                <span className="text-lg font-semibold text-slate-900">{paymentSummary.stripeLinkingGaps}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <span className="text-sm text-slate-700">Unknown payment mode</span>
                <span className="text-lg font-semibold text-slate-900">{paymentSummary.unknownPaymentMode}</span>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
                Use this as a weekly payment-state check. It is intentionally a school-ops summary, not a cashflow model.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Operational health</h3>
          <p className="mt-1 text-sm text-slate-600">Current status of MMS, dashboard config generation, FC regeneration, and review-flag freshness.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'MMS API',
              status: health.mms.status,
              detail: health.mms.detail,
              updatedAt: health.mms.checkedAt,
            },
            {
              label: 'Generate Configs',
              status: health.configWorkflow.status,
              detail: health.configWorkflow.detail,
              updatedAt: health.configWorkflow.updatedAt,
              link: health.configWorkflow.htmlUrl,
            },
            {
              label: 'Regenerate FC IDs',
              status: health.fcWorkflow.status,
              detail: health.fcWorkflow.detail,
              updatedAt: health.fcWorkflow.updatedAt,
              link: health.fcWorkflow.htmlUrl,
            },
            {
              label: 'Review Flags Freshness',
              status: health.flagsFreshness.status,
              detail: health.flagsFreshness.statusDetail,
              updatedAt: health.flagsFreshness.latestGeneratedAt,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-500">{item.label}</p>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(item.status)}`}>{item.status}</span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{item.detail}</p>
              <p className="mt-4 text-xs text-slate-500">Last update: {formatDateTime(item.updatedAt)}</p>
              {item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
                  Open workflow run
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
