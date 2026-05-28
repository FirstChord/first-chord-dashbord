import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { saveParentUnderstandingRecord } from '@/lib/admin/parent-understanding';

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const studentMmsId = `${body?.studentMmsId || ''}`.trim();

  if (!studentMmsId) {
    return Response.json({ error: 'studentMmsId is required' }, { status: 400 });
  }

  try {
    const state = await saveParentUnderstandingRecord({
      studentMmsId,
      studentName: body?.studentName || '',
      parentName: body?.parentName || '',
      workflowStatus: body?.workflowStatus || '',
      loopStatus: body?.loopStatus || '',
      callAttemptCount: body?.callAttemptCount || 0,
      lastContactedAt: body?.lastContactedAt || '',
      details: body?.details || {},
      summary: body?.summary || '',
      updatedBy: session.user.email || '',
    });

    return Response.json({ success: true, state });
  } catch (error) {
    return Response.json({ error: error.message || 'Parent understanding record save failed' }, { status: 500 });
  }
}
