import db from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tutor = searchParams.get('tutor');
  
  console.log('=== Students API called ===');
  console.log('Requested tutor:', JSON.stringify(tutor));
  
  try {
    let students;
    if (tutor) {
      console.log('Querying for tutor:', tutor);
      students = db.prepare('SELECT * FROM students WHERE current_tutor = ?').all(tutor);
      console.log('Found students:', students.length);
    } else {
      students = db.prepare('SELECT * FROM students').all();
    }
    
    return Response.json({ students });
  } catch (error) {
    console.error('Students API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
