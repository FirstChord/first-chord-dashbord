import Link from 'next/link';
import { getAdminStudents } from '@/lib/admin/students';
import { getReviewFlagsRows } from '@/lib/admin/sheets';
import { getAdminHealthSummary } from '@/lib/admin/health';
import { formatDateTime } from '@/lib/admin/health-helpers.mjs';
import { buildPaymentOperationsSummary } from '@/lib/admin/payment-summary.mjs';

const OVERVIEW_TEST_STUDENT_NAMES = new Set([
  'test studenty',
  'finn le marinel',
]);

function statusClasses(status) {
  if (status === 'Healthy' || status === 'Fresh') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'Running' || status === 'Aging') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Failing' || status === 'Stale') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function normaliseName(value = '') {
  return `${value}`.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isOverviewTestStudent(student = {}) {
  return OVERVIEW_TEST_STUDENT_NAMES.has(normaliseName(student.fullName));
}

function buildLifecycleCounts(students = []) {
  return students.reduce((counts, student) => {
    const status = student.lifecycleStatus || 'needs_review';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function healthPriority(health) {
  const statuses = [
    health.mms.status,
    health.configWorkflow.status,
    health.fcWorkflow.status,
    health.flagsFreshness.status,
  ];

  if (statuses.some((status) => status === 'Failing' || status === 'Stale')) return 'needs attention';
  if (statuses.some((status) => status === 'Running' || status === 'Aging')) return 'watch';
  return 'healthy';
}

function buildPrioritySentence({ openIssues, linkingGaps, unknownPaymentMode, systemHealth }) {
  const priorities = [];
  if (linkingGaps > 0) priorities.push('payment/linking gaps');
  if (openIssues > 0) priorities.push('open flags');
  if (unknownPaymentMode > 0) priorities.push('unknown payment modes');
  if (systemHealth !== 'healthy') priorities.push('system health');

  return priorities.length
    ? `Suggested priority: review ${priorities.slice(0, 2).join(', ')}.`
    : 'Suggested priority: no urgent overview items; check waiting/onboarding work next.';
}

function calmHealthDetail(detail = '') {
  if (/GITHUB_TOKEN|GitHub workflow status failed|workflow status/i.test(detail)) {
    return 'Workflow status is not available from GitHub right now.';
  }

  return detail;
}

function StatCard({ label, value, href = '', tone = 'border-blue-100 bg-white/90', helper = '' }) {
  const content = (
    <div className={`h-full rounded-2xl border p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] backdrop-blur-sm transition ${tone} ${href ? 'hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(15,23,42,0.08)]' : ''}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-600">{helper}</p> : null}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function SectionHeader({ title, copy = '' }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {copy ? <p className="mt-1 text-sm text-slate-600">{copy}</p> : null}
    </div>
  );
}

export default async function AdminHomePage() {
  const [students, flags, health] = await Promise.all([getAdminStudents(), getReviewFlagsRows(), getAdminHealthSummary()]);
  const operationalStudents = students.filter((student) => !isOverviewTestStudent(student));
  const paymentSummary = buildPaymentOperationsSummary(operationalStudents);
  const lifecycleCounts = buildLifecycleCounts(operationalStudents);
  const systemHealth = healthPriority(health);
  const prioritySentence = buildPrioritySentence({
    openIssues: flags.length,
    linkingGaps: paymentSummary.stripeLinkingGaps,
    unknownPaymentMode: paymentSummary.unknownPaymentMode,
    systemHealth,
  });

  const stats = [
    { label: 'Students in Sheets', value: operationalStudents.length, href: '/admin/students' },
    { label: 'Flagged students', value: operationalStudents.filter((student) => student.hasFlags).length, href: '/admin/flags' },
    { label: 'Open review flags', value: flags.length, href: '/admin/flags' },
  ];

  const paymentStats = [
    { label: 'Stripe managed', value: paymentSummary.stripeManaged, tone: 'border-sky-100 bg-sky-50/70' },
    { label: 'Manual payers', value: paymentSummary.manualPayers, tone: 'border-emerald-100 bg-emerald-50/70' },
    { label: 'Payment setup pending', value: paymentSummary.setupPending, href: '/admin/students', tone: 'border-amber-100 bg-amber-50/70' },
    { label: 'Payment pause expected', value: paymentSummary.pausedExpected, href: '/admin/flags', tone: 'border-violet-100 bg-violet-50/70' },
    { label: 'Inactive / stopped', value: paymentSummary.inactiveOrStopped, href: '/admin/students', tone: 'border-slate-200 bg-slate-50/80' },
  ];

  const healthCards = [
    {
      label: 'MMS API',
      status: health.mms.status,
      detail: calmHealthDetail(health.mms.detail),
      updatedAt: health.mms.checkedAt,
    },
    {
      label: 'Generate Configs',
      status: health.configWorkflow.status,
      detail: calmHealthDetail(health.configWorkflow.detail),
      updatedAt: health.configWorkflow.updatedAt,
      link: health.configWorkflow.htmlUrl,
    },
    {
      label: 'Regenerate FC IDs',
      status: health.fcWorkflow.status,
      detail: calmHealthDetail(health.fcWorkflow.detail),
      updatedAt: health.fcWorkflow.updatedAt,
      link: health.fcWorkflow.htmlUrl,
    },
    {
      label: 'Review Flags Freshness',
      status: health.flagsFreshness.status,
      detail: health.flagsFreshness.statusDetail,
      updatedAt: health.flagsFreshness.latestGeneratedAt,
    },
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
          Daily admin control for issues, payment follow-up, school operations, and system health.
        </p>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Today's attention" copy={prioritySentence} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Open issues" value={flags.length} href="/admin/flags" tone="border-red-100 bg-red-50/70" helper="Review queue" />
          <StatCard label="Payment/linking gaps" value={paymentSummary.stripeLinkingGaps} href="/admin/flags" tone="border-amber-100 bg-amber-50/70" helper="Outside setup pending" />
          <StatCard label="Payment setup pending" value={paymentSummary.setupPending} href="/admin/students" tone="border-blue-100 bg-blue-50/70" helper="Billing expectation" />
          <StatCard label="Unknown payment mode" value={paymentSummary.unknownPaymentMode} href="/admin/students" tone="border-slate-200 bg-slate-50/80" helper="Needs classification" />
          <StatCard label="System health" value={systemHealth} tone={systemHealth === 'healthy' ? 'border-emerald-100 bg-emerald-50/70' : 'border-amber-100 bg-amber-50/70'} helper="MMS, workflows, flags" />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="School operations" copy="Core school records and current review workload." />
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Lifecycle snapshot</h4>
            <p className="text-xs text-slate-500">Derived operational state, separate from payment expectation.</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ['Active', lifecycleCounts.active || 0],
              ['Lifecycle setup', lifecycleCounts.setup_pending || 0],
              ['Currently paused', lifecycleCounts.paused || 0],
              ['Waiting', lifecycleCounts.waiting || 0],
              ['Needs review', lifecycleCounts.needs_review || 0],
              ['Stopped', lifecycleCounts.stopped || 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Payment operations" copy="Current Sheets-based payment state. Live Stripe scans still run from issue/payment actions." />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {paymentStats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-slate-900">Stripe readiness</h4>
                <p className="mt-1 text-sm text-slate-600">Core Stripe linkage from current Sheets data.</p>
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

          <div className="rounded-2xl border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <h4 className="text-base font-semibold text-slate-900">Watchlist</h4>
            <p className="mt-1 text-sm text-slate-600">Payment records worth checking before a live Stripe scan.</p>
            <div className="mt-5 space-y-3">
              <Link href="/admin/flags" className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 hover:border-amber-200">
                <span className="text-sm text-slate-700">Stripe linking gaps outside setup pending</span>
                <span className="text-lg font-semibold text-slate-900">{paymentSummary.stripeLinkingGaps}</span>
              </Link>
              <Link href="/admin/students" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 hover:border-slate-300">
                <span className="text-sm text-slate-700">Unknown payment mode</span>
                <span className="text-lg font-semibold text-slate-900">{paymentSummary.unknownPaymentMode}</span>
              </Link>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
                Based on Sheets fields. Stripe action refreshes remain student/issue-level.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="System health" copy="Service checks, automation freshness, and workflow links." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {healthCards.map((item) => (
            <div key={item.label} className="rounded-2xl border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
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
