import mmsClient from '@/lib/mms-client-cached';
import { getPracticeNoteLogRows } from '@/lib/admin/sheets';
import { selectLatestPortalPracticeNote } from '@/lib/admin/practice-notes-helpers.mjs';

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
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  console.log(`=== Notes API called for student: ${studentId} ===`);
  console.log('Token from URL:', token ? 'Present' : 'Not provided');
  
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
  
  console.log(`=== Get Notes API called for student: ${studentId} ===`);
  
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
