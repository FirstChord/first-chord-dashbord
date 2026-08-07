import ScopeBadge from '@/components/admin/ui/ScopeBadge';
import Link from 'next/link';
import { getCommunicationLog } from '@/lib/admin/communications';
import { getIncomingMessageInbox } from '@/lib/admin/incoming-messages';
import { buildLearningInsights } from '@/lib/admin/learning-insights.mjs';
import { getParentUnderstandingWorkflow } from '@/lib/admin/parent-understanding';
import {
  getPracticeNoteLogRows,
  getSongAssignmentRows,
  prefetchSheetValues,
  COMMUNICATION_LOG_SHEET,
  INCOMING_MESSAGE_INBOX_SHEET,
  PRACTICE_NOTES_LOG_SHEET,
  SONG_ASSIGNMENTS_SHEET,
} from '@/lib/admin/sheets';
import { getRegistryEntries } from '@/lib/admin/registry';
import { buildPathsSignal } from '@/lib/songs/paths-signal.mjs';

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
              <span className="text-slate-700">
                <span className="block">{row.label.replaceAll('_', ' ')}</span>
                {row.detail ? <span className="mt-0.5 block text-xs text-slate-500">{row.detail}</span> : null}
              </span>
              <span className="font-semibold text-slate-900">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-slate-500">{empty}</p>}
    </section>
  );
}

export default async function AdminInsightsPage() {
  // A read-only page over four large tabs: one request instead of four.
  await prefetchSheetValues([
    PRACTICE_NOTES_LOG_SHEET,
    INCOMING_MESSAGE_INBOX_SHEET,
    COMMUNICATION_LOG_SHEET,
    SONG_ASSIGNMENTS_SHEET,
  ]).catch(() => {});

  const [practiceNotes, parentWorkflow, incomingMessages, communications, registryEntries, songAssignments] = await Promise.all([
    getPracticeNoteLogRows(),
    getParentUnderstandingWorkflow(),
    getIncomingMessageInbox(),
    getCommunicationLog(),
    getRegistryEntries().catch(() => []),
    getSongAssignmentRows('').catch(() => []),
  ]);
  const pathsSignal = buildPathsSignal({ students: registryEntries, assignmentRows: songAssignments });
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
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Signals</p>
        <h2 className="mt-2 flex items-center gap-3 fc-display text-3xl text-slate-900">
          Signals & Learning
          <ScopeBadge>Read-only</ScopeBadge>
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Patterns from the last {insights.windowDays} days — evidence, not proof.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Student paths</h3>
          <p className="mt-1 text-sm text-slate-600">Counts only students whose instrument has catalogue songs; an active song is one still in front of the student (not done or parked).</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            label="Students with an active song"
            value={pathsSignal.withActiveCount}
            copy={`of ${pathsSignal.eligibleCount} students whose instrument is in the catalogue`}
          />
          <InsightCard
            label="No active song"
            value={pathsSignal.noActiveCount}
            copy="Assign from the Songs panel on the tutor dashboard."
          />
        </div>
        {pathsSignal.noActiveCount > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <ThemeList
              title="No active song, by tutor"
              rows={pathsSignal.noActiveByTutor}
              empty="Every eligible student has an active song."
            />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Practice-note quality</h3>
          <p className="mt-1 text-sm text-slate-600">Separate delivery evidence from notes that were simply recorded.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard label="Notes logged" value={practice.total} href="/admin/students" copy={`${practice.withGoals} include practice goals · ${practice.withChallenges} include challenges`} />
          <InsightCard label="Song captured" value={practice.songObserved} href="/admin/students" copy={`${practice.songLinked} catalogue-linked · ${practice.unlistedSongNotes} with an unlisted title · ${practice.songUnlinked} with no song recorded`} />
          <InsightCard label="Delivery confirmed" value={practice.sent} href="/admin/students" copy={`${practice.failed} failed · ${practice.attendanceOnly} attendance-only`} />
          <InsightCard label="Created 1+ day later" value={practice.lateCreated} href="/admin/students" copy={`${practice.deliveryUntracked} logged notes have untracked delivery. Neither number judges teaching.`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ThemeList title="Catalogue songs in Practice Notes" rows={practice.songs} empty="No Practice Notes have tutor-confirmed catalogue links yet." />
          <ThemeList title="Unlisted repertoire to review" rows={practice.unlistedSongs} empty="No tutors have recorded an unlisted song in this period." />
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
          <InsightCard label="Planning tasks created" value={inbox.planned} href="/admin/incoming-messages" copy={`${inbox.linkedPlansDone} done · ${inbox.linkedPlansParked} parked · ${inbox.linkedPlansActive} active or unknown`} />
          <InsightCard label="Handled, no plan" value={inbox.handledNoPlan} href="/admin/incoming-messages" copy="Reviewed and closed without creating work." />
          <InsightCard label="Classifier decisions checked" value={inbox.classificationsReviewed} href="/admin/incoming-messages" copy={`${inbox.classificationsAccepted} accepted · ${inbox.classificationsCorrected} corrected. Legacy and untouched guesses are excluded.`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ThemeList title="Human-reviewed inbox topics" rows={inbox.categories} empty="No new classifier decisions have been checked yet." />
          <ThemeList title="Messages copied to send" rows={communication.categories} empty="No copied-message record in this period." />
        </div>
      </section>
    </div>
  );
}
