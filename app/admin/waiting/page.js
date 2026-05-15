import AdminWaitingPageClient from '@/components/admin/AdminWaitingPageClient';
import { buildWaitingCapacityMatches } from '@/lib/admin/capacity-helpers.mjs';
import { getMmsFreeCalendarSlots } from '@/lib/admin/mms';
import { getAllTutorOptions } from '@/lib/admin/tutors';
import { getWaitingWorkflowStudents } from '@/lib/admin/waiting-workflow.js';

export default async function AdminWaitingPage() {
  const [students, freeSlots] = await Promise.all([
    getWaitingWorkflowStudents(),
    getMmsFreeCalendarSlots({ lookaheadDays: 30 }).catch(() => []),
  ]);

  const studentsWithCapacity = buildWaitingCapacityMatches({
    waitingStudents: students,
    freeSlots,
    tutors: getAllTutorOptions(),
  });

  return <AdminWaitingPageClient initialStudents={studentsWithCapacity} />;
}
