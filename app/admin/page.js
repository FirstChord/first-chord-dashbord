import { Suspense } from 'react';
import Link from 'next/link';
import { getOperationalAdminStudents } from '@/lib/admin/students';
import { getParentUnderstandingStateRows } from '@/lib/admin/sheets';
import { getAdminHealthSummary } from '@/lib/admin/health';
import { formatDateTime } from '@/lib/admin/health-helpers.mjs';
import { buildPaymentOperationsSummary } from '@/lib/admin/payment-summary.mjs';
import { getTutorAbsenceOverviewSummary } from '@/lib/admin/tutor-absence';
import { getPlanningDashboard } from '@/lib/admin/planning';
import { getAdminIssues } from '@/lib/admin/issues';
import { getWaitingWorkflowStudents } from '@/lib/admin/waiting-workflow';
import { getBridgeStatus, getIncomingMessageInbox } from '@/lib/admin/incoming-messages';
import { getIncomingReplyProposals } from '@/lib/admin/incoming-reply-proposals';
import { assessBridgeHealth } from '@/lib/admin/incoming-message-helpers.mjs';
import { labelPlanningArea, labelPlanningType } from '@/lib/admin/planning-helpers.mjs';

export const dynamic = 'force-dynamic';

function statusClasses(status) {
  if (status === 'Healthy' || status === 'Fresh') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'Running' || status === 'Aging') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Failing' || status === 'Stale') return 'border-red-200 bg-red-50 text-red-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
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

function buildWaitingCardValue(summary = {}) {
  return summary.newThisWeek > 0 ? `${summary.newThisWeek} new` : 'Review';
}

function buildWaitingOverview(waitingStudents = []) {
  const openWaitingStudents = waitingStudents.filter((student) => !['onboarded', 'closed'].includes(student.waitingStatus));
  const onboardingReady = waitingStudents.filter((student) => student.waitingStatus === 'onboarding_ready');
  const noResponse = waitingStudents.filter((student) => student.waitingStatus === 'no_response');
  const newThisWeek = openWaitingStudents.filter((student) => {
    if (Number.isFinite(student.ageInDays)) return student.ageInDays <= 7;
    if (!student.dateStarted) return false;
    const started = new Date(student.dateStarted);
    if (Number.isNaN(started.getTime())) return false;
    return Date.now() - started.getTime() <= 7 * 24 * 60 * 60 * 1000;
  });

  return {
    waiting: openWaitingStudents.length,
    onboardingReady: onboardingReady.length,
    noResponse: noResponse.length,
    newThisWeek: newThisWeek.length,
  };
}

async function getSafeWaitingWorkflowStudents() {
  try {
    return await getWaitingWorkflowStudents();
  } catch (error) {
    console.warn('Admin overview waiting-list summary failed:', error);
    return [];
  }
}

async function getSafeIncomingMessageInbox() {
  try {
    return await getIncomingMessageInbox();
  } catch (error) {
    console.warn('Admin overview incoming-inbox summary failed:', error);
    return [];
  }
}

function buildTrustSummary(health, systemHealth) {
  if (systemHealth === 'healthy') {
    return {
      label: 'All clear',
      tone: 'border-emerald-100 bg-emerald-50/70 text-emerald-950',
      detail: 'MMS healthy · Review flags fresh · Automation quiet',
      href: '',
    };
  }

  const details = [];
  if (['Failing', 'Stale', 'Running', 'Aging'].includes(health.mms.status)) {
    details.push(`MMS ${String(health.mms.status || 'unknown').toLowerCase()}`);
  }
  if (['Failing', 'Stale', 'Running', 'Aging'].includes(health.flagsFreshness.status)) {
    details.push(`Review flags ${String(health.flagsFreshness.status || 'unknown').toLowerCase()}`);
  }
  if (['Failing', 'Stale', 'Running', 'Aging'].includes(health.configWorkflow.status)) {
    details.push(`Generate configs ${String(health.configWorkflow.status || 'unknown').toLowerCase()}`);
  }
  if (['Failing', 'Stale', 'Running', 'Aging'].includes(health.fcWorkflow.status)) {
    details.push(`Regenerate FC IDs ${String(health.fcWorkflow.status || 'unknown').toLowerCase()}`);
  }

  return {
    label: systemHealth === 'watch' ? 'Worth checking' : 'Check before acting',
    tone: systemHealth === 'watch'
      ? 'border-amber-100 bg-amber-50/80 text-amber-950'
      : 'border-red-100 bg-red-50/80 text-red-950',
    detail: details.length ? details.join(' · ') : `System health ${systemHealth}`,
    href: '#system-checks',
  };
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
      className={`block rounded-2xl border p-5 shadow-[0_10px_28px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)] ${tone}`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-base font-semibold leading-6 text-slate-900">{label}</p>
        <span className="shrink-0 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-sm font-semibold text-slate-800 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          {value}
        </span>
      </div>
      {helper ? <p className="mt-3 text-sm leading-6 text-slate-600">{helper}</p> : null}
    </Link>
  );
}

// The meeting agenda: the freshest captured school notes (learning + strategic),
// so the aspirational section shows what Finn and Tom actually wrote down,
// not standing prompts.
function DiscussionList({ notes, totalOpen }) {
  if (!notes.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 text-sm shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <p className="font-semibold text-slate-900">Nothing captured to discuss.</p>
        <p className="mt-1 text-slate-600">
          When something sparks — an idea, a number to question, a thing worth trying —{' '}
          <Link href="/admin/planning?filter=school_notes" className="font-medium text-slate-900 underline-offset-2 hover:underline">
            capture it as a school note
          </Link>{' '}
          and it will surface here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <ul className="divide-y divide-slate-100">
        {notes.map((note) => (
          <li key={note.planningId}>
            <Link
              href={`/admin/planning?filter=school_notes&focus=${encodeURIComponent(note.planningId)}`}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 transition hover:bg-blue-50/40"
            >
              <span className="min-w-0 truncate text-sm font-medium text-slate-900">{note.title}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {labelPlanningArea(note.area)} · {labelPlanningType(note.itemType)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 border-t border-slate-100 pt-3 text-right">
        <Link href="/admin/planning?filter=school_notes" className="text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline">
          All school notes{totalOpen > notes.length ? ` (${totalOpen})` : ''}
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ title, copy }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-sm text-emerald-950 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-emerald-900">{copy}</p>
    </div>
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

// Left-aligned so the page reads down one edge — centered headers make the eye
// zigzag between the middle and the left-anchored cards below them.
function SectionHeader({ title, copy = '' }) {
  return (
    <div className="max-w-3xl">
      <h3 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h3>
      {copy ? <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p> : null}
    </div>
  );
}

export default async function AdminHomePage() {
  // Health is intentionally NOT in this blocking fetch — it makes 3 uncached
  // external calls (MMS + 2 GitHub), so it's streamed separately (see OverviewHealth)
  // and the rest of the page renders immediately.
  const [students, issuesResult, tutorAbsenceSummary, parentUnderstandingRows, planningDashboard, waitingStudents, incomingInbox, bridgeStatus, replyProposalsResult] = await Promise.all([
    getOperationalAdminStudents(),
    getAdminIssues(),
    getTutorAbsenceOverviewSummary(),
    getParentUnderstandingStateRows(),
    getPlanningDashboard(),
    getSafeWaitingWorkflowStudents(),
    getSafeIncomingMessageInbox(),
    getBridgeStatus().catch(() => null),
    // Existing suggestions remain visible/countable when drafting is rolled
    // back via the feature flag.
    getIncomingReplyProposals().catch(() => ({ openByIncomingId: {} })),
  ]);
  const pendingReplyProposals = Object.keys(replyProposalsResult.openByIncomingId || {}).length;
  const issues = issuesResult.issues || [];
  const activeIssues = issues.filter((issue) => ['open', 'acknowledged'].includes(issue.status));
  const paymentSummary = buildPaymentOperationsSummary(students);
  const lifecycleCounts = buildLifecycleCounts(students);
  const waitingSummary = buildWaitingOverview(waitingStudents);
  const parentUnderstandingSummary = buildParentUnderstandingOverview(parentUnderstandingRows);
  const planningSummary = planningDashboard.summary || {};
  const planningDueNow = planningSummary.dueNow || 0;
  const openSchoolNotes = (planningDashboard.items || [])
    .filter((item) => ['learning_note', 'strategic_note'].includes(item.itemType)
      && !['done', 'parked'].includes(item.status));
  // Recency, not priority: the point is "what did we last capture worth talking
  // about", and three items keeps the meeting stimulus meeting-sized.
  const discussionNotes = [...openSchoolNotes]
    .sort((a, b) => `${b.updatedAt || b.createdAt || ''}`.localeCompare(`${a.updatedAt || a.createdAt || ''}`))
    .slice(0, 3);
  const openIncomingMessages = incomingInbox.filter((entry) => ['inbox', 'needs_review'].includes(entry.status)).length;
  // Auto-ingest makes a dead bridge look like a calm inbox — the heartbeat
  // tells "down" and "connected but capturing nothing" apart from quiet.
  const lastAutoCaptureAt = incomingInbox
    .filter((entry) => entry.source === 'whatsapp_group_auto')
    .reduce((latest, entry) => ((entry.capturedAt || '') > latest ? entry.capturedAt : latest), '');
  const bridgeHealth = assessBridgeHealth(bridgeStatus, { lastAutoCaptureAt });
  const tutorAbsenceHref = tutorAbsenceSummary.firstOpenAbsence
    ? `/admin/workflows/tutor-absence?tutor=${encodeURIComponent(tutorAbsenceSummary.firstOpenAbsence.tutorShortName)}&date=${encodeURIComponent(tutorAbsenceSummary.firstOpenAbsence.absenceDate)}`
    : '/admin/workflows/tutor-absence';
  const todayItems = [
    planningDueNow > 0 ? {
      label: "Do today's planning work",
      value: planningDueNow,
      href: '/admin/planning?filter=due_now',
      helper: planningSummary.overdue > 0
        ? `${planningSummary.overdue} overdue, ${planningSummary.dueToday || 0} due today`
        : `${planningSummary.dueToday || 0} for today`,
      tone: 'border-violet-100 bg-violet-50/60',
    } : null,
  ].filter(Boolean);
  const attentionItems = [
    openIncomingMessages > 0 ? {
      label: 'Message inbox',
      value: openIncomingMessages,
      href: '/admin/incoming-messages',
      helper: [
        openIncomingMessages === 1 ? 'One parent message to review' : 'Parent messages to review',
        pendingReplyProposals > 0 ? `${pendingReplyProposals} suggested ${pendingReplyProposals === 1 ? 'reply' : 'replies'} ready` : '',
      ].filter(Boolean).join(' · '),
      tone: 'border-blue-100 bg-blue-50/60',
    } : null,
    bridgeHealth.state === 'warn' ? {
      label: 'WhatsApp bridge',
      value: '!',
      href: '/admin/incoming-messages',
      helper: bridgeHealth.problems[0] || 'Bridge needs a look',
      tone: 'border-amber-100 bg-amber-50/60',
    } : null,
    activeIssues.length > 0 ? {
      label: 'Review Issues',
      value: activeIssues.length,
      href: '/admin/flags',
      helper: '',
      tone: 'border-rose-100 bg-rose-50/60',
    } : null,
    tutorAbsenceSummary.openAbsences > 0 ? {
      label: 'Tutor Absences',
      value: tutorAbsenceSummary.openAbsences,
      href: tutorAbsenceHref,
      helper: '',
      tone: 'border-orange-100 bg-orange-50/60',
    } : null,
    waitingSummary.waiting > 0 || waitingSummary.onboardingReady > 0 || waitingSummary.noResponse > 0 ? {
      label: 'Waiting list',
      value: buildWaitingCardValue(waitingSummary),
      href: '/admin/waiting',
      helper: '',
      tone: 'border-emerald-100 bg-emerald-50/60',
    } : null,
    parentUnderstandingSummary.followUps > 0 ? {
      label: 'Close parent follow-ups',
      value: parentUnderstandingSummary.followUps,
      href: '/admin/workflows/parent-understanding',
      helper: parentUnderstandingSummary.followUps === 1 ? 'One family needs a follow-up' : 'Families need follow-up',
      tone: 'border-sky-100 bg-sky-50/60',
    } : null,
    paymentSummary.setupPending > 0 ? {
      label: 'Payment setup pending',
      value: paymentSummary.setupPending,
      href: '/admin/students?paymentExpectation=setup_pending',
      helper: '',
      tone: 'border-amber-100 bg-amber-50/60',
    } : null,
    paymentSummary.unknownPaymentMode > 0 ? {
      label: 'Classify payment mode',
      value: paymentSummary.unknownPaymentMode,
      href: '/admin/students',
      helper: 'So payment checks know what to expect',
      tone: 'border-slate-200 bg-slate-50/80',
    } : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <OverviewTrustStrip placement="top" />
      </Suspense>

      <section className="space-y-4">
        <SectionHeader title="Things to Do Today" />
        {todayItems.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {todayItems.map((item) => (
              <ActionCard key={item.label} {...item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="All clear for today."
            copy="No dated planning work is asking for you from the overview right now."
          />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title="Things That Need Attention" />
        {attentionItems.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {attentionItems.map((item) => (
              <ActionCard key={item.label} {...item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No open loops are pressing."
            copy="Issues, tutor absence messages, parent follow-ups, payment unknowns, and waiting-list actions are quiet."
          />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title="Let’s Work on the School" />
        <DiscussionList notes={discussionNotes} totalOpen={openSchoolNotes.length} />
      </section>

      <details className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">School context</summary>
        <p className="mt-2 text-sm text-slate-600">Useful background numbers, not the daily command surface.</p>
        <div className="mt-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h4 className="text-sm font-semibold text-slate-900">Lifecycle snapshot</h4>
            <p className="text-xs text-slate-500">{students.length} operational students. Derived state, separate from payment expectation.</p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[
              ['Active', lifecycleCounts.active || 0],
              ['Lifecycle setup', lifecycleCounts.setup_pending || 0],
              ['Currently paused', lifecycleCounts.paused || 0],
              ['Needs review', lifecycleCounts.needs_review || 0],
              ['Stopped', lifecycleCounts.stopped || 0],
            ].map(([label, value]) => (
              <MetricPill key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      </details>

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

      <Suspense fallback={<SystemChecksFallback />}>
        <OverviewSystemChecks />
      </Suspense>

      <Suspense fallback={<TrustStripFallback />}>
        <OverviewTrustStrip placement="bottom" />
      </Suspense>
    </div>
  );
}

// --- Streamed health section -------------------------------------------------
// Health makes 3 uncached external calls (MMS + 2 GitHub), so these two pieces
// stream in separately — the rest of the Overview renders immediately, and these
// fill in a moment later (instantly on repeat visits thanks to the 60s cache).

async function OverviewTrustStrip({ placement = 'bottom' }) {
  const health = await getAdminHealthSummary();
  const systemHealth = healthPriority(health);
  if ((placement === 'top') !== (systemHealth !== 'healthy')) {
    return null;
  }

  const trust = buildTrustSummary(health, systemHealth);
  const content = (
    <div className={`rounded-2xl border px-5 py-3 text-sm shadow-[0_10px_28px_rgba(15,23,42,0.04)] ${trust.tone}`}>
      <span className="font-semibold">Trust: {trust.label}</span>
      <span className="ml-2">{trust.detail}</span>
    </div>
  );

  return trust.href ? <a href={trust.href}>{content}</a> : content;
}

function TrustStripFallback() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white/90 px-5 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div className="h-4 w-64 rounded bg-slate-200/70" />
    </div>
  );
}

async function OverviewSystemChecks() {
  const health = await getAdminHealthSummary();
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
    <details id="system-checks" className="rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
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
  );
}

function SystemChecksFallback() {
  return (
    <div className="animate-pulse rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <div className="h-4 w-32 rounded bg-slate-200/70" />
    </div>
  );
}
