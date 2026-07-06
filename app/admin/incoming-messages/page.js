import AdminIncomingMessagesPageClient from '@/components/admin/AdminIncomingMessagesPageClient';
import { getBridgeStatus, getIncomingMessageInbox, getWhatsappGroupMap } from '@/lib/admin/incoming-messages';
import { getOperationalAdminStudents } from '@/lib/admin/students';

export default async function AdminIncomingMessagesPage() {
  let inbox = [];
  let groupMap = [];
  let students = [];
  let bridgeStatus = null;
  let error = '';
  try {
    [inbox, groupMap, students, bridgeStatus] = await Promise.all([
      getIncomingMessageInbox(),
      getWhatsappGroupMap(),
      getOperationalAdminStudents(),
      getBridgeStatus().catch(() => null),
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
      bridgeStatus={bridgeStatus}
      error={error}
    />
  );
}
