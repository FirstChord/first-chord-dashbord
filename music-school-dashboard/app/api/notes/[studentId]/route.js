import { getStudentByMmsId, upsertLessonNote, getLatestLessonNote } from '@/lib/db';
import mmsClient from '@/lib/mms-client';

export async function GET(request, { params }) {
  const { studentId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  console.log(`=== Notes API called for student: ${studentId} ===`);
  console.log('Token from URL:', token ? 'Present' : 'Not provided');
  
  try {
    // Get student info from database
    const student = await getStudentByMmsId(studentId);
    
    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    // Set token if provided
    if (token) {
      console.log('Setting token in MMS client');
      mmsClient.setToken(token);
    }

    console.log('Attempting to fetch from MMS API...');
    // Try to get fresh notes from MMS API
    const mmsNotes = await mmsClient.getStudentNotes(studentId);
    console.log('MMS API result:', mmsNotes.success ? 'Success' : 'Failed');
    
    if (mmsNotes.success) {
      console.log('Got fresh notes from MMS!');
      // Cache the successful fetch
      if (mmsNotes.notes && mmsNotes.notes !== 'Student was absent from the last lesson') {
        await upsertLessonNote(
          student.id,
          mmsNotes.date,
          mmsNotes.notes,
          mmsNotes.tutor
        );
      }

      return Response.json({ 
        student,
        lastNotes: {
          notes: mmsNotes.notes,
          lesson_date: mmsNotes.date,
          tutor_name: mmsNotes.tutor,
          attendance: mmsNotes.attendanceStatus,
          source: 'live'
        }
      });
    }

    console.log('Falling back to cached notes');
    // Fallback to cached notes
    const cachedNotes = await getLatestLessonNote(student.id);
    
    return Response.json({ 
      student,
      lastNotes: cachedNotes,
      source: 'cache',
      fallbackUrl: mmsNotes.fallbackUrl
    });
    
  } catch (error) {
    console.error('Error fetching notes:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
