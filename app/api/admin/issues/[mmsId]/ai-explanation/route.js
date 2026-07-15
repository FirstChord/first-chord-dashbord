import { randomUUID } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { assistantContextService } from '@/lib/admin/assistant-context-service.mjs';
import { buildIssueExplanation } from '@/lib/admin/issue-explanation-helpers.mjs';
import { IssueAiBriefingError } from '@/lib/admin/issue-explanation-ai-contract.mjs';
import { generateIssueAiBriefing } from '@/lib/admin/issue-explanation-ai-provider.mjs';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const recentRequestsByAdmin = new Map();

function noStore(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: { ...init.headers, 'Cache-Control': 'no-store' },
  });
}

function isRateLimited(adminKey, now = Date.now()) {
  const recent = (recentRequestsByAdmin.get(adminKey) || [])
    .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    recentRequestsByAdmin.set(adminKey, recent);
    return true;
  }
  recent.push(now);
  recentRequestsByAdmin.set(adminKey, recent);
  return false;
}

function hasExactRequestShape(body) {
  const keys = Object.keys(body || {}).sort();
  return keys.length === 2 && keys[0] === 'issueType' && keys[1] === 'source';
}

function safeFailure(error) {
  if (error instanceof TypeError) return { status: 400, message: error.message };
  if (!(error instanceof IssueAiBriefingError)) {
    return { status: 500, message: 'The AI pilot is unavailable right now' };
  }
  if (error.code === 'not_configured') {
    return { status: 503, message: 'The AI pilot has not been enabled yet' };
  }
  if (error.code === 'timeout') {
    return { status: 504, message: 'The AI pilot took too long. The standard explanation is still available.' };
  }
  return { status: 503, message: 'The AI pilot is unavailable right now' };
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return noStore({ error: 'Unauthorized' }, { status: 401 });

  const adminKey = `${session.user.email || session.user.name || 'admin'}`;
  if (isRateLimited(adminKey)) {
    return noStore(
      { error: 'Please wait before requesting another AI briefing' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: 'A source and issue type are required' }, { status: 400 });
  }
  if (!hasExactRequestShape(body)) {
    return noStore({ error: 'Only source and issue type are accepted' }, { status: 400 });
  }

  const requestId = randomUUID();
  const { mmsId } = await params;
  try {
    const result = await assistantContextService.getIssueContext({
      mmsId,
      source: body.source,
      issueType: body.issueType,
    });
    if (!result.context) return noStore({ error: 'Issue context was not found' }, { status: 404 });

    const explanation = buildIssueExplanation(result.context, { availability: result.availability });
    const generated = await generateIssueAiBriefing(explanation, { requestId });

    console.info(JSON.stringify({
      event: 'admin_ai_issue_briefing',
      requestId,
      source: explanation.source.code,
      issueType: result.context.issue?.type || '',
      model: generated.model,
      promptVersion: generated.promptVersion,
      schemaVersion: generated.schemaVersion,
      latencyMs: generated.latencyMs,
      usage: generated.usage,
      outcome: 'validated',
    }));

    return noStore({
      requestId,
      briefing: generated.briefing,
    });
  } catch (error) {
    const failure = safeFailure(error);
    console.warn(JSON.stringify({
      event: 'admin_ai_issue_briefing',
      requestId,
      outcome: 'failed',
      errorCode: error instanceof IssueAiBriefingError ? error.code : 'internal_error',
    }));
    return noStore({ error: failure.message }, { status: failure.status });
  }
}
