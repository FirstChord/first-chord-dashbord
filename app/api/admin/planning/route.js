import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import {
  addPlanningProgress,
  getPlanningDashboard,
  savePlanningItem,
  updatePlanningStatus,
} from '@/lib/admin/planning';
import { syncTutorAbsenceHandoffsFromPlanning } from '@/lib/admin/tutor-absence';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return Response.json({ success: true, planning: await getPlanningDashboard() });
  } catch (error) {
    return Response.json({ error: error.message || 'Planning load failed' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const mode = `${body?.mode || 'save'}`.trim();
  const actorEmail = session.user.email || '';

  try {
    if (mode === 'progress') {
      await addPlanningProgress({
        planningId: `${body?.planningId || ''}`.trim(),
        progressNote: body?.progressNote || '',
        progressType: body?.progressType || 'note',
        nextAction: body?.nextAction,
        targetDate: body?.targetDate,
        status: body?.status,
        actorEmail,
      });
    } else if (mode === 'status') {
      await updatePlanningStatus({
        planningId: `${body?.planningId || ''}`.trim(),
        status: body?.status || '',
        progressNote: body?.progressNote || '',
        actorEmail,
      });
      if (`${body?.status || ''}`.trim() === 'done') {
        await syncTutorAbsenceHandoffsFromPlanning({ actorEmail });
      }
    } else {
      await savePlanningItem({
        planningId: `${body?.planningId || ''}`.trim(),
        item: body?.item || {},
        progressNote: body?.progressNote || '',
        actorEmail,
      });
    }

    return Response.json({ success: true, planning: await getPlanningDashboard() });
  } catch (error) {
    return Response.json({ error: error.message || 'Planning save failed' }, { status: 500 });
  }
}
