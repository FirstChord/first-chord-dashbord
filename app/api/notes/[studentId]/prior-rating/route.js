/** @fileoverview Evaluation-only endpoint recording whether last week's practice note was useful, resolving the unrated session server-side so a double-tap is harmless. */
import { authorizeNotesRequest, authorizeTutorSession } from '@/lib/admin/notes-route-auth.mjs';
import { getPracticeChatSessionRows, upsertPracticeChatSessionRow } from '@/lib/admin/sheets';
import { selectSessionForPriorRating } from '@/lib/admin/practice-chat-session-helpers.mjs';

/**
 * "Was last week's note useful?", answered on the tutor dashboard at the next
 * lesson.
 *
 * The dashboard never learns the id of the session that produced that note, so
 * the server resolves it: the student's most recent finished session that made
 * a note and has not been rated yet. That also makes a double-tap harmless —
 * the second request finds nothing to rate rather than walking backwards
 * through the student's history.
 *
 * Evaluation-only. It writes one field on one telemetry row and touches no
 * workflow, no provider and no parent-visible record.
 */
export async function POST(request, { params }) {
  const { studentId } = await params;
  const auth = authorizeNotesRequest(request, studentId);
  if (!auth.ok) {
    return Response.json(auth.body, { status: auth.status });
  }
  const tutorSession = await authorizeTutorSession(auth.tutor);
  if (!tutorSession.ok) {
    return Response.json(tutorSession.body, { status: tutorSession.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const skipped = Boolean(body?.skipped);
    const rating = Number(body?.rating);

    if (!skipped && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return Response.json({ success: false, message: 'rating must be 1-5' }, { status: 400 });
    }

    const sessions = await getPracticeChatSessionRows({ studentMmsId: studentId });
    const target = selectSessionForPriorRating(sessions, studentId);

    if (!target) {
      // Nothing to attach the answer to — no note yet, or it is already rated.
      // Not an error: the tutor did nothing wrong and must see nothing.
      return Response.json({ success: true, recorded: false });
    }

    // A skip is recorded by leaving the rating blank and stamping the time, so
    // response rate stays measurable. Read-modify-write of the whole row: a
    // partial write could not tell "this write says nothing about that column"
    // from "clear it", and would blank the session's measurements.
    await upsertPracticeChatSessionRow({
      ...target,
      priorUsefulness: skipped ? '' : rating,
      priorUsefulnessAt: new Date().toISOString(),
    });

    return Response.json({ success: true, recorded: true });
  } catch (error) {
    console.error('Prior-rating save failed:', error);
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}
