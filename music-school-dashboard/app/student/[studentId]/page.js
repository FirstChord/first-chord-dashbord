import { getStudentData } from '@/lib/student-helpers';
import StudentDashboard from '@/components/student-portal/StudentDashboard';

export default async function StudentPage({ params }) {
  const resolvedParams = await params;
  const studentId = resolvedParams.studentId;
  
  // Get student data (includes validation and notes)
  const studentData = await getStudentData(studentId);
  
  return <StudentDashboard student={studentData} />;
}

// Generate metadata for the page
export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const studentData = await getStudentData(resolvedParams.studentId);
  
  if (!studentData) {
    return {
      title: 'Student Dashboard - Not Found',
      description: 'Student dashboard not found'
    };
  }
  
  return {
    title: `${studentData.name}'s Music Dashboard`,
    description: `Personal music dashboard for ${studentData.name} - lesson notes, practice links, and more!`
  };
}