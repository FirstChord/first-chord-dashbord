import { getMmsFreeCalendarSlots } from '@/lib/admin/mms';
import { getScheduleContextRows } from '@/lib/admin/sheets';
import { buildFreeSlotSummary, buildScheduleCacheSummary } from '@/lib/admin/capacity-helpers.mjs';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statCard(label, value, detail = '') {
  return (
    <div className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
      {detail ? <p className="mt-2 text-sm text-slate-600">{detail}</p> : null}
    </div>
  );
}

export default async function AdminCapacityPage() {
  const [scheduleRows, freeSlotResult] = await Promise.all([
    getScheduleContextRows(),
    getMmsFreeCalendarSlots({ lookaheadDays: 30 }).then(
      (slots) => ({ slots, error: '' }),
      (error) => ({ slots: [], error: error.message || 'Could not load MMS free slots' }),
    ),
  ]);

  const scheduleSummary = buildScheduleCacheSummary(scheduleRows);
  const freeSlots = freeSlotResult.slots;
  const freeSlotSummary = buildFreeSlotSummary(freeSlots);
  const upcomingSlots = freeSlots.slice(0, 40);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Capacity context</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Tutor Capacity
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Read-only view of MMS calendar slots marked as Free, plus schedule-cache health. This is the first capacity layer; future-hire or tentative availability can be added later as a separate overlay.
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">MMS free slots</h3>
          <p className="mt-1 text-sm text-slate-600">Calendar events with category Free in the next 30 days, excluding events already linked to students.</p>
        </div>
        {freeSlotResult.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {freeSlotResult.error}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          {statCard('Free slots', freeSlotSummary.totalSlots)}
          {statCard('Tutors with space', freeSlotSummary.tutorCount)}
          {statCard('Showing next', upcomingSlots.length, 'Earliest upcoming slots listed below.')}
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <h4 className="text-base font-semibold text-slate-900">By tutor</h4>
            <div className="mt-4 space-y-3">
              {freeSlotSummary.byTeacher.length ? freeSlotSummary.byTeacher.map((entry) => (
                <div key={entry.teacherName} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-700">{entry.teacherName}</span>
                  <span className="text-lg font-semibold text-slate-900">{entry.count}</span>
                </div>
              )) : (
                <p className="text-sm text-slate-600">No MMS Free slots found in this window.</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.6rem] border border-blue-100 bg-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-blue-50/70">
                <tr>
                  {['When', 'Tutor', 'Duration', 'Category'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcomingSlots.map((slot) => (
                  <tr key={slot.eventId || `${slot.teacherId}-${slot.startAt}`} className="transition hover:bg-blue-50/60">
                    <td className="px-4 py-3 text-sm text-slate-900">{formatDateTime(slot.startAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{slot.teacherName || slot.teacherId || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{slot.durationMinutes ? `${slot.durationMinutes} mins` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{slot.eventCategory || '—'}</td>
                  </tr>
                ))}
                {!upcomingSlots.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-slate-600">No upcoming free slots found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Schedule cache health</h3>
          <p className="mt-1 text-sm text-slate-600">This keeps the student schedule layer visible while capacity work starts.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCard('Cached students', scheduleSummary.totalCached)}
          {statCard('Found schedules', scheduleSummary.found)}
          {statCard('Missing schedules', scheduleSummary.missing)}
          {statCard('Stale / unchecked', scheduleSummary.stale, 'Older than 21 days or missing checked time.')}
          {statCard('Low confidence', scheduleSummary.lowConfidence)}
          {statCard('Shared slot groups', scheduleSummary.sharedSlotGroups, `${scheduleSummary.sharedStudents} students in shared slots.`)}
          {statCard('Missing teacher', scheduleSummary.missingTeacher)}
          {statCard('Missing duration', scheduleSummary.missingDuration)}
        </div>
      </section>
    </div>
  );
}
