import AdminWaitingPageClient from '@/components/admin/AdminWaitingPageClient';
import { getWaitingStudentsWithCapacity } from '@/lib/admin/waiting-capacity';

export default async function AdminWaitingPage() {
  const { students, capacityContext } = await getWaitingStudentsWithCapacity();

  return <AdminWaitingPageClient initialStudents={students} initialCapacityContext={capacityContext} />;
}
