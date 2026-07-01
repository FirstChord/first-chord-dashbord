import AdminIncomingMessagesPageClient from '@/components/admin/AdminIncomingMessagesPageClient';
import { getIncomingMessageInbox, getWhatsappGroupMap } from '@/lib/admin/incoming-messages';
import { getOperationalAdminStudents } from '@/lib/admin/students';

export default async function AdminIncomingMessagesPage() {
  let inbox = [];
  let groupMap = [];
  let students = [];
  let error = '';
  try {
    [inbox, groupMap, students] = await Promise.all([
      getIncomingMessageInbox(),
      getWhatsappGroupMap(),
      getOperationalAdminStudents(),
    ]);
  } catch (caught) {
    error = caught.message || 'Could not load incoming messages';
  }

  const studentOptions = students.map((student) => ({
    mmsId: student.mmsId,
    fcStudentId: student.fcStudentId,
    fullName: student.fullName,
    tutor: student.tutor,
    parentName: [student.parentFirstName, student.parentLastName].filter(Boolean).join(' ').trim(),
    parentPhone: student.contactNumber,
  }));

  return (
    <AdminIncomingMessagesPageClient
      initialInbox={inbox}
      initialGroupMap={groupMap}
      studentOptions={studentOptions}
      error={error}
    />
  );
}
