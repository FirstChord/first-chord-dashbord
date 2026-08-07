import { NextResponse } from 'next/server';
import {
  getPracticeNoteLogRows,
  getSongAssignmentRows,
  getSongOutcomeRows,
  prefetchSheetValues,
  PRACTICE_NOTES_LOG_SHEET,
  SONG_ASSIGNMENTS_SHEET,
  SONG_OUTCOMES_SHEET,
} from '@/lib/admin/sheets';
import { getRegistryEntries } from '@/lib/admin/registry';
import { resolveTutorName } from '@/lib/admin/tutor-identity.mjs';
import { buildSongTeachingHistory } from '@/lib/songs/teaching-history.mjs';
import { getTutorSurfaceTokenSecret, verifyStudentNotesToken } from '@/lib/tutor-surface-token.mjs';
import { requireTutorDashboardAccess, tutorAuthErrorBody } from '@/lib/tutor-auth';

// What colleagues know about teaching each song. Guarded by the same
// per-student tutor token as /api/song-assignments: the token proves the caller
// reached this from the tutor surface, even though the answer is about songs
// rather than about that student.
//
// The response is school-wide but deliberately student-free —
// buildSongTeachingHistory reduces every lane to counts and tutor words before
// anything is serialised, so no other student's identity can ride along.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const studentId = `${searchParams.get('student') || ''}`.trim();
  const secret = getTutorSurfaceTokenSecret();
  if (!secret) {
    return NextResponse.json({ success: false, code: 'token_secret_missing' }, { status: 503 });
  }
  const payload = verifyStudentNotesToken(`${searchParams.get('token') || ''}`, {
    studentId,
    secret,
  });
  if (!payload) {
    return NextResponse.json({ success: false, code: 'token_required' }, { status: 401 });
  }
  const tutorSession = await requireTutorDashboardAccess({ requestedTutor: payload.tutor || '' });
  if (!tutorSession.ok) {
    return NextResponse.json(tutorAuthErrorBody(tutorSession), { status: tutorSession.status });
  }

  // Three tabs for one answer, so fetch them as one request rather than three.
  await prefetchSheetValues([
    SONG_ASSIGNMENTS_SHEET,
    SONG_OUTCOMES_SHEET,
    PRACTICE_NOTES_LOG_SHEET,
  ]).catch(() => {});

  // History is enrichment: a lane that fails costs detail, never the panel.
  const [assignmentRows, outcomeRows, practiceNotes, registryEntries] = await Promise.all([
    getSongAssignmentRows('').catch(() => []),
    getSongOutcomeRows().catch(() => []),
    getPracticeNoteLogRows().catch(() => []),
    getRegistryEntries().catch(() => []),
  ]);

  const excludeMmsIds = registryEntries
    .filter((entry) => entry?.isTestStudent === 'true')
    .map((entry) => entry.mmsId)
    .filter(Boolean);

  const history = buildSongTeachingHistory({
    assignmentRows,
    outcomeRows,
    practiceNotes,
    excludeMmsIds,
    // Resolved here rather than inside the builder so the tutor roster stays
    // server-side; the same module's summariser runs in the browser.
    resolveTutorName,
  });

  return NextResponse.json({ success: true, history });
}
