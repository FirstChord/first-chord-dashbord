import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { performStudentNotesAccessAction } from '@/lib/admin/student-notes-access';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const studentMmsId = `${body.studentMmsId || ''}`.trim();
  const action = `${body.action || ''}`.trim();
  if (!studentMmsId || !action) {
    return Response.json({ error: 'studentMmsId and action are required' }, { status: 400 });
  }

  try {
    const result = await performStudentNotesAccessAction({
      studentMmsId,
      action,
      actorEmail: session.user.email || '',
      expectedUpdatedAt: body.expectedUpdatedAt || '',
      pendingCredentialId: body.pendingCredentialId || '',
      followUpNote: body.followUpNote || '',
    });
    return Response.json({ success: true, ...result }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return Response.json(
      { error: error.message || 'Student notes workflow action failed' },
      { status: Number(error.status || 500), headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
