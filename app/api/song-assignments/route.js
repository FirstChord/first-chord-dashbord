import { NextResponse } from 'next/server';
import { getSongAssignmentRows, upsertSongAssignmentRow } from '@/lib/admin/sheets';
import { buildAssignmentUpsert } from '@/lib/songs/assignment-helpers.mjs';
import { getTutorSurfaceTokenSecret, verifyStudentNotesToken } from '@/lib/tutor-surface-token.mjs';

// The per-student token minted for the tutor dashboard (same one that guards
// /api/notes/[studentId]) is the identity here: it proves the caller got this
// student from the tutor surface, and its payload names the tutor.
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const studentId = `${searchParams.get('student') || ''}`.trim();
  const auth = authorize(searchParams.get('token') || '', studentId);
  if (!auth.ok) {
    return NextResponse.json({ success: false, code: auth.code }, { status: auth.status });
  }

  try {
    const assignments = await getSongAssignmentRows(studentId);
    return NextResponse.json({ success: true, assignments });
  } catch (error) {
    console.error('Song assignments read failed:', error.message);
    return NextResponse.json({ success: false, code: 'read_failed' }, { status: 502 });
  }
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
    const result = buildAssignmentUpsert({
      mmsId,
      songId: body.songId,
      assignedBy: auth.tutor,
      existingRows,
    });
    if (result.error) {
      return NextResponse.json({ success: false, code: result.error }, { status: 400 });
    }

    await upsertSongAssignmentRow(result.row);
    return NextResponse.json({ success: true, assignment: result.row, created: result.created });
  } catch (error) {
    console.error('Song assignment write failed:', error.message);
    return NextResponse.json({ success: false, code: 'write_failed' }, { status: 502 });
  }
}
