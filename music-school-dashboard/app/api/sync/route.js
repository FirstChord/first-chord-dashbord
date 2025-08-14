import mmsClient from '@/lib/mms-client';
import { getAllStudents, getStudentsByTutor, upsertStudent } from '@/lib/db';
import Database from 'better-sqlite3';
import path from 'path';

// Initialize database connection for clearing assignments
const dbPath = path.join(process.cwd(), 'data', 'school.db');
const db = new Database(dbPath);

export async function POST(request) {
  try {
    const { tutor, forceSync = false, action, students } = await request.json();
    
    // Handle manual student selection save
    if (action === 'save_selection' && students) {
      console.log('=== Manual Student Selection Save ===');
      console.log('Students to save:', students.length);
      
      for (const student of students) {
        await upsertStudent({
          name: student.name,
          mms_id: student.mms_id,
          soundslice_username: student.soundslice_username || '',
          soundslice_course: student.soundslice_url || student.soundslice_course || null,
          theta_id: student.theta_id || '',
          parent_email: student.parent_email || '',
          current_tutor: student.current_tutor,
          instrument: student.instrument || ''
        });
      }
      
      console.log(`Saved ${students.length} students manually`);
      return Response.json({
        success: true,
        message: `Successfully saved ${students.length} students`,
        count: students.length
      });
    }
    
    console.log('=== MMS Student Sync Started ===');
    console.log('Tutor:', tutor);
    console.log('Force sync:', forceSync);

    // Check if we have a valid token
    const authHeader = request.headers.get('authorization');
    console.log('Auth header present:', authHeader ? 'Yes' : 'No');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      console.log('Token received, length:', token.length);
      mmsClient.setToken(token);
    }

    // Fetch students from MMS using tutor name for automatic teacher ID lookup
    console.log('Calling mmsClient.getStudentsForTeacher with tutor:', tutor);
    const mmsResult = await mmsClient.getStudentsForTeacher(tutor);
    
    console.log('MMS result:', { 
      success: mmsResult.success, 
      message: mmsResult.message, 
      error: mmsResult.error,
      studentsCount: mmsResult.students?.length || 0 
    });
    
    if (!mmsResult.success) {
      console.log('MMS fetch failed:', mmsResult.message || mmsResult.error);
      return Response.json({ 
        success: false, 
        message: mmsResult.message || mmsResult.error || 'Failed to fetch from MMS',
        source: 'local'
      });
    }

    console.log(`Found ${mmsResult.students.length} students for ${tutor} from MMS`);

    // Students are already processed with correct tutor assignment
    const processedStudents = mmsResult.students;

    // Update database with MMS data
    if (processedStudents.length > 0) {
      // First, clear this tutor's assignments to handle students who are no longer assigned
      const clearStmt = db.prepare(`
        UPDATE students 
        SET current_tutor = NULL 
        WHERE current_tutor = ?
      `);
      clearStmt.run(tutor);
      console.log(`Cleared existing assignments for ${tutor}`);

      // Then upsert each student (insert or update while preserving custom Soundslice courses)
      for (const student of processedStudents) {
        await upsertStudent({
          name: student.name,
          mms_id: student.mms_id,
          soundslice_username: student.soundslice_username || '',
          soundslice_course: student.soundslice_course || null, // Will preserve existing if null
          theta_id: student.theta_id || '',
          parent_email: student.parent_email || '',
          current_tutor: student.current_tutor,
          instrument: student.instrument
        });
      }

      console.log(`Updated ${processedStudents.length} students in database`);
      
      // Read back the updated students from database to get preserved soundslice_course values
      const updatedStudentsFromDB = getStudentsByTutor(tutor);
      console.log(`Retrieved ${updatedStudentsFromDB.length} updated students from database`);
      
      return Response.json({
        success: true,
        students: updatedStudentsFromDB,
        count: updatedStudentsFromDB.length,
        source: 'mms',
        filtered: mmsResult.filtered || false, // Pass through the filtered flag from MMS client
        syncedAt: new Date().toISOString()
      });
    } else {
      return Response.json({
        success: true,
        students: [],
        count: 0,
        source: 'mms',
        syncedAt: new Date().toISOString()
      });
    }

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
    
    // Just return current data without syncing
    let students;
    if (tutor) {
      students = getStudentsByTutor(tutor);
    } else {
      students = getAllStudents();
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
