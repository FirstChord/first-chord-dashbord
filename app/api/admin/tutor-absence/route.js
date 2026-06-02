import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { saveTutorAbsenceWorkflow } from '@/lib/admin/tutor-absence';

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const absenceId = `${body?.absenceId || ''}`.trim();

  if (!absenceId) {
    return Response.json({ error: 'absenceId is required' }, { status: 400 });
  }

  try {
    const state = await saveTutorAbsenceWorkflow({
      absenceId,
      tutorShortName: body?.tutorShortName || '',
      tutorName: body?.tutorName || '',
      absenceDate: body?.absenceDate || '',
      status: body?.status || '',
      decision: body?.decision || '',
      coverTutorShortName: body?.coverTutorShortName || '',
      coverTutorName: body?.coverTutorName || '',
      affectedLessons: body?.affectedLessons || [],
      messageState: body?.messageState || {},
      note: body?.note || '',
      updatedBy: session.user.email || '',
    });

    return Response.json({ success: true, state });
  } catch (error) {
    return Response.json({ error: error.message || 'Tutor absence save failed' }, { status: 500 });
  }
}
