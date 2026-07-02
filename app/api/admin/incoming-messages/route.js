import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import {
  addStudentToGroup,
  captureIncomingMessage,
  convertIncomingMessageToPlanning,
  correctIncomingMessage,
  deleteIncomingMessage,
  getIncomingMessageInbox,
  getWhatsappGroupMap,
  reviewWhatsappGroup,
  syncWhatsappGroups,
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
  let extra = {};

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
        actorEmail: session.user.email || '',
      });
    } else if (mode === 'correct') {
      if (!isAdmin) {
        return Response.json({ error: 'Admin session required for message correction' }, { status: 401 });
      }
      await correctIncomingMessage({
        incomingId: `${body?.incomingId || ''}`.trim(),
        category: body?.category || '',
        matchedMmsId: body?.matchedMmsId || '',
        reviewNote: body?.reviewNote || '',
        confirmGroupMap: Boolean(body?.confirmGroupMap),
        actorEmail: session.user.email || '',
        status: body?.status || 'needs_review',
      });
    } else if (mode === 'sync_groups') {
      // Bridge (secret) or admin can push the group dump.
      const result = await syncWhatsappGroups({
        groups: Array.isArray(body?.groups) ? body.groups : [],
        actorEmail: isAdmin ? session.user.email || '' : 'incoming-message-bridge',
      });
      extra = { groupSyncSummary: result.summary };
    } else if (mode === 'review_group') {
      if (!isAdmin) {
        return Response.json({ error: 'Admin session required for group review' }, { status: 401 });
      }
      await reviewWhatsappGroup({
        chatId: `${body?.chatId || ''}`.trim(),
        matchedMmsId: body?.matchedMmsId || '',
        status: body?.status || 'confirmed',
        actorEmail: session.user.email || '',
      });
    } else if (mode === 'add_group_student') {
      if (!isAdmin) {
        return Response.json({ error: 'Admin session required to edit a group' }, { status: 401 });
      }
      await addStudentToGroup({
        chatId: `${body?.chatId || ''}`.trim(),
        mmsId: `${body?.mmsId || ''}`.trim(),
        actorEmail: session.user.email || '',
      });
    } else if (mode === 'convert') {
      if (!isAdmin) {
        return Response.json({ error: 'Admin session required for planning conversion' }, { status: 401 });
      }
      const result = await convertIncomingMessageToPlanning({
        incomingId: `${body?.incomingId || ''}`.trim(),
        category: body?.category || '',
        matchedMmsId: body?.matchedMmsId || '',
        reviewNote: body?.reviewNote || '',
        confirmGroupMap: Boolean(body?.confirmGroupMap),
        actorEmail: session.user.email || '',
      });
      extra = { planningId: result.planningId, replyTemplate: result.replyTemplate };
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
    return Response.json({ success: true, inbox, groupMap, ...extra });
  } catch (error) {
    return Response.json({ error: error.message || 'Incoming message save failed' }, { status: 500 });
  }
}
