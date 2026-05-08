import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { setShowcaseTaskCompleted } from '@/lib/admin/showcase';

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const workflowKey = `${body?.workflowKey || ''}`.trim();
  const season = `${body?.season || ''}`.trim();
  const year = `${body?.year || ''}`.trim();
  const groupId = `${body?.groupId || ''}`.trim();
  const taskId = `${body?.taskId || ''}`.trim();
  const taskLabel = `${body?.taskLabel || ''}`.trim();
  const completed = Boolean(body?.completed);

  if (!workflowKey || !season || !year || !groupId || !taskId || !taskLabel) {
    return Response.json({ error: 'workflowKey, season, year, groupId, taskId, and taskLabel are required' }, { status: 400 });
  }

  try {
    const taskState = await setShowcaseTaskCompleted({
      workflowKey,
      season,
      year,
      groupId,
      taskId,
      taskLabel,
      completed,
    });

    return Response.json({
      success: true,
      task: taskState,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Showcase task update failed' }, { status: 500 });
  }
}
