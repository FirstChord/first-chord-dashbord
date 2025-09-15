import { getStudentData } from '@/lib/student-helpers';
import { getStudentIdFromUrl, isValidFriendlyName } from '@/lib/student-url-mappings';
import StudentDashboard from '@/components/student-portal/StudentDashboard';
import { notFound } from 'next/navigation';

export default async function RootStudentPage({ params }) {
  const resolvedParams = await params;
  const friendlyName = resolvedParams.studentName;
  
  // Check if this is a valid friendly name
  if (!isValidFriendlyName(friendlyName)) {
    notFound();
  }
  
  // Get student ID from friendly name
  const studentId = getStudentIdFromUrl(friendlyName);
  
  if (!studentId) {
    notFound();
  }
  
  // Get student data (includes validation and notes)
  const studentData = await getStudentData(studentId);
  
  // If student is not found or not authorized, return 404
  if (!studentData) {
    notFound();
  }
  
  return <StudentDashboard student={studentData} />;
}

// Generate metadata for the page
export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const friendlyName = resolvedParams.studentName;
  
  // Check if this is a valid friendly name
  if (!isValidFriendlyName(friendlyName)) {
    return {
      title: 'Student Dashboard - Not Found',
      description: 'Student dashboard not found'
    };
  }
  
  const studentId = getStudentIdFromUrl(friendlyName);
  if (!studentId) {
    return {
      title: 'Student Dashboard - Not Found',
      description: 'Student dashboard not found'
    };
  }
  
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