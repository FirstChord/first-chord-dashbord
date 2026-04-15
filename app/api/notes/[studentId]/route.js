import mmsClient from '@/lib/mms-client-cached';

// BYPASS DATABASE - GET NOTES DIRECTLY FROM MMS
export async function POST(request, { params }) {
  const { studentId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  console.log(`=== Notes API called for student: ${studentId} ===`);
  console.log('Token from URL:', token ? 'Present' : 'Not provided');
  
  try {
    // Get notes directly from MMS
    console.log('Fetching notes from MMS for student:', studentId);
    const notesResult = await mmsClient.getStudentNotes(studentId);
    
    if (notesResult.success) {
      return Response.json({
        success: true,
        notes: notesResult.notes || [],
        count: notesResult.notes ? notesResult.notes.length : 0
      });
    } else {
      return Response.json({
        success: false,
        notes: [],
        count: 0,
        message: notesResult.message || 'Failed to fetch notes'
      });
    }
    
  } catch (error) {
    console.error('Notes API error:', error);
    return Response.json({
      success: false,
      notes: [],
      count: 0,
      message: error.message
    }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  const { studentId } = await params;
  
  console.log(`=== Get Notes API called for student: ${studentId} ===`);
  
  try {
    // Get notes directly from MMS
    const notesResult = await mmsClient.getStudentNotes(studentId);
    
    if (notesResult.success) {
      // Transform the MMS data format to match what NotesPanel expects
      const transformedNotes = {
        lesson_date: notesResult.date,
        notes: notesResult.notes,
        tutor_name: notesResult.tutor,
        attendance: notesResult.attendanceStatus
      };
      
      return Response.json({
        success: true,
        notes: transformedNotes,
        source: 'mms'
      });
    } else {
      return Response.json({
        success: false,
        notes: null,
        message: notesResult.message || 'Failed to fetch notes'
      });
    }
    
  } catch (error) {
    console.error('Get Notes API error:', error);
    return Response.json({
      success: false,
      notes: null,
      message: error.message
    }, { status: 500 });
  }
}
