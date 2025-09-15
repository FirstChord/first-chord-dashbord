// Student portal helper functions
import { thetaCredentials } from '@/lib/config/theta-credentials';

// Import existing soundslice mappings
import SOUNDSLICE_MAPPINGS from '@/lib/soundslice-mappings';

// Valid student IDs (security) - 11 test students with friendly URLs
const VALID_STUDENT_IDS = [
  'sdt_H6CvJv', // Mathilde thallon (/mathilde)
  'sdt_gwyQJr', // Alex Chang (/alex)
  'sdt_BDHKJs', // Archie Toner (/archie)
  'sdt_K3h1JJ', // Aria Thomson (/aria)
  'sdt_cZDlJQ', // Finlay Cackett (/finlay)
  'sdt_K9psJ9', // Hudson Woodford (/hudson)
  'sdt_K9pNJt', // Joel Adler (/joel)
  'sdt_KKfGJ0', // Leonardo Matassoni (/leonardo)
  'sdt_Kq3RJW', // Pablo Cunningham (/pablo)
  'sdt_BDsRJ9', // Rose Drew (/rose)
  'sdt_LT9sJN', // Sangat Singh (/sangat)
];

export function isValidStudentId(studentId) {
  return VALID_STUDENT_IDS.includes(studentId);
}

export function getStudentInfo(studentId) {
  if (!isValidStudentId(studentId)) {
    return null;
  }

  const thetaCredential = thetaCredentials[studentId];
  const soundsliceUrl = SOUNDSLICE_MAPPINGS[studentId];
  
  return {
    id: studentId,
    name: extractNameFromCredentials(thetaCredential),
    thetaCredentials: thetaCredential ? {
      username: thetaCredential,
      password: thetaCredential
    } : null,
    soundsliceUrl: soundsliceUrl,
    hasTheta: !!thetaCredential,
    hasSoundslice: !!soundsliceUrl
  };
}

function extractNameFromCredentials(credential) {
  if (!credential) return 'Student';
  
  // Extract name from credentials like 'mathildefc' -> 'Mathilde'
  const name = credential.replace('fc', '').replace('firstchord', '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function generateStudentUrl(studentId) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl}/student/${studentId}`;
}

// Get student data including notes (reuses existing API)
export async function getStudentData(studentId) {
  if (!isValidStudentId(studentId)) {
    return null;
  }

  const studentInfo = getStudentInfo(studentId);
  if (!studentInfo) return null;

  try {
    // Use optimized API call with caching for student portals
    const mmsClient = (await import('@/lib/mms-client-cached')).default;
    const notesResult = await mmsClient.getStudentNotes(studentId, { studentPortal: true });
    
    if (notesResult.success) {
      // Transform the MMS data format to match what StudentNotes expects
      const transformedNotes = {
        lesson_date: notesResult.date,
        notes: notesResult.notes,
        tutor_name: notesResult.tutor,
        attendance: notesResult.attendanceStatus
      };
      
      return {
        ...studentInfo,
        notes: transformedNotes,
        notesSuccess: true,
        notesSource: 'mms-direct'
      };
    } else {
      // Return student info without notes if API fails
      return {
        ...studentInfo,
        notes: null,
        notesSuccess: false,
        notesSource: 'unavailable'
      };
    }
  } catch (error) {
    console.error('Error fetching student data:', error);
    return {
      ...studentInfo,
      notes: null,
      notesSuccess: false,
      notesSource: 'error'
    };
  }
}