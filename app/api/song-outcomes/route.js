import { NextResponse } from 'next/server';
import { appendSongOutcomeRow, getSongAssignmentRows } from '@/lib/admin/sheets';
import { buildSongOutcomeRow } from '@/lib/songs/outcome-helpers.mjs';
import { getTutorSurfaceTokenSecret, verifyStudentNotesToken } from '@/lib/tutor-surface-token.mjs';

// The tutor's optional one-tap "how did it go?" when a song reaches done or
// gets parked. Append-only into Song_Outcomes; never touches the assignment.
// Same per-student token identity as /api/song-assignments.
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
    const existingRows = await getSongAssignmentRows(mmsId);
    const result = buildSongOutcomeRow({
      mmsId,
      songId: body.songId,
      outcome: body.outcome,
      note: body.note,
      recordedBy: auth.tutor,
      existingRows,
    });
    if (result.error) {
      return NextResponse.json({ success: false, code: result.error }, { status: 400 });
    }

    await appendSongOutcomeRow(result.row);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Song outcome write failed:', error.message);
    return NextResponse.json({ success: false, code: 'write_failed' }, { status: 502 });
  }
}
