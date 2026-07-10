import mmsClient from '@/lib/mms-client-cached';
import { getPracticeNoteLogRows } from '@/lib/admin/sheets';
import { selectLatestPortalPracticeNote } from '@/lib/admin/practice-notes-helpers.mjs';
import { getTutorSurfaceTokenSecret, verifyStudentNotesToken } from '@/lib/tutor-surface-token.mjs';

function authorizeNotesRequest(request, studentId) {
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

  if (!verifyStudentNotesToken(token, { studentId, secret })) {
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

  return { ok: true };
}

async function getFirstChordPortalNote(studentId) {
  try {
    const rows = await getPracticeNoteLogRows(studentId);
    return selectLatestPortalPracticeNote(rows);
  } catch (error) {
    console.warn('First Chord practice note lookup failed; falling back to MMS:', error.message);
    return null;
  }
}

function transformMmsNotes(notesResult = {}) {
  return {
    lesson_date: notesResult.date,
    notes: notesResult.notes,
    tutor_name: notesResult.tutor,
    attendance: notesResult.attendanceStatus,
    source: 'mms',
  };
}

function notesResponse({ notes, source }) {
  return {
    success: Boolean(notes),
    notes,
    lastNotes: notes,
    count: notes ? 1 : 0,
    source,
  };
}

export async function POST(request, { params }) {
  const { studentId } = await params;
  const auth = authorizeNotesRequest(request, studentId);
  if (!auth.ok) {
    return Response.json(auth.body, { status: auth.status });
  }
  
  try {
    const ownedNote = await getFirstChordPortalNote(studentId);
    if (ownedNote) {
      return Response.json(notesResponse({ notes: ownedNote, source: 'firstchord' }));
    }

    console.log('Fetching notes from MMS fallback for student:', studentId);
    const notesResult = await mmsClient.getStudentNotes(studentId);
    
    if (notesResult.success) {
      return Response.json(notesResponse({
        notes: transformMmsNotes(notesResult),
        source: 'mms',
      }));
    } else {
      return Response.json({
        success: false,
        notes: [],
        lastNotes: null,
        count: 0,
        source: 'unavailable',
        message: notesResult.message || 'Failed to fetch notes'
      });
    }
    
  } catch (error) {
    console.error('Notes API error:', error);
    return Response.json({
      success: false,
      notes: [],
      lastNotes: null,
      count: 0,
      source: 'error',
      message: error.message
    }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  const { studentId } = await params;
  const auth = authorizeNotesRequest(request, studentId);
  if (!auth.ok) {
    return Response.json(auth.body, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('history')) {
    try {
      const result = await mmsClient.getStudentLessonHistory(studentId, 12);
      const history = (result.lessons || [])
        .filter((lesson) => lesson.notes && lesson.notes.trim() !== '')
        .slice(0, 5)
        .map((lesson) => ({
          lesson_date: lesson.date,
          notes: lesson.notes,
          tutor_name: lesson.tutor,
          attendance: lesson.status,
        }));
      return Response.json({ success: Boolean(result.success), history });
    } catch (error) {
      console.error('Notes history API error:', error);
      return Response.json({ success: false, history: [], message: error.message }, { status: 500 });
    }
  }

  try {
    const ownedNote = await getFirstChordPortalNote(studentId);
    if (ownedNote) {
      return Response.json(notesResponse({ notes: ownedNote, source: 'firstchord' }));
    }

    const notesResult = await mmsClient.getStudentNotes(studentId);
    
    if (notesResult.success) {
      return Response.json(notesResponse({
        notes: transformMmsNotes(notesResult),
        source: 'mms',
      }));
    } else {
      return Response.json({
        success: false,
        notes: null,
        lastNotes: null,
        source: 'unavailable',
        message: notesResult.message || 'Failed to fetch notes'
      });
    }
    
  } catch (error) {
    console.error('Get Notes API error:', error);
    return Response.json({
      success: false,
      notes: null,
      lastNotes: null,
      source: 'error',
      message: error.message
    }, { status: 500 });
  }
}
