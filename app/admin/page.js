import Link from 'next/link';
import { getAdminStudents } from '@/lib/admin/students';
import { getParentUnderstandingStateRows, getReviewFlagsRows } from '@/lib/admin/sheets';
import { getAdminHealthSummary } from '@/lib/admin/health';
import { formatDateTime } from '@/lib/admin/health-helpers.mjs';
import { buildPaymentOperationsSummary } from '@/lib/admin/payment-summary.mjs';
import { getTutorAbsenceOverviewSummary } from '@/lib/admin/tutor-absence';

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

function buildPrioritySentence({ openIssues, tutorAbsences, linkingGaps, unknownPaymentMode, systemHealth }) {
  const priorities = [];
  if (tutorAbsences > 0) priorities.push('tutor absences');
  if (linkingGaps > 0) priorities.push('payment/linking gaps');
  if (openIssues > 0) priorities.push('open flags');
  if (unknownPaymentMode > 0) priorities.push('unknown payment modes');
  if (systemHealth !== 'healthy') priorities.push('system health');

  return priorities.length
    ? `Suggested priority: review ${priorities.slice(0, 2).join(', ')}.`
    : 'Suggested priority: no urgent overview items; check waiting/onboarding work next.';
}

function buildParentUnderstandingOverview(rows = []) {
  const activeRows = rows.filter((row) => row.workflowStatus && row.workflowStatus !== 'completed');
  const followUpRows = rows.filter((row) => (
    row.workflowStatus === 'needs_follow_up'
    || row.workflowStatus === 'escalate_to_admin'
    || `${row.loopStatus || ''}`.startsWith('open_')
  ) && row.workflowStatus !== 'not_started' && row.workflowStatus !== 'completed');

  return {
    openRecords: activeRows.length,
    followUps: followUpRows.length,
  };
}

function buildWaitingOverview(students = []) {
  const waitingStudents = students.filter((student) => student.lifecycleStatus === 'waiting');
  const onboardingReady = students.filter((student) => student.waitingStatus === 'onboarding_ready');
  const noResponse = students.filter((student) => student.waitingStatus === 'no_response');

  return {
    waiting: waitingStudents.length,
    onboardingReady: onboardingReady.length,
    noResponse: noResponse.length,
  };
}

function buildTrustItems(health, systemHealth) {
  return [
    `MMS ${String(health.mms.status || 'unknown').toLowerCase()}`,
    `Review flags ${String(health.flagsFreshness.status || 'unknown').toLowerCase()}`,
    systemHealth === 'healthy'
      ? 'Automation checks quiet'
      : `System health ${systemHealth}`,
  ];
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

function ActionCard({ label, value, href, helper = '', tone = 'border-slate-200 bg-white' }) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(15,23,42,0.08)] ${tone}`}
    >
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
      {helper ? <p className="mt-2 text-xs text-slate-600">{helper}</p> : null}
    </Link>
  );
}

function MetricPill({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ContextRow({ label, value, href = '', tone = '' }) {
  const content = (
    <div className={`flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 ${tone}`}>
      <span className="text-sm text-slate-700">{label}</span>
      <span className="text-lg font-semibold text-slate-900">{value}</span>
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
  const [students, flags, health, tutorAbsenceSummary, parentUnderstandingRows] = await Promise.all([
    getAdminStudents(),
    getReviewFlagsRows(),
    getAdminHealthSummary(),
    getTutorAbsenceOverviewSummary(),
    getParentUnderstandingStateRows(),
  ]);
  const operationalStudents = students.filter((student) => !isOverviewTestStudent(student));
  const paymentSummary = buildPaymentOperationsSummary(operationalStudents);
  const lifecycleCounts = buildLifecycleCounts(operationalStudents);
  const waitingSummary = buildWaitingOverview(operationalStudents);
  const parentUnderstandingSummary = buildParentUnderstandingOverview(parentUnderstandingRows);
  const systemHealth = healthPriority(health);
  const trustItems = buildTrustItems(health, systemHealth);
  const prioritySentence = buildPrioritySentence({
    openIssues: flags.length,
    tutorAbsences: tutorAbsenceSummary.openAbsences,
    linkingGaps: paymentSummary.stripeLinkingGaps,
    unknownPaymentMode: paymentSummary.unknownPaymentMode,
    systemHealth,
  });
  const tutorAbsenceHref = tutorAbsenceSummary.firstOpenAbsence
    ? `/admin/workflows/tutor-absence?tutor=${encodeURIComponent(tutorAbsenceSummary.firstOpenAbsence.tutorShortName)}&date=${encodeURIComponent(tutorAbsenceSummary.firstOpenAbsence.absenceDate)}`
    : '/admin/workflows/tutor-absence';
  const attentionItems = [
    flags.length > 0 ? {
      label: 'Open issues',
      value: flags.length,
      href: '/admin/flags',
      helper: 'Review queue',
      tone: 'border-red-100 bg-red-50/70',
    } : null,
    tutorAbsenceSummary.openAbsences > 0 ? {
      label: 'Tutor absences',
      value: tutorAbsenceSummary.openAbsences,
      href: tutorAbsenceHref,
      helper: `${tutorAbsenceSummary.unresolvedMessages} parent messages left`,
      tone: 'border-orange-100 bg-orange-50/70',
    } : null,
    paymentSummary.stripeLinkingGaps > 0 ? {
      label: 'Payment/linking gaps',
      value: paymentSummary.stripeLinkingGaps,
      href: '/admin/flags',
      helper: 'Outside setup pending',
      tone: 'border-amber-100 bg-amber-50/70',
    } : null,
    parentUnderstandingSummary.followUps > 0 ? {
      label: 'Parent follow-ups',
      value: parentUnderstandingSummary.followUps,
      href: '/admin/workflows/parent-understanding',
      helper: 'Communication loops still open',
      tone: 'border-blue-100 bg-blue-50/70',
    } : null,
    waitingSummary.onboardingReady > 0 ? {
      label: 'Ready to onboard',
      value: waitingSummary.onboardingReady,
      href: '/admin/waiting',
      helper: 'Waiting-list students marked ready',
      tone: 'border-emerald-100 bg-emerald-50/70',
    } : null,
    paymentSummary.unknownPaymentMode > 0 ? {
      label: 'Unknown payment mode',
      value: paymentSummary.unknownPaymentMode,
      href: '/admin/students',
      helper: 'Needs classification',
      tone: 'border-slate-200 bg-slate-50/80',
    } : null,
    systemHealth !== 'healthy' ? {
      label: 'System health',
      value: systemHealth,
      href: '/admin',
      helper: 'MMS, workflows, flags',
      tone: 'border-amber-100 bg-amber-50/70',
    } : null,
  ].filter(Boolean);
  const attentionLabels = new Set(attentionItems.map((item) => item.label));
  const workQueueItems = [
    waitingSummary.waiting > 0 || waitingSummary.onboardingReady > 0 ? {
      label: 'Waiting list',
      value: waitingSummary.waiting,
      href: '/admin/waiting',
      helper: `${waitingSummary.onboardingReady} ready to onboard`,
      tone: 'border-emerald-100 bg-emerald-50/70',
    } : null,
    parentUnderstandingSummary.openRecords > 0 && !attentionLabels.has('Parent follow-ups') ? {
      label: 'Parent understanding',
      value: parentUnderstandingSummary.openRecords,
      href: '/admin/workflows/parent-understanding',
      helper: `${parentUnderstandingSummary.followUps} follow-ups`,
      tone: 'border-blue-100 bg-blue-50/70',
    } : null,
    paymentSummary.setupPending > 0 ? {
      label: 'Payment setup pending',
      value: paymentSummary.setupPending,
      href: '/admin/students?paymentExpectation=setup_pending',
      helper: 'Students not yet fully billing',
      tone: 'border-amber-100 bg-amber-50/70',
    } : null,
    tutorAbsenceSummary.openAbsences > 0 && !attentionLabels.has('Tutor absences') ? {
      label: 'Tutor absences',
      value: tutorAbsenceSummary.openAbsences,
      href: tutorAbsenceHref,
      helper: `${tutorAbsenceSummary.unresolvedMessages} messages left`,
      tone: 'border-orange-100 bg-orange-50/70',
    } : null,
  ].filter(Boolean);

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
        <SectionHeader title="Needs attention" copy={prioritySentence} />
        {attentionItems.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {attentionItems.map((item) => (
              <ActionCard key={item.label} {...item} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm text-emerald-900 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
            No active overview loops are demanding attention. Check waiting/onboarding or planned workflow work next.
          </div>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-3 text-sm text-slate-600 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <span className="font-medium text-slate-800">Trust:</span>{' '}
          {trustItems.join(' · ')}
        </div>
      </section>

      {workQueueItems.length ? (
        <section className="space-y-4">
          <SectionHeader title="Next work" copy="Useful queues that are open but not already leading today's attention." />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workQueueItems.map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader title="School context" copy="Useful background numbers, not the daily command surface." />
        <div className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Lifecycle snapshot</h4>
            <p className="text-xs text-slate-500">{operationalStudents.length} operational students. Derived state, separate from payment expectation.</p>
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
              <MetricPill key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      </section>

      <details className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Payment context</summary>
        <p className="mt-2 text-sm text-slate-600">Background payment segmentation from Sheets. Live Stripe checks remain student/issue-level.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ContextRow label="Stripe managed" value={paymentSummary.stripeManaged} />
          <ContextRow label="Manual payers" value={paymentSummary.manualPayers} />
          <ContextRow label="Paused expected" value={paymentSummary.pausedExpected} href="/admin/flags" />
          <ContextRow label="Setup pending" value={paymentSummary.setupPending} href="/admin/students?paymentExpectation=setup_pending" />
          <ContextRow label="Customer linked" value={paymentSummary.linkedStripeCustomers} />
          <ContextRow label="Subscription linked" value={paymentSummary.linkedStripeSubscriptions} />
          <ContextRow label="Linking gaps" value={paymentSummary.stripeLinkingGaps} href="/admin/flags" tone={paymentSummary.stripeLinkingGaps > 0 ? 'border-amber-200 bg-amber-50/70' : ''} />
          <ContextRow label="Unknown payment mode" value={paymentSummary.unknownPaymentMode} href="/admin/students" />
        </div>
      </details>

      <details className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">System checks</summary>
        <p className="mt-2 text-sm text-slate-600">Service checks, automation freshness, and workflow links.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
      </details>
    </div>
  );
}
