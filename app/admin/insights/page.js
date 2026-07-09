import Link from 'next/link';
import { getCommunicationLog } from '@/lib/admin/communications';
import { getIncomingMessageInbox } from '@/lib/admin/incoming-messages';
import { buildLearningInsights } from '@/lib/admin/learning-insights.mjs';
import { getParentUnderstandingWorkflow } from '@/lib/admin/parent-understanding';
import { getPracticeNoteLogRows } from '@/lib/admin/sheets';

export const dynamic = 'force-dynamic';

function InsightCard({ label, value, copy, href = '' }) {
  const content = (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {copy ? <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function ThemeList({ title, rows = [], empty = 'Nothing recorded yet.' }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {rows.length ? (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-700">{row.label.replaceAll('_', ' ')}</span>
              <span className="font-semibold text-slate-900">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-slate-500">{empty}</p>}
    </section>
  );
}

export default async function AdminInsightsPage() {
  const [practiceNotes, parentWorkflow, incomingMessages, communications] = await Promise.all([
    getPracticeNoteLogRows(),
    getParentUnderstandingWorkflow(),
    getIncomingMessageInbox(),
    getCommunicationLog(),
  ]);
  const insights = buildLearningInsights({
    practiceNotes,
    parentRecords: parentWorkflow.records,
    incomingMessages,
    communications,
  });
  const { practice, parents, inbox, communications: communication } = insights;

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Read-only learning view</p>
        <h2 className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800" style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}>
          Signals & Learning
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          A rolling {insights.windowDays}-day view of what the existing workflows are telling us. It highlights patterns and uncertainty; it does not claim that a copied message was delivered or that one action caused an outcome.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Practice-note quality</h3>
          <p className="mt-1 text-sm text-slate-600">Separate delivery evidence from notes that were simply recorded.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard label="Notes logged" value={practice.total} href="/admin/students" copy={`${practice.withGoals} include practice goals · ${practice.withChallenges} include challenges`} />
          <InsightCard label="Delivery confirmed" value={practice.sent} href="/admin/students" copy={`${practice.failed} failed · ${practice.attendanceOnly} attendance-only`} />
          <InsightCard label="Delivery untracked" value={practice.deliveryUntracked} href="/admin/students" copy="Logged notes where this dashboard cannot confirm delivery." />
          <InsightCard label="Created 1+ day later" value={practice.lateCreated} href="/admin/students" copy="A prompt for handover or workflow review, not a judgement on teaching." />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Parent understanding</h3>
          <p className="mt-1 text-sm text-slate-600">Only fully assessed conversations count as understanding evidence; unanswered fields remain unknown.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard label="Completed call workflows" value={parents.completedWorkflow} href="/admin/workflows/parent-understanding" copy={`${parents.total} family records in the campaign`} />
          <InsightCard label="Fully assessed" value={parents.fullyAssessed} href="/admin/workflows/parent-understanding" copy={`${parents.partiallyAssessed} partial · ${parents.unassessed} not yet assessed`} />
          <InsightCard label="Clear or mostly clear" value={parents.clearOrMostlyClear} href="/admin/workflows/parent-understanding" copy="Among fully assessed families only." />
          <InsightCard label="Practice at home recorded" value={parents.practiceAtHome.reduce((sum, item) => sum + item.count, 0)} href="/admin/workflows/parent-understanding" copy="Not a measure of every family—only answers captured in check-ins." />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ThemeList title="Most common confirmed follow-up themes" rows={parents.topSignals} empty="No confirmed follow-up themes yet." />
          <ThemeList title="Recorded practice-at-home pattern" rows={parents.practiceAtHome} empty="No practice-at-home answers recorded yet." />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Parent message workflow</h3>
          <p className="mt-1 text-sm text-slate-600">Triage outcomes, not a claim that every parent received or acted on a reply.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard label="Messages captured" value={inbox.total} href="/admin/incoming-messages" copy={`${inbox.open} still open`} />
          <InsightCard label="Planning tasks created" value={inbox.planned} href="/admin/incoming-messages" copy="Messages that turned into tracked work." />
          <InsightCard label="Handled, no plan" value={inbox.handledNoPlan} href="/admin/incoming-messages" copy="Reviewed and closed without creating work." />
          <InsightCard label="Average time to review" value={inbox.averageReviewHours === null ? '—' : `${inbox.averageReviewHours}h`} href="/admin/incoming-messages" copy="Based only on messages with both captured and reviewed times." />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ThemeList title="Most common inbox topics" rows={inbox.categories} />
          <ThemeList title="Messages copied to send" rows={communication.categories} empty="No copied-message record in this period." />
        </div>
      </section>
    </div>
  );
}
