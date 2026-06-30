import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTutorTeacherIdMap,
  filterTutorStudentsBySearch,
  getTutorDashboardOptionNames,
  getTutorDashboardOptions,
  resolveTutorTeacherId,
} from '../../lib/tutor-dashboard-helpers.mjs';

const SAMPLE_TUTORS = {
  'Eléna': {
    fullName: 'Eléna Esposito',
    teacherId: 'tch_elena',
    instruments: ['piano'],
  },
  'Calum': {
    fullName: 'Calum Steel',
    teacherId: 'tch_calum',
    instruments: ['guitar'],
  },
};

test('getTutorDashboardOptions exposes stable short-name tutor options', () => {
  const options = getTutorDashboardOptions(SAMPLE_TUTORS);

  assert.deepEqual(options, [
    {
      shortName: 'Eléna',
      fullName: 'Eléna Esposito',
      teacherId: 'tch_elena',
      instruments: ['piano'],
    },
    {
      shortName: 'Calum',
      fullName: 'Calum Steel',
      teacherId: 'tch_calum',
      instruments: ['guitar'],
    },
  ]);
  assert.deepEqual(getTutorDashboardOptionNames(SAMPLE_TUTORS), ['Eléna', 'Calum']);
});

test('resolveTutorTeacherId handles short names, full names, lowercase, and accents', () => {
  const map = buildTutorTeacherIdMap(SAMPLE_TUTORS);

  assert.equal(map['Eléna'], 'tch_elena');
  assert.equal(map['Eléna Esposito'], 'tch_elena');
  assert.equal(resolveTutorTeacherId('Eléna', SAMPLE_TUTORS), 'tch_elena');
  assert.equal(resolveTutorTeacherId('Eléna Esposito', SAMPLE_TUTORS), 'tch_elena');
  assert.equal(resolveTutorTeacherId('elena', SAMPLE_TUTORS), 'tch_elena');
  assert.equal(resolveTutorTeacherId('calum steel', SAMPLE_TUTORS), 'tch_calum');
  assert.equal(resolveTutorTeacherId('Unknown', SAMPLE_TUTORS), '');
});

test('filterTutorStudentsBySearch matches names and instruments without mutating empty searches', () => {
  const students = [
    {
      name: 'Alex Chang',
      instrument: 'Guitar',
    },
    {
      name: 'Sian Malyin',
      instrument: 'Singing',
    },
  ];

  assert.equal(filterTutorStudentsBySearch(students, ''), students);
  assert.deepEqual(filterTutorStudentsBySearch(students, 'alex'), [students[0]]);
  assert.deepEqual(filterTutorStudentsBySearch(students, 'sing'), [students[1]]);
});
