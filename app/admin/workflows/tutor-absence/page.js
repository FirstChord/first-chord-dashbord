import Link from 'next/link';
import AdminTutorAbsencePageClient from '@/components/admin/AdminTutorAbsencePageClient';
import { getOpenTutorAbsences, getTutorAbsenceWorkflow } from '@/lib/admin/tutor-absence';
import { formatTutorAbsenceDate } from '@/lib/admin/tutor-absence-helpers.mjs';

function statusLabel(status = '') {
  const labels = {
    draft: 'Draft',
    in_progress: 'In progress',
    parents_to_message: 'Parents to message',
    resolved: 'Resolved',
  };
  return labels[status] || status || 'Draft';
}

function LoggedAbsences({ absences = [], selectedTutor = '', selectedDate = '' }) {
  if (!absences.length) {
    return null;
  }

  return (
    <section className="rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
      <h3 className="text-lg font-semibold text-slate-900">Absences needing direct attention</h3>
      <p className="mt-1 text-sm text-slate-600">
        Cover decisions stay here. Cancelled dates are handled through their grouped pause cards in Planning and close automatically when those cards are complete.
      </p>
      <ul className="mt-4 space-y-2">
        {absences.map((absence) => {
          const isSelected = absence.tutorShortName === selectedTutor && absence.absenceDate === selectedDate;
          return (
            <li key={absence.absenceId}>
              <Link
                href={`/admin/workflows/tutor-absence?tutor=${encodeURIComponent(absence.tutorShortName)}&date=${encodeURIComponent(absence.absenceDate)}`}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
                  isSelected
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-white'
                }`}
              >
                <span className="font-semibold text-slate-900">
                  {absence.tutorName || absence.tutorShortName} · {formatTutorAbsenceDate(absence.absenceDate)}
                </span>
                <span className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">
                    {statusLabel(absence.status)}
                  </span>
                  {absence.remainingMessages > 0 ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
                      {absence.remainingMessages} message{absence.remainingMessages === 1 ? '' : 's'} left
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function AdminTutorAbsenceWorkflowPage({ searchParams }) {
  const params = await searchParams;
  const tutorShortName = params?.tutor || '';
  const absenceDate = params?.date || '';

  const [workflow, absences] = await Promise.all([
    getTutorAbsenceWorkflow({ tutorShortName, absenceDate }),
    getOpenTutorAbsences(),
  ]);

  return (
    <div className="space-y-8">
      <LoggedAbsences
        absences={absences}
        selectedTutor={workflow.selectedTutor?.shortName || ''}
        selectedDate={workflow.selectedDate || ''}
      />
      <AdminTutorAbsencePageClient workflow={workflow} />
    </div>
  );
}
