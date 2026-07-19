// Proposals-inbox reply lane (V1). Human-triggered only — there is no cron.
// Feature-flagged: with ADMIN_AI_REPLY_DRAFT_ENABLED unset the GET reports
// available:false and drafting returns 503; deciding an already-created
// proposal keeps working so a flag flip never strands open suggestions.
import { randomUUID } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { IncomingReplyAiError } from '@/lib/admin/incoming-reply-ai-contract.mjs';
import { isIncomingReplyDraftingConfigured } from '@/lib/admin/incoming-reply-ai-provider.mjs';
import {
  decideIncomingReplyProposal,
  draftIncomingReplyProposal,
  getIncomingReplyProposals,
} from '@/lib/admin/incoming-reply-proposals';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const recentDraftsByAdmin = new Map();

function noStore(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: { ...init.headers, 'Cache-Control': 'no-store' },
  });
}

function isRateLimited(adminKey, now = Date.now()) {
  const recent = (recentDraftsByAdmin.get(adminKey) || [])
    .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    recentDraftsByAdmin.set(adminKey, recent);
    return true;
  }
  recent.push(now);
  recentDraftsByAdmin.set(adminKey, recent);
  return false;
}

function safeDraftFailure(error) {
  if (!(error instanceof IncomingReplyAiError)) {
    return { status: 500, message: error?.message || 'Reply drafting failed' };
  }
  if (error.code === 'not_configured') {
    return { status: 503, message: 'Reply drafting has not been enabled yet' };
  }
  if (error.code === 'timeout') {
    return { status: 504, message: 'Reply drafting took too long — try again if still useful' };
  }
  if (error.code === 'invalid_draft') {
    return { status: 503, message: 'The drafted reply failed the policy check and was not saved' };
  }
  return { status: 503, message: 'Reply drafting is unavailable right now' };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return noStore({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { openByIncomingId, telemetry } = await getIncomingReplyProposals();
    return noStore({
      success: true,
      available: isIncomingReplyDraftingConfigured(),
      openByIncomingId,
      telemetry,
    });
  } catch (error) {
    return noStore({ error: error.message || 'Reply proposals load failed' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return noStore({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = `${body?.mode || ''}`.trim();
  const actorEmail = session.user.email || '';

  if (mode === 'draft') {
    if (!isIncomingReplyDraftingConfigured()) {
      return noStore({ error: 'Reply drafting has not been enabled yet' }, { status: 503 });
    }

    const adminKey = `${actorEmail || session.user.name || 'admin'}`;
    if (isRateLimited(adminKey)) {
      return noStore(
        { error: 'Please wait before drafting more replies' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }

    const requestId = randomUUID();
    try {
      const result = await draftIncomingReplyProposal({
        incomingId: `${body?.incomingId || ''}`.trim(),
        actorEmail,
        requestId,
      });

      console.info(JSON.stringify({
        event: 'admin_ai_incoming_reply',
        requestId,
        outcome: 'proposed',
        policyCase: result.policyCase,
        noticeWindow: result.noticeWindow,
        neutralFallback: result.neutralFallback,
        ...(result.modelMeta || {}),
      }));

      return noStore({
        success: true,
        proposal: {
          proposalId: result.proposal.proposalId,
          linkedId: result.proposal.linkedId,
          proposalBody: result.proposal.proposalBody,
          createdAt: result.proposal.createdAt,
          createdBy: result.proposal.createdBy,
        },
      });
    } catch (error) {
      const failure = safeDraftFailure(error);
      console.warn(JSON.stringify({
        event: 'admin_ai_incoming_reply',
        requestId,
        outcome: 'failed',
        errorCode: error instanceof IncomingReplyAiError ? error.code : 'internal_error',
        validationErrors: error instanceof IncomingReplyAiError ? error.details : [],
      }));
      return noStore({ error: failure.message }, { status: failure.status });
    }
  }

  if (mode === 'decide') {
    try {
      const { proposal } = await decideIncomingReplyProposal({
        proposalId: `${body?.proposalId || ''}`.trim(),
        decision: `${body?.decision || ''}`.trim(),
        finalBody: body?.finalBody || '',
        rejectionReason: body?.rejectionReason || '',
        actorEmail,
      });

      console.info(JSON.stringify({
        event: 'admin_ai_incoming_reply',
        outcome: 'decided',
        decision: `${body?.decision || ''}`.trim(),
        status: proposal.status,
        edited: proposal.status === 'approved' && proposal.appliedBody !== proposal.proposalBody,
      }));

      return noStore({
        success: true,
        proposal: {
          proposalId: proposal.proposalId,
          linkedId: proposal.linkedId,
          status: proposal.status,
          appliedBody: proposal.appliedBody,
        },
      });
    } catch (error) {
      return noStore({ error: error.message || 'Proposal decision failed' }, { status: 400 });
    }
  }

  return noStore({ error: 'Unknown mode' }, { status: 400 });
}
