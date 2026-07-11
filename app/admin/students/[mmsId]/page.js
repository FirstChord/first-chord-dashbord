import { notFound } from 'next/navigation';
import { getAdminStudentByMmsId } from '@/lib/admin/students';
import { getActiveTutorOptions } from '@/lib/admin/tutors';
import { getPlanningDashboard } from '@/lib/admin/planning';
import { getPracticeNoteLogRows } from '@/lib/admin/sheets';
import { getCommunicationLogForStudent } from '@/lib/admin/communications';
import AdminStudentDetailClient from '@/components/admin/AdminStudentDetailClient';

export default async function AdminStudentDetailPage({ params }) {
  const resolvedParams = await params;
  const [student, planning, recentPracticeNotes, recentCommunications] = await Promise.all([
    getAdminStudentByMmsId(resolvedParams.mmsId),
    getPlanningDashboard(),
    getPracticeNoteLogRows(resolvedParams.mmsId),
    getCommunicationLogForStudent(resolvedParams.mmsId, { limit: 5 }),
  ]);
  const tutorOptions = await getActiveTutorOptions();

  if (!student) {
    notFound();
  }

  const linkedPlanningItems = (planning.items || [])
    .filter((item) => (item.linkedStudentIds || [item.linkedStudentId]).includes(student.mmsId))
    .filter((item) => !['done', 'parked'].includes(item.status))
    .map((item) => ({
      planningId: item.planningId,
      title: item.title,
      status: item.status,
      statusLabel: item.statusLabel,
      owner: item.owner,
      targetDate: item.targetDate,
      nextAction: item.nextAction,
      linkedWorkflowId: item.linkedWorkflowId,
      momentumLabel: item.momentumLabel,
    }));

  return (
    <AdminStudentDetailClient
      student={student}
      tutorOptions={tutorOptions}
      linkedPlanningItems={linkedPlanningItems}
      recentPracticeNotes={recentPracticeNotes.slice(0, 5)}
      recentCommunications={recentCommunications}
    />
  );
}
