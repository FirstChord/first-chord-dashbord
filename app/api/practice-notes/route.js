import { appendPracticeNoteLogRow } from '@/lib/admin/sheets';
import { normalisePracticeNotePayload } from '@/lib/admin/practice-notes-helpers.mjs';

const ALLOWED_ORIGINS = new Set([
  'https://practice-chat-pwa.web.app',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function corsHeaders(origin = '') {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://practice-chat-pwa.web.app';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin') || ''),
  });
}

export async function POST(request) {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin);

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403, headers });
  }

  try {
    const body = await request.json();
    const note = normalisePracticeNotePayload({
      ...body,
      userAgent: request.headers.get('user-agent') || body?.userAgent || '',
    });

    if (note.errors.length) {
      return Response.json({ error: note.errors.join(', ') }, { status: 400, headers });
    }

    const result = await appendPracticeNoteLogRow(note);

    return Response.json({
      success: true,
      noteId: note.noteId,
      skipped: Boolean(result?.skipped),
    }, { headers });
  } catch (error) {
    return Response.json({
      error: error.message || 'Practice note save failed',
    }, { status: 500, headers });
  }
}
