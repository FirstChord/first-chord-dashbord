import { randomUUID } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { appendEventLogRows } from '@/lib/admin/sheets';
import { updateWaitingWorkflowState } from '@/lib/admin/waiting-workflow.js';

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const mmsId = `${body?.mmsId || ''}`.trim();
  const status = `${body?.status || ''}`.trim();
  const note = typeof body?.note === 'string' ? body.note : '';

  if (!mmsId) {
    return Response.json({ error: 'mmsId is required' }, { status: 400 });
  }

  try {
    const state = await updateWaitingWorkflowState({
      mmsId,
      status,
      note,
      parentName: body?.parentName || '',
      parentEmail: body?.parentEmail || '',
      dateStarted: body?.dateStarted || '',
    });

    const now = new Date().toISOString();
    const events = [
      {
        eventId: randomUUID(),
        occurredAt: now,
        actorEmail: session.user.email || '',
        entityType: 'waiting',
        entityId: mmsId,
        eventType: 'waiting_status_changed',
        mmsId,
        studentName: body?.studentName || mmsId,
        issueId: '',
        payloadJson: JSON.stringify({
          next_status: state.status,
          note: state.note,
        }),
      },
    ];

    await appendEventLogRows(events);

    return Response.json({ success: true, state });
  } catch (error) {
    return Response.json({ error: error.message || 'Waiting state update failed' }, { status: 500 });
  }
}
