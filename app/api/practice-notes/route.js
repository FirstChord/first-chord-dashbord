import { appendPracticeNoteLogRow, getSongAssignmentRows } from '@/lib/admin/sheets';
import { normalisePracticeNotePayload } from '@/lib/admin/practice-notes-helpers.mjs';
import { resolveSelectedPracticeNoteSongs } from '@/lib/admin/practice-chat-music-context.mjs';
import { authenticatePracticeChatRequest, corsHeaders } from '@/lib/admin/practice-chat-auth.mjs';

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin') || ''),
  });
}

export async function POST(request) {
  const origin = request.headers.get('origin') || '';
  const headers = corsHeaders(origin);
  const auth = authenticatePracticeChatRequest(request);

  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status, headers });
  }

  try {
    const body = await request.json();
    const studentMmsId = `${body?.studentMmsId || body?.studentId || ''}`.trim();
    const requestedSongIds = Array.isArray(body?.songIds) ? body.songIds : [];
    if (requestedSongIds.length && !studentMmsId) {
      return Response.json({ error: 'studentMmsId is required for song links' }, { status: 400, headers });
    }
    const songLinks = requestedSongIds.length
      ? resolveSelectedPracticeNoteSongs({
          songIds: requestedSongIds,
          assignments: await getSongAssignmentRows(studentMmsId),
        })
      : { songIds: [], songTitles: [], errors: [] };
    if (songLinks.errors.length) {
      return Response.json({ error: songLinks.errors.join(', ') }, { status: 400, headers });
    }
    const note = normalisePracticeNotePayload({
      ...body,
      ...songLinks,
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
