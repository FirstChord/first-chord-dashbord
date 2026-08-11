import mmsClient from '@/lib/mms-client-cached';
import { getPracticeNoteLogRows } from '@/lib/admin/sheets';
import { selectLatestPortalPracticeNote } from '@/lib/admin/practice-notes-helpers.mjs';
import { buildPracticeSummary } from '@/lib/admin/practice-summary-helpers.mjs';
import { authorizeNotesRequest, authorizeTutorSession } from '@/lib/admin/notes-route-auth.mjs';

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
  const tutorSession = await authorizeTutorSession(auth.tutor);
  if (!tutorSession.ok) {
    return Response.json(tutorSession.body, { status: tutorSession.status });
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
  const tutorSession = await authorizeTutorSession(auth.tutor);
  if (!tutorSession.ok) {
    return Response.json(tutorSession.body, { status: tutorSession.status });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('summary')) {
    // Deterministic practice summary — built only from the owned
    // Practice_Notes_Log path so the timeline engine gets normalised rows,
    // never MMS-shaped notes.
    try {
      const rows = await getPracticeNoteLogRows(studentId);
      const summary = buildPracticeSummary(rows);
      return Response.json({ success: true, summary });
    } catch (error) {
      console.error('Notes summary API error:', error);
      return Response.json({ success: false, summary: null, message: error.message }, { status: 500 });
    }
  }

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
