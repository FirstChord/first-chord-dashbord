import { getStudentData } from '@/lib/student-helpers';
import { getStudentIdFromUrl } from '@/lib/student-url-mappings';
import StudentDashboard from '@/components/student-portal/StudentDashboard';

export default async function StudentPage({ params }) {
  const resolvedParams = await params;
  const urlParam = resolvedParams.studentId;
  
  // Try to resolve friendly URL to student ID, fallback to original ID
  const studentId = getStudentIdFromUrl(urlParam) || urlParam;
  
  // Get student data (includes validation and notes)
  const studentData = await getStudentData(studentId);
  
  // If student is not found or not authorized, return 404
  if (!studentData) {
    return (
      <div className="min-h-screen bg-gradient-to-t from-green-100 to-blue-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-md text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Student Dashboard Not Found</h1>
          <p className="text-gray-600">This student dashboard is not available or you don't have permission to access it.</p>
        </div>
      </div>
    );
  }
  
  return <StudentDashboard student={studentData} />;
}

// Generate metadata for the page
export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const urlParam = resolvedParams.studentId;
  
  // Try to resolve friendly URL to student ID, fallback to original ID
  const studentId = getStudentIdFromUrl(urlParam) || urlParam;
  const studentData = await getStudentData(studentId);
  
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