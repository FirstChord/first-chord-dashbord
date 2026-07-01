import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import {
  captureIncomingMessage,
  deleteIncomingMessage,
  getIncomingMessageInbox,
  getWhatsappGroupMap,
  updateIncomingMessageReview,
} from '@/lib/admin/incoming-messages';

function hasValidIngestSecret(request) {
  const configured = `${process.env.INCOMING_MESSAGE_INGEST_SECRET || ''}`.trim();
  if (!configured) return false;
  const supplied = `${request.headers.get('x-firstchord-incoming-secret') || ''}`.trim();
  return supplied && supplied === configured;
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [inbox, groupMap] = await Promise.all([
      getIncomingMessageInbox(),
      getWhatsappGroupMap(),
    ]);
    return Response.json({ success: true, inbox, groupMap });
  } catch (error) {
    return Response.json({ error: error.message || 'Incoming inbox load failed' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  const isAdmin = Boolean(session?.user?.isAdmin);
  const isBridge = hasValidIngestSecret(request);

  if (!isAdmin && !isBridge) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = `${body?.mode || 'capture'}`.trim();

  try {
    if (mode === 'review') {
      if (!isAdmin) {
        return Response.json({ error: 'Admin session required for review changes' }, { status: 401 });
      }
      await updateIncomingMessageReview({
        incomingId: `${body?.incomingId || ''}`.trim(),
        status: body?.status || '',
        reviewNote: body?.reviewNote || '',
        createdPlanningId: body?.createdPlanningId || '',
      });
    } else if (mode === 'delete') {
      if (!isAdmin) {
        return Response.json({ error: 'Admin session required for message deletion' }, { status: 401 });
      }
      await deleteIncomingMessage({
        incomingId: `${body?.incomingId || ''}`.trim(),
      });
    } else {
      await captureIncomingMessage(body?.message || body || {}, {
        actorEmail: isAdmin ? session.user.email || '' : 'incoming-message-bridge',
      });
    }

    const [inbox, groupMap] = await Promise.all([
      getIncomingMessageInbox(),
      getWhatsappGroupMap(),
    ]);
    return Response.json({ success: true, inbox, groupMap });
  } catch (error) {
    return Response.json({ error: error.message || 'Incoming message save failed' }, { status: 500 });
  }
}
