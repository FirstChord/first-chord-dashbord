import AdminPlanningPageClient from '@/components/admin/AdminPlanningPageClient';
import { getPlanningDashboard } from '@/lib/admin/planning';

export default async function AdminPlanningPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const planning = await getPlanningDashboard();
  const initialFilter = resolvedSearchParams?.filter === 'due_now' ? 'due_now' : 'all';

  return <AdminPlanningPageClient initialPlanning={planning} initialFilter={initialFilter} />;
}
