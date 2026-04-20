import { notFound } from 'next/navigation';
import { getAdminStudentByMmsId } from '@/lib/admin/students';
import { getAllTutorOptions } from '@/lib/admin/tutors';
import AdminStudentDetailClient from '@/components/admin/AdminStudentDetailClient';

export default async function AdminStudentDetailPage({ params }) {
  const resolvedParams = await params;
  const student = await getAdminStudentByMmsId(resolvedParams.mmsId);
  const tutorOptions = getAllTutorOptions();

  if (!student) {
    notFound();
  }

  return <AdminStudentDetailClient student={student} tutorOptions={tutorOptions} />;
}
