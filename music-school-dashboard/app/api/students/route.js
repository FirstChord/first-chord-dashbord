import { getAllStudents, getStudentsByTutor } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tutor = searchParams.get('tutor');
  
  console.log('=== Students API called ===');
  console.log('Requested tutor:', JSON.stringify(tutor));
  
  try {
    let students;
    if (tutor) {
      console.log('Querying for tutor:', tutor);
      students = await getStudentsByTutor(tutor);
      console.log('Found students:', students.length);
    } else {
      students = await getAllStudents();
    }
    
    return Response.json({ students });
  } catch (error) {
    console.error('Students API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
