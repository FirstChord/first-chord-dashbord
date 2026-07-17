import { ADMIN_TUTORS } from './tutors-data.js';
import { normalisePracticeNotesTutorName } from './practice-notes-mms-helpers.mjs';

function clean(value = '') {
  return `${value || ''}`.trim();
}

export function getPracticeNotesEnabledTutors(env = process.env) {
  const configured = clean(env.PRACTICE_NOTES_ENABLED_TUTORS);
  const values = configured ? configured.split(',') : Object.keys(ADMIN_TUTORS);
  return [...new Set(values.map(normalisePracticeNotesTutorName).filter(Boolean))];
}

export function resolvePracticeNotesStudentTutor(student = {}) {
  const assignments = [student?.tutor, student?.registryTutor, student?.currentTutor, student?.teacherName]
    .map(normalisePracticeNotesTutorName)
    .filter(Boolean);
  const uniqueAssignments = [...new Set(assignments)];
  if (!uniqueAssignments.length) return { ok: false, reason: 'missing_student_tutor', assignments: uniqueAssignments };
  if (uniqueAssignments.length > 1) return { ok: false, reason: 'conflicting_student_tutors', assignments: uniqueAssignments };
  return { ok: true, tutor: uniqueAssignments[0], assignments: uniqueAssignments };
}

export function validateSelfAttestedPracticeNotesTutor({ tutor = '', student = {} } = {}) {
  const assigned = resolvePracticeNotesStudentTutor(student);
  const selfAttestedTutor = normalisePracticeNotesTutorName(tutor);
  if (!assigned.ok) return assigned;
  if (!selfAttestedTutor) return { ok: false, reason: 'missing_self_attested_tutor', ...assigned };
  if (selfAttestedTutor !== assigned.tutor) {
    return { ok: false, reason: 'self_attested_tutor_mismatch', selfAttestedTutor, ...assigned };
  }
  return {
    ok: true,
    tutor: assigned.tutor,
    actingTutor: `Self-attested: ${assigned.tutor}`,
    assignments: assigned.assignments,
  };
}
