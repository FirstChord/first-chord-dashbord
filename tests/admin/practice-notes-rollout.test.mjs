import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPracticeNotesEnabledTutors,
  resolvePracticeNotesStudentTutor,
  validateSelfAttestedPracticeNotesTutor,
} from '../../lib/admin/practice-notes-rollout.mjs';
import { ADMIN_TUTORS } from '../../lib/admin/tutors-data.js';

test('Practice Chat enables the full registered tutor roster unless a rollout list is configured', () => {
  assert.deepEqual(getPracticeNotesEnabledTutors({}), Object.keys(ADMIN_TUTORS));
  assert.equal(getPracticeNotesEnabledTutors({}).includes('Matthew'), true);
  assert.deepEqual(getPracticeNotesEnabledTutors({ PRACTICE_NOTES_ENABLED_TUTORS: 'Kenny, Eléna Esposito' }), ['Kenny', 'Eléna']);
});

test('trusted tutor confirmation still fails closed for missing or conflicting student assignments', () => {
  assert.deepEqual(resolvePracticeNotesStudentTutor({ tutor: 'Kenny Bates' }), {
    ok: true,
    tutor: 'Kenny',
    assignments: ['Kenny'],
  });
  assert.equal(resolvePracticeNotesStudentTutor({ tutor: 'Kenny', registryTutor: 'Tom' }).reason, 'conflicting_student_tutors');
  assert.equal(validateSelfAttestedPracticeNotesTutor({ tutor: 'Tom', student: { tutor: 'Kenny' } }).reason, 'self_attested_tutor_mismatch');
  assert.equal(validateSelfAttestedPracticeNotesTutor({ tutor: 'Kenny Bates', student: { tutor: 'Kenny' } }).actingTutor, 'Self-attested: Kenny');
});
