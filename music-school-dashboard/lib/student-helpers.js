// Student portal helper functions
import { thetaCredentials } from '@/lib/config/theta-credentials';

// Import existing soundslice mappings
import SOUNDSLICE_MAPPINGS from '@/lib/soundslice-mappings';

// Valid student IDs (security) - All students with friendly URLs
const VALID_STUDENT_IDS = [
  // Original test batch
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
  
  // All students from URL mappings
  'sdt_QnkRJT', 'sdt_BMt3JD', 'sdt_3ZZwJ2', 'sdt_KwbvJG', 'sdt_HWVBJL', 'sdt_NSmFJh', 'sdt_QpGPJv', 'sdt_L5tgJX',
  'sdt_Mg2kJz', 'sdt_Kwb2J0', 'sdt_cZ39Jz', 'sdt_yR33J4', 'sdt_QSzJJ2', 'sdt_Hf36Jh', 'sdt_w6TSJX', 'sdt_BDHFJM',
  'sdt_M3RnJG', 'sdt_NSmPJr', 'sdt_H5ysJM', 'sdt_czFfJy', 'sdt_BpDPJZ', 'sdt_Qcm1JR', 'sdt_QjMGJc', 'sdt_BtxmJ4',
  'sdt_QbBNJq', 'sdt_KwbMJR', 'sdt_vGjtJ7', 'sdt_60gYJ7', 'sdt_BDH9J3', 'sdt_H5yHJQ', 'sdt_2s8CJk', 'sdt_417JJ3',
  'sdt_cqlKJm', 'sdt_csfBJd', 'sdt_39hsJY', 'sdt_6FRsJF', 'sdt_BDHJJF', 'sdt_FXKDJS', 'sdt_yHtZJ8', 'sdt_BDHTJN',
  'sdt_L5l5JD', 'sdt_gpFVJS', 'sdt_3nKZJB', 'sdt_ySKCJy', 'sdt_QfWBJx', 'sdt_Kv59Jb', 'sdt_v9m8JT', 'sdt_ybcdJ7',
  'sdt_NdzdJM', 'sdt_3TTwJV', 'sdt_c7hKJ8', 'sdt_c8fFJ3', 'sdt_NXNKJJ', 'sdt_MdD4JB', 'sdt_B4zSJc', 'sdt_vrbPJL',
  'sdt_LqT2J4', 'sdt_ckzHJS', 'sdt_HrdXJK', 'sdt_6nhSJM', 'sdt_2sjZJs', 'sdt_slc4Jq', 'sdt_cfbyJQ', 'sdt_6ZrzJq',
  'sdt_yXFSJf', 'sdt_yFzkJ6', 'sdt_wwqLJ2', 'sdt_c8NbJl', 'sdt_cz6ZJz', 'sdt_cYDxJM', 'sdt_6llSJ8', 'sdt_QKcMJS',
  'sdt_2slYJ7', 'sdt_N0zrJ8', 'sdt_vcJPJj', 'sdt_Kv5QJh', 'sdt_DfTRJT', 'sdt_Q39JJ9', 'sdt_Kq3XJP', 'sdt_6yvpJb',
  'sdt_F3FHJs', 'sdt_svMqJy', 'sdt_gDcVJp', 'sdt_BMtHJs', 'sdt_HbXMJZ', 'sdt_QcCtJT', 'sdt_38MBJF', 'sdt_c794J5',
  'sdt_6n94J7', 'sdt_v1lcJ0', 'sdt_HVbNJk', 'sdt_N8lVJ1', 'sdt_2lJMJl', 'sdt_QPqsJC', 'sdt_gWXHJN', 'sdt_QNVYJ4',
  'sdt_vgjdJv', 'sdt_6Zd7J3', 'sdt_cYvdJp', 'sdt_yLvlJx', 'sdt_cGPBJ3', 'sdt_6RJkJp', 'sdt_Fq8vJj', 'sdt_ccgQJ8',
  'sdt_Q2ntJX', 'sdt_K9pMJg', 'sdt_BlyZJD', 'sdt_2lJyJj', 'sdt_MhHLJ0', 'sdt_BkflJy', 'sdt_yXFnJm', 'sdt_D9rnJT',
  'sdt_s2JpJx', 'sdt_Kq2TJR', 'sdt_pFYFJT', 'sdt_DdxtJZ', 'sdt_w6TBJ3', 'sdt_6PjKJF', 'sdt_2grxJL', 'sdt_D9ftJB',
  'sdt_yLv3J7', 'sdt_vHS3JK', 'sdt_Kv5XJL', 'sdt_cqlvJb', 'sdt_cfGhJh', 'sdt_pGqXJ9', 'sdt_KKfZJC', 'sdt_pT5MJz',
  'sdt_vLG0JL', 'sdt_HlXyJl', 'sdt_MPMWJy', 'sdt_x48LJT', 'sdt_Nt4LJ3', 'sdt_sfbtJ5', 'sdt_DdZxJQ', 'sdt_cJDjJj',
  'sdt_NS6bJW', 'sdt_BDsMJk', 'sdt_BDHdJ4', 'sdt_c44QJk', 'sdt_N0z0Jq', 'sdt_cB0YJd', 'sdt_w6T7Jd', 'sdt_yhJTJ0',
  'sdt_Fq8ZJ1', 'sdt_QP01Jp', 'sdt_NxMZJz', 'sdt_NSmyJ3', 'sdt_y0SPJJ'
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