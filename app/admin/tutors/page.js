import AdminTutorLifecycleClient from '@/components/admin/AdminTutorLifecycleClient';
import { getTutorLifecycleDashboard } from '@/lib/admin/tutor-lifecycle.mjs';

export default async function AdminTutorsPage() {
  const tutors = await getTutorLifecycleDashboard();
  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Tutor lifecycle</p>
        <h2 className="mt-2 fc-display text-3xl text-slate-900">Tutors</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Mark departures, check the handover, then retire a tutor from live assignment choices. Their history stays intact.</p>
      </section>
      <AdminTutorLifecycleClient initialTutors={tutors} />
    </div>
  );
}
