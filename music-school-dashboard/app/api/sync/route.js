import mmsClient from '@/lib/mms-client';
import db from '@/lib/db';

export async function POST(request) {
  try {
    const { tutor, forceSync = false } = await request.json();
    
    console.log('=== MMS Student Sync Started ===');
    console.log('Tutor:', tutor);
    console.log('Force sync:', forceSync);

    // Check if we have a valid token
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      mmsClient.setToken(token);
    }

    // Fetch students from MMS
    const mmsResult = await mmsClient.getStudents(tutor);
    
    if (!mmsResult.success) {
      console.log('MMS fetch failed:', mmsResult.message);
      return Response.json({ 
        success: false, 
        message: mmsResult.message || 'Failed to fetch from MMS',
        source: 'local'
      });
    }

    console.log(`Found ${mmsResult.students.length} students from MMS`);

    // Update local database with MMS data
    if (mmsResult.students.length > 0) {
      const insertOrUpdateStudent = db.prepare(`
        INSERT OR REPLACE INTO students (
          name, mms_id, soundslice_username, soundslice_course, 
          theta_id, parent_email, current_tutor, instrument, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const transaction = db.transaction((students) => {
        for (const student of students) {
          insertOrUpdateStudent.run(
            student.name,
            student.mms_id,
            student.soundslice_username,
            student.soundslice_course,
            student.theta_id,
            student.parent_email,
            student.current_tutor,
            student.instrument
          );
        }
      });

      transaction(mmsResult.students);
      console.log(`Updated ${mmsResult.students.length} students in local database`);
    }

    return Response.json({
      success: true,
      students: mmsResult.students,
      count: mmsResult.students.length,
      source: 'mms',
      syncedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ 
      success: false, 
      message: error.message,
      source: 'error'
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tutor = searchParams.get('tutor');
    
    // Just return current local data without syncing
    let students;
    if (tutor) {
      students = db.prepare('SELECT * FROM students WHERE current_tutor = ? ORDER BY name').all(tutor);
    } else {
      students = db.prepare('SELECT * FROM students ORDER BY name').all();
    }

    return Response.json({
      success: true,
      students: students,
      count: students.length,
      source: 'local'
    });

  } catch (error) {
    console.error('Get students error:', error);
    return Response.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}
