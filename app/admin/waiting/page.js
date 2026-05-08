import AdminWaitingPageClient from '@/components/admin/AdminWaitingPageClient';
import { getWaitingWorkflowStudents } from '@/lib/admin/waiting-workflow.js';

export default async function AdminWaitingPage() {
  const students = await getWaitingWorkflowStudents();
  return <AdminWaitingPageClient initialStudents={students} />;
}
