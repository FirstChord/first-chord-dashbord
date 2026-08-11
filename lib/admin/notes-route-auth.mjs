/**
 * @fileoverview The two-step guard every per-student notes route applies: a
 * signed per-student token, then the tutor's own dashboard session.
 *
 * Extracted from app/api/notes/[studentId]/route.js when a sibling route needed
 * the same guard. Duplicating it would have been the more common mistake and
 * the worse one — two copies of an auth check drift, and the copy nobody is
 * looking at is the one that keeps the weaker rule.
 */

import { getTutorSurfaceTokenSecret, verifyStudentNotesToken } from '@/lib/tutor-surface-token.mjs';
import { requireTutorDashboardAccess, tutorAuthErrorBody } from '@/lib/tutor-auth';

/**
 * The token must be signed *for this student*, so a valid token for one student
 * cannot read another's notes.
 */
export function authorizeNotesRequest(request, studentId) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  const secret = getTutorSurfaceTokenSecret();

  if (!secret) {
    return {
      ok: false,
      status: 503,
      body: {
        success: false,
        code: 'notes_token_secret_missing',
        message: 'Notes access is not configured',
      },
    };
  }

  const payload = verifyStudentNotesToken(token, { studentId, secret });
  if (!payload) {
    return {
      ok: false,
      status: 401,
      body: {
        success: false,
        code: 'notes_token_required',
        message: 'A valid notes access token is required',
      },
    };
  }

  return { ok: true, tutor: payload.tutor || '' };
}

export async function authorizeTutorSession(tutor) {
  const tutorAuth = await requireTutorDashboardAccess({ requestedTutor: tutor });
  if (!tutorAuth.ok) {
    return {
      ok: false,
      status: tutorAuth.status,
      body: tutorAuthErrorBody(tutorAuth),
    };
  }
  return { ok: true };
}
