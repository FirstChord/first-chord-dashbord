import { randomUUID } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { appendEventLogRow, setPracticeNoteFollowUpHandled } from '@/lib/admin/sheets';

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const deliveryKey = `${body?.deliveryKey || ''}`.trim();
  const noteId = `${body?.noteId || ''}`.trim();
  const mmsId = `${body?.mmsId || ''}`.trim();
  const studentName = `${body?.studentName || ''}`.trim();
  const issueId = `${body?.issueId || ''}`.trim();

  if (!deliveryKey && !noteId) {
    return Response.json({ error: 'deliveryKey or noteId is required' }, { status: 400 });
  }

  try {
    await setPracticeNoteFollowUpHandled({ deliveryKey, noteId });

    await appendEventLogRow({
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      actorEmail: session.user.email || '',
      entityType: 'practice_note',
      entityId: deliveryKey || noteId,
      eventType: 'practice_note_follow_up_handled',
      mmsId,
      studentName,
      issueId,
      payloadJson: JSON.stringify({
        delivery_key: deliveryKey,
        note_id: noteId,
      }),
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Follow-up update failed' }, { status: 500 });
  }
}
