import mmsClient from '@/lib/mms-client';
import { enhanceStudentsWithSoundslice } from '@/lib/soundslice-mappings';

// BYPASS DATABASE - JUST USE MMS DATA DIRECTLY WITH SOUNDSLICE
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tutor = searchParams.get('tutor');
  
  console.log('=== Students API called ===');
  console.log('Requested tutor:', JSON.stringify(tutor));
  
  try {
    if (tutor) {
      console.log('Fetching students for tutor from MMS:', tutor);
      const mmsResult = await mmsClient.getStudentsForTeacher(tutor);
      
      if (mmsResult.success && mmsResult.students) {
        console.log('Found students from MMS:', mmsResult.students.length);
        // Enhance with Soundslice courses
        const enhancedStudents = enhanceStudentsWithSoundslice(mmsResult.students);
        return Response.json({ students: enhancedStudents });
      } else {
        console.log('MMS fetch failed, returning empty array');
        return Response.json({ students: [] });
      }
    } else {
      // No tutor specified, return empty array
      return Response.json({ students: [] });
    }
  } catch (error) {
    console.error('Students API error:', error);
    return Response.json({ error: error.message, students: [] }, { status: 500 });
  }
}
