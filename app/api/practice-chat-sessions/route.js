/** @fileoverview Practice Chat evaluation telemetry sink writing only to Practice_Chat_Sessions; it measures the ritual and never affects it. */
import { upsertPracticeChatSessionRow } from '@/lib/admin/sheets';
import { normalisePracticeChatSessionPayload } from '@/lib/admin/practice-chat-session-helpers.mjs';
import { authenticatePracticeChatRequest, corsHeaders } from '@/lib/admin/practice-chat-auth.mjs';

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin') || ''),
  });
}

/**
 * Practice Chat evaluation telemetry.
 *
 * This route measures the ritual; it never affects it. It performs no provider
 * work, sends nothing, and writes only to `Practice_Chat_Sessions`. The PWA
 * calls it three times as a session progresses and ignores the outcome
 * completely — a failure here must cost a tutor nothing.
 *
 * It deliberately accepts no note text, transcript or audio. Anything of that
 * kind in the body is dropped by `normalisePracticeChatSessionPayload`, which
 * builds its result from a fixed field list rather than spreading the request.
 */
export async function POST(request) {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin);
  const auth = authenticatePracticeChatRequest(request);

  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers });
  }

  try {
    const body = await request.json();
    const session = normalisePracticeChatSessionPayload(body);

    if (session.errors.length) {
      return Response.json({ error: session.errors.join(', ') }, { status: 400, headers });
    }

    await upsertPracticeChatSessionRow(session);

    return Response.json({ success: true, sessionId: session.sessionId }, { headers });
  } catch (error) {
    return Response.json({
      error: error.message || 'Practice Chat session save failed',
    }, { status: 500, headers });
  }
}
