import DashboardClient from './page-client';
import { getActiveTutorOptions } from '@/lib/admin/tutors';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const tutorOptions = await getActiveTutorOptions();
  return <DashboardClient tutorOptions={tutorOptions} />;
}
