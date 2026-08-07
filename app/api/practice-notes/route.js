import { appendPracticeNoteLogRow } from '@/lib/admin/sheets';
import { normalisePracticeNotePayload } from '@/lib/admin/practice-notes-helpers.mjs';
import {
  resolveSelectedPracticeNoteSongs,
  resolveUnlistedPracticeNoteSongs,
} from '@/lib/admin/practice-chat-music-context.mjs';
import { authenticatePracticeChatRequest, corsHeaders } from '@/lib/admin/practice-chat-auth.mjs';
import { syncNoteSongsToShelf } from '@/lib/admin/practice-note-shelf-sync.mjs';

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
    const requestedUnlistedSongTitles = Array.isArray(body?.unlistedSongTitles)
      ? body.unlistedSongTitles
      : [];
    if ((requestedSongIds.length || requestedUnlistedSongTitles.length) && !studentMmsId) {
      return Response.json({ error: 'studentMmsId is required for song links' }, { status: 400, headers });
    }
    const songLinks = requestedSongIds.length
      ? resolveSelectedPracticeNoteSongs({ songIds: requestedSongIds })
      : { songIds: [], songTitles: [], errors: [] };
    const unlistedSongs = resolveUnlistedPracticeNoteSongs({ titles: requestedUnlistedSongTitles });
    const songErrors = [...songLinks.errors, ...unlistedSongs.errors];
    if (songErrors.length) {
      return Response.json({ error: songErrors.join(', ') }, { status: 400, headers });
    }
    const note = normalisePracticeNotePayload({
      ...body,
      ...songLinks,
      unlistedSongTitles: unlistedSongs.titles,
      userAgent: request.headers.get('user-agent') || body?.userAgent || '',
    });

    if (note.errors.length) {
      return Response.json({ error: note.errors.join(', ') }, { status: 400, headers });
    }

    const result = await appendPracticeNoteLogRow(note);

    // A confirmed song link is the tutor saying "we worked on this", so it
    // earns a place on the shelf. After the note is safely stored, and unable
    // to fail it.
    if (!result?.skipped) {
      await syncNoteSongsToShelf({
        studentMmsId: note.studentMmsId,
        songIds: note.songIds,
        tutorName: note.actingTutor || note.tutorName,
      });
    }

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
