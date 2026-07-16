import { formatDateTime } from '@/lib/admin/student-detail-helpers.mjs';

function TempoTrend({ trend = [] }) {
  if (trend.length < 2) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="font-medium text-slate-600">Tempo:</span>
      {trend.map((point, index) => (
        <span key={`${point.date}-${index}`} className="flex items-center gap-1.5">
          {index > 0 ? <span className="text-slate-400">→</span> : null}
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">{point.value}%</span>
        </span>
      ))}
    </div>
  );
}

// Read-only lesson-by-lesson learning memory for a student, rendered on the
// admin student-detail page. Consumes the shape produced by
// buildStudentPracticeTimeline.
export default function PracticeTimelineSection({ timeline }) {
  if (!timeline || !timeline.noteCount) return null;
  // Newest first so the most recent lesson leads; the arc still reads top-down.
  const entries = [...timeline.entries].reverse();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Progress timeline</h3>
          <p className="mt-1 text-sm text-slate-600">
            Lesson-by-lesson learning memory, oldest to newest. Read-only context for handover.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
          {timeline.noteCount} {timeline.noteCount === 1 ? 'lesson' : 'lessons'}
        </span>
      </div>

      {timeline.nextLessonFocus ? (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Pick up where you left off</p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{timeline.nextLessonFocus}</p>
        </div>
      ) : null}

      <TempoTrend trend={timeline.tempoTrend} />

      <ol className="mt-4 space-y-3">
        {entries.map((entry) => (
          <li key={entry.noteId || `${entry.date}-${entry.tutorName}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{formatDateTime(entry.date)}</p>
              <p className="text-xs text-slate-500">{entry.tutorName || 'Tutor unknown'}</p>
            </div>
            {entry.whatWeDid ? (
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{entry.whatWeDid}</p>
            ) : null}
            {entry.progressChallenges ? (
              <p className="mt-2 whitespace-pre-line text-xs text-slate-600">
                <span className="font-medium text-slate-500">Progress: </span>{entry.progressChallenges}
              </p>
            ) : null}
            {entry.practiceGoals ? (
              <p className="mt-2 whitespace-pre-line text-xs text-slate-600">
                <span className="font-medium text-slate-500">Goals: </span>{entry.practiceGoals}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
