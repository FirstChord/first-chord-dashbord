import Link from 'next/link';
import { getTutorAbsenceStateRows, getPauseHistoryRows, getTutorPayRows } from '@/lib/admin/sheets';
import { getOperationalAdminStudents } from '@/lib/admin/students';
import { parseTutorAbsenceStateRow } from '@/lib/admin/tutor-absence-helpers.mjs';
import { parseTutorPay } from '@/lib/admin/cost-helpers.mjs';
import { buildReconciliationInputs } from '@/lib/admin/reconciliation-adapter.mjs';
import { reconcileEpisode } from '@/lib/admin/reconciliation-helpers.mjs';
import { formatMoney } from '@/lib/admin/finance-helpers.mjs';

export const dynamic = 'force-dynamic';

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function FamilyRow({ ep, name }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="text-slate-800">{name || ep.studentMmsId}</span>
      <span className="text-xs text-slate-500">
        {fmtDate(ep.window.start)}–{fmtDate(ep.window.end)} · {ep.affectedDates.length} lesson(s)
        {ep.netNewDates.length ? ` · ${ep.netNewDates.length} net-new` : ''}
        {ep.remainingActions.length ? ` · ${ep.remainingActions.join(', ')}` : ''}
      </span>
    </div>
  );
}

export default async function ReconciliationPreviewPage({ searchParams }) {
  const params = (await searchParams) || {};
  const tutorFilter = `${params.tutor || ''}`.trim();

  const [absenceRaw, pauseRows, tutorPayRows, students] = await Promise.all([
    getTutorAbsenceStateRows(),
    getPauseHistoryRows(),
    getTutorPayRows(),
    getOperationalAdminStudents(),
  ]);
  const absenceRows = absenceRaw.map(parseTutorAbsenceStateRow);
  const tutorPay = parseTutorPay(tutorPayRows);
  const studentsByMmsId = new Map(students.map((s) => [s.mmsId, s]));

  const tutors = [...new Set(
    absenceRows.filter((r) => r.decision === 'cancel_day' || r.decision === 'cover').map((r) => r.tutorShortName).filter(Boolean),
  )].sort();

  let result = null;
  let nameByMmsId = new Map();
  if (tutorFilter) {
    const inputs = buildReconciliationInputs({ absenceRows, pauseRows, tutorPay, studentsByMmsId, tutorFilter });
    nameByMmsId = new Map(inputs.lessonInstances.map((i) => [i.studentMmsId, i.studentName]));
    result = reconcileEpisode(inputs);
  }

  const conflicts = result ? result.familyEpisodes.filter((e) => e.needsClarification) : [];
  const suppressed = result ? result.familyEpisodes.filter((e) => !e.needsClarification && e.netNewDates.length === 0 && e.affectedDates.length > 0) : [];
  const netNew = result ? result.familyEpisodes.filter((e) => !e.needsClarification && e.netNewDates.length > 0) : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Internal · read-only preview</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Absence reconciliation</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          For a tutor absence, the net-new effect after reconciling against students&apos; own pauses. Shadow view — it
          does not change finance or create anything. Conflicts (a pause record that disagrees with the active flag) are
          surfaced for you to confirm, never auto-applied.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">Tutor:</span>
        {tutors.length ? tutors.map((t) => (
          <Link
            key={t}
            href={`/admin/finance/reconciliation?tutor=${encodeURIComponent(t)}`}
            className={`rounded-full border px-3 py-1 ${tutorFilter === t ? 'border-blue-300 bg-blue-50 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {t}
          </Link>
        )) : <span className="text-slate-500">No tutor-absence cancellations recorded.</span>}
      </div>

      {!tutorFilter ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Pick a tutor to preview their absence reconciliation.</p>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-100 bg-white/90 p-4">
              <p className="text-xs text-slate-500">Net-new revenue effect</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">−{formatMoney(result.finance.netNewRevenueLost)}</p>
              <p className="mt-1 text-xs text-slate-600">{result.finance.netNewNotBillingStudentWeeks} student-week(s) newly not billing</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-xs text-slate-500">Tutor pay effect</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(result.finance.netNewOriginalPaySaved - result.finance.netNewCoverPayAdded)}</p>
              <p className="mt-1 text-xs text-slate-600">£0 if the absent tutor is salaried</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs text-slate-500">Families</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{netNew.length} new · {suppressed.length} covered</p>
              <p className="mt-1 text-xs text-slate-600">{conflicts.length} need confirming</p>
            </div>
          </section>

          {conflicts.length ? (
            <section className="rounded-[1.6rem] border border-rose-200 bg-rose-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">Confirm these ({conflicts.length})</h3>
              <p className="mt-1 text-sm text-rose-900">
                A pause record covers these dates, but the student is flagged active. Either the pause is real (suppress) or
                the flag is right and the pause record is stale. Check before relying on the numbers.
              </p>
              <div className="mt-2 divide-y divide-rose-100">
                {conflicts.map((ep) => <FamilyRow key={ep.studentMmsId} ep={ep} name={nameByMmsId.get(ep.studentMmsId)} />)}
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-5">
              <h3 className="text-base font-semibold text-slate-900">Net-new — need a pause + message ({netNew.length})</h3>
              <div className="mt-2 divide-y divide-slate-100">
                {netNew.length ? netNew.map((ep) => <FamilyRow key={ep.studentMmsId} ep={ep} name={nameByMmsId.get(ep.studentMmsId)} />)
                  : <p className="px-3 py-2 text-sm text-slate-500">None.</p>}
              </div>
            </div>
            <div className="rounded-[1.6rem] border border-emerald-100 bg-emerald-50/50 p-5">
              <h3 className="text-base font-semibold text-slate-900">Already covered by their own pause ({suppressed.length})</h3>
              <p className="mt-1 text-xs text-slate-600">No new finance effect, no message needed.</p>
              <div className="mt-2 divide-y divide-emerald-100">
                {suppressed.length ? suppressed.map((ep) => <FamilyRow key={ep.studentMmsId} ep={ep} name={nameByMmsId.get(ep.studentMmsId)} />)
                  : <p className="px-3 py-2 text-sm text-slate-500">None.</p>}
              </div>
            </div>
          </section>

          <p className="text-xs text-slate-500">
            Read-only shadow over the absence facts + Pause History. Estimate (standard lesson pricing). Nothing here is
            written, sent, or fed into finance — it&apos;s for confirming the real net effect of an absence.
          </p>
        </>
      )}
    </div>
  );
}
