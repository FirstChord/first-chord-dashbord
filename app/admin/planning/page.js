import AdminPlanningPageClient from '@/components/admin/AdminPlanningPageClient';
import { getPlanningDashboard } from '@/lib/admin/planning';

export default async function AdminPlanningPage() {
  const planning = await getPlanningDashboard();

  return <AdminPlanningPageClient initialPlanning={planning} />;
}
