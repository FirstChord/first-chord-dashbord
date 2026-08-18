/** @fileoverview Read-only, best-effort endpoint giving Practice Chat the instrument and shelf songs a lesson is likely to mention, to prime transcription. */
import { getSongAssignmentRows } from '@/lib/admin/sheets';
import { buildPracticeChatMusicContext } from '@/lib/admin/practice-chat-music-context.mjs';
import { authenticatePracticeChatRequest, corsHeaders } from '@/lib/admin/practice-chat-auth.mjs';

// Supplies Practice Chat with the words this lesson is likely to contain — the
// student's instrument and the songs on their shelf — so the transcription
// model can be told what to expect instead of guessing from a general prior.
//
// Read-only and best-effort: if this fails the PWA transcribes without a prompt,
// exactly as it does today. Returns no personal data beyond what the caller
// already holds (it is called with the student id it was launched with).

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin') || ''),
  });
}

export async function GET(request) {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin);
  const auth = authenticatePracticeChatRequest(request);

  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers });
  }

  const studentId = `${new URL(request.url).searchParams.get('studentId') || ''}`.trim();
  if (!studentId) {
    return Response.json({ error: 'studentId is required' }, { status: 400, headers });
  }

  try {
    const rows = await getSongAssignmentRows(studentId);
    const assignments = rows.filter((row) => row.mmsId === studentId);
    const context = buildPracticeChatMusicContext({ assignments });

    return Response.json({ success: true, ...context }, { headers });
  } catch (error) {
    return Response.json({
      error: error.message || 'Practice Chat music context lookup failed',
    }, { status: 500, headers });
  }
}
