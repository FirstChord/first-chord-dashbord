import AdminOnboardForm from '@/components/admin/AdminOnboardForm';
import { normaliseExperienceLevel, normaliseInstrument } from '@/lib/admin/fc';
import { getStudentDetails, getWaitingStudents } from '@/lib/admin/mms';
import { getOnboardingDuplicateState } from '@/lib/admin/onboarding';
import { getTutorsForInstrument } from '@/lib/admin/tutors';

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function AdminOnboardPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const mmsId = resolvedSearchParams?.mmsId || '';
  const waitingStudents = await getWaitingStudents();
  const selectedStudent = waitingStudents.find((student) => student.mmsId === mmsId) || null;
  const details = mmsId ? await getStudentDetails(mmsId) : null;
  const parsed = details?.parsed || {};
  const instrument = normaliseInstrument(parsed.instrument || '');
  const tutorOptions = getTutorsForInstrument(instrument.toLowerCase());
  const initialTutor = tutorOptions[0] || null;
  const duplicateState = mmsId && initialTutor
    ? await getOnboardingDuplicateState({
        mmsId,
        tutorFullName: initialTutor.fullName,
        tutorShortName: initialTutor.shortName,
      })
    : null;
  const initialData = details
    ? {
        mmsId,
        studentFirstName: details.firstName || selectedStudent?.firstName || '',
        studentLastName: details.lastName || selectedStudent?.lastName || '',
        parentFirstName: details.parentFirstName || selectedStudent?.parentFirstName || '',
        parentLastName: details.parentLastName || selectedStudent?.parentLastName || '',
        parentEmail: details.parentEmail || selectedStudent?.parentEmail || '',
        studentEmail: details.studentEmail || '',
        contactNumber: details.studentTelephone || details.parentTelephone || '',
        isAdult: Number(parsed.age || 0) >= 19,
        age: parsed.age || '',
        instrument,
        lessonLength: '30',
        lessonDay: '',
        lessonTime: '',
        lessonDate: '',
        isRecurring: true,
        tutorShortName: tutorOptions[0]?.shortName || '',
        thetaUsername: `${(details.firstName || '').toLowerCase()}${(details.lastName || '').toLowerCase()}fc`.replace(/[^a-z0-9]/g, ''),
        soundsliceUrl: '',
        soundsliceCode: '',
        experienceLevel:
          normaliseExperienceLevel(parsed.experience) === 'at an intermediate level'
            ? '3'
            : normaliseExperienceLevel(parsed.experience) === 'has some experience'
              ? '2'
              : '1',
        interests: [parsed.genres, parsed.songs].filter(Boolean).join(' / '),
        rawNote: details.note || '',
      }
    : null;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold text-slate-900">Onboarding</h2>
        <p className="mt-2 text-sm text-slate-600">
          Scaffold page for the next admin workflow slice. Waiting-list selection is now wired through.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Selected waiting-list student</h3>
        {selectedStudent ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Student</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{selectedStudent.fullName}</p>
              <p className="mt-1 text-xs text-slate-500">{selectedStudent.mmsId}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Parent</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{selectedStudent.parentName || '—'}</p>
              <p className="mt-1 text-xs text-slate-500">{selectedStudent.parentEmail || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Date added</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{formatDate(selectedStudent.dateStarted)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Waiting age</p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {selectedStudent.ageInDays == null ? '—' : `${selectedStudent.ageInDays} days`}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            No waiting-list student selected yet. Start from <code>/admin/waiting</code> and click <strong>Onboard</strong>.
          </p>
        )}
      </section>

      {initialData ? <AdminOnboardForm initialData={initialData} tutorOptions={tutorOptions} initialDuplicateState={duplicateState} /> : null}
    </div>
  );
}
