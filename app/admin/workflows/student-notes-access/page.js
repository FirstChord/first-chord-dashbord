import { getServerSession } from 'next-auth';
import AdminStudentNotesAccessPageClient from '@/components/admin/AdminStudentNotesAccessPageClient';
import { authOptions } from '@/lib/admin/auth';
import { getStudentNotesAccessWorkflow } from '@/lib/admin/student-notes-access';

export default async function AdminStudentNotesAccessPage({ searchParams }) {
  const [workflow, session, resolvedSearchParams] = await Promise.all([
    getStudentNotesAccessWorkflow(),
    getServerSession(authOptions),
    searchParams,
  ]);
  return (
    <AdminStudentNotesAccessPageClient
      initialWorkflow={workflow}
      actorEmail={session?.user?.email || ''}
      initialStudentMmsId={`${resolvedSearchParams?.student || ''}`}
    />
  );
}
