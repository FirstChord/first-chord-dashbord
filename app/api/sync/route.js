import mmsClient from '@/lib/mms-client-cached';
import { enhanceStudentsWithSoundslice } from '@/lib/soundslice-mappings';

// BYPASS DATABASE - JUST USE MMS DATA DIRECTLY WITH HARDCODED SOUNDSLICE
export async function POST(request) {
  try {
    const { tutor, forceSync = false } = await request.json();
    
    console.log('=== MMS Student Sync Started ===');
    console.log('Tutor:', tutor);
    console.log('Force sync:', forceSync);
    
    // Get students directly from MMS (no database involved)
    console.log('Calling mmsClient.getStudentsForTeacher with tutor:', tutor);
    const mmsResult = await mmsClient.getStudentsForTeacher(tutor);
    
    console.log('MMS result:', JSON.stringify({
      success: mmsResult.success,
      message: mmsResult.message || 'No message',
      error: mmsResult.error,
      studentsCount: mmsResult.students ? mmsResult.students.length : 0
    }));
    
    if (mmsResult.success && mmsResult.students) {
      // Enhance MMS data with hardcoded Soundslice courses
      const enhancedStudents = enhanceStudentsWithSoundslice(mmsResult.students);
      console.log('Enhanced students with Soundslice courses');
      
      // Return enhanced data directly - no database saving
      return Response.json({
        success: true,
        students: enhancedStudents,
        count: enhancedStudents.length,
        source: 'mms',
        message: `Successfully fetched ${enhancedStudents.length} students from MMS with Soundslice courses`
      });
    } else {
      console.log('MMS fetch failed:', mmsResult.message);
      // Return empty array instead of trying database fallback
      return Response.json({
        success: false,
        students: [],
        count: 0,
        source: 'error',
        message: mmsResult.message || 'Failed to fetch from MMS'
      });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    return Response.json({
      success: false,
      students: [],
      count: 0,
      source: 'error',
      message: error.message
    }, { status: 500 });
  }
}
