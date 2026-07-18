import { NextResponse } from 'next/server';
import { appendSongRequestRow } from '@/lib/admin/sheets';
import { buildSongRequestRow } from '@/lib/songs/request-helpers.mjs';
import { getTutorSurfaceTokenSecret, verifyStudentNotesToken } from '@/lib/tutor-surface-token.mjs';

// Tutor "request this song": a search miss on the Song Browser becomes a
// status='new' row in the Song_Requests curation queue. Append-only from the
// dashboard; the add-song skill resolves rows. Same per-student token identity
// as /api/song-assignments.
function authorize(token, studentId) {
  const secret = getTutorSurfaceTokenSecret();
  if (!secret) {
    return { ok: false, status: 503, code: 'token_secret_missing' };
  }
  const payload = verifyStudentNotesToken(token, { studentId, secret });
  if (!payload) {
    return { ok: false, status: 401, code: 'token_required' };
  }
  return { ok: true, tutor: payload.tutor || '' };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, code: 'invalid_json' }, { status: 400 });
  }

  const mmsId = `${body.mmsId || ''}`.trim();
  const auth = authorize(`${body.token || ''}`, mmsId);
  if (!auth.ok) {
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }

  try {
    const result = buildSongRequestRow({
      mmsId,
      queryText: body.queryText,
      instrument: body.instrument,
      requestedBy: auth.tutor,
    });
    if (result.error) {
      return NextResponse.json({ success: false, code: result.error }, { status: 400 });
    }

    await appendSongRequestRow(result.row);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Song request write failed:', error.message);
    return NextResponse.json({ success: false, code: 'write_failed' }, { status: 502 });
  }
}
