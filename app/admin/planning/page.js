import AdminPlanningPageClient from '@/components/admin/AdminPlanningPageClient';
import { getPlanningDashboard } from '@/lib/admin/planning';
import { getAdminStudents } from '@/lib/admin/students';

const ALLOWED_INITIAL_FILTERS = new Set([
  'due_now',
  'unassigned',
  'no_next_action',
  'waiting_status',
  'linked',
]);

export default async function AdminPlanningPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const [planning, students] = await Promise.all([
    getPlanningDashboard(),
    getAdminStudents(),
  ]);
  const requestedFilter = `${resolvedSearchParams?.filter || ''}`.trim();
  const initialFilter = ALLOWED_INITIAL_FILTERS.has(requestedFilter) ? requestedFilter : 'all';
  const studentOptions = students.map((student) => ({
    mmsId: student.mmsId,
    fullName: student.fullName,
    tutor: student.tutor,
    instrument: student.instrument,
    paymentExpectation: student.paymentExpectation,
  }));

  return <AdminPlanningPageClient initialPlanning={planning} initialFilter={initialFilter} studentOptions={studentOptions} />;
}
