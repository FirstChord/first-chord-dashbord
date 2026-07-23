import { getStudentPortalAccessRow } from '@/lib/admin/sheets';
import {
  assertStudentNotesSecretConfigured,
  studentNotesCookieName,
  verifyStudentNotesSession,
} from '@/lib/admin/student-notes-access-crypto.mjs';
import { isValidStudentId } from '@/lib/student-helpers';
import { getLatestStudentPortalNote } from '@/lib/student-portal-notes.mjs';

const NO_STORE_HEADERS = { 'Cache-Control': 'private, no-store' };

export async function GET(request, { params }) {
  const { studentId } = await params;
  if (!isValidStudentId(studentId)) {
    return Response.json({ status: 'not_found' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  let access;
  try {
    access = await getStudentPortalAccessRow(studentId, {
      requireConfigured: true,
      forceRefresh: true,
    });
  } catch {
    return Response.json({
      status: 'unavailable',
      message: 'Notes are temporarily unavailable. Please try again shortly.',
    }, { status: 503, headers: NO_STORE_HEADERS });
  }

  if (access?.protectionEnabled) {
    try {
      assertStudentNotesSecretConfigured();
    } catch {
      return Response.json({
        status: 'unavailable',
        message: 'Notes are temporarily unavailable. Please try again shortly.',
      }, { status: 503, headers: NO_STORE_HEADERS });
    }
    const token = request.cookies.get(studentNotesCookieName(studentId))?.value || '';
    const valid = verifyStudentNotesSession(token, {
      studentMmsId: studentId,
      credentialVersion: access.credentialVersion,
    });
    if (!valid) {
      return Response.json({
        status: 'locked',
        protectionEnabled: true,
      }, { status: 401, headers: NO_STORE_HEADERS });
    }
  }

  const note = await getLatestStudentPortalNote(studentId);
  return Response.json({
    status: 'available',
    protectionEnabled: Boolean(access?.protectionEnabled),
    ...note,
  }, { headers: NO_STORE_HEADERS });
}
