import AdminTutorAbsencePageClient from '@/components/admin/AdminTutorAbsencePageClient';
import { getTutorAbsenceWorkflow } from '@/lib/admin/tutor-absence';

export default async function AdminTutorAbsenceWorkflowPage({ searchParams }) {
  const params = await searchParams;
  const workflow = await getTutorAbsenceWorkflow({
    tutorShortName: params?.tutor || '',
    absenceDate: params?.date || '',
  });

  return <AdminTutorAbsencePageClient workflow={workflow} />;
}
