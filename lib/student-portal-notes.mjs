import mmsClient from '@/lib/mms-client-cached';
import { getPracticeNoteLogRows } from '@/lib/admin/sheets';
import { selectLatestPortalPracticeNote } from '@/lib/admin/practice-notes-helpers.mjs';

async function getFirstChordPortalNote(studentId) {
  try {
    const rows = await getPracticeNoteLogRows(studentId);
    return selectLatestPortalPracticeNote(rows);
  } catch (error) {
    console.warn('First Chord practice note lookup failed; falling back to MMS:', error.message);
    return null;
  }
}

function transformMmsNotes(notesResult = {}) {
  return {
    lesson_date: notesResult.date,
    notes: notesResult.notes,
    tutor_name: notesResult.tutor,
    attendance: notesResult.attendanceStatus,
    source: 'mms',
  };
}

export async function getLatestStudentPortalNote(studentId) {
  try {
    const ownedNote = await getFirstChordPortalNote(studentId);
    if (ownedNote) {
      return { notes: ownedNote, notesSuccess: true, notesSource: 'firstchord' };
    }
    const notesResult = await mmsClient.getStudentNotes(studentId, { studentPortal: true });
    if (notesResult.success) {
      return {
        notes: transformMmsNotes(notesResult),
        notesSuccess: true,
        notesSource: 'mms',
      };
    }
    return { notes: null, notesSuccess: false, notesSource: 'unavailable' };
  } catch (error) {
    console.error('Student portal note fetch failed:', error.message);
    return { notes: null, notesSuccess: false, notesSource: 'error' };
  }
}
