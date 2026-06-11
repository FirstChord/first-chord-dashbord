import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTestStudentIdSet,
  filterOperationalStudents,
  isTestStudentRecord,
  normaliseTestStudentFlag,
} from '../../lib/admin/test-student-helpers.mjs';

test('normaliseTestStudentFlag accepts explicit truthy admin values only', () => {
  assert.equal(normaliseTestStudentFlag(true), true);
  assert.equal(normaliseTestStudentFlag('true'), true);
  assert.equal(normaliseTestStudentFlag('yes'), true);
  assert.equal(normaliseTestStudentFlag('1'), true);
  assert.equal(normaliseTestStudentFlag('test'), true);
  assert.equal(normaliseTestStudentFlag('false'), false);
  assert.equal(normaliseTestStudentFlag(''), false);
  assert.equal(normaliseTestStudentFlag(null), false);
});

test('isTestStudentRecord reads sheet and registry flag locations', () => {
  assert.equal(isTestStudentRecord({ isTestStudent: 'true' }), true);
  assert.equal(isTestStudentRecord({ raw: { is_test_student: 'yes' } }), true);
  assert.equal(isTestStudentRecord({ registry: { isTestStudent: '1' } }), true);
  assert.equal(isTestStudentRecord({ registryEntry: { test_student: 'test' } }), true);
  assert.equal(isTestStudentRecord({ fullName: 'Test Studenty' }), false);
});

test('buildTestStudentIdSet combines sheet and registry flags by MMS ID', () => {
  const ids = buildTestStudentIdSet(
    [
      { mmsId: 'sdt_sheet', raw: { is_test_student: 'true' } },
      { mmsId: 'sdt_registry' },
      { mmsId: 'sdt_real', fullName: 'Real Student' },
    ],
    [
      { mmsId: 'sdt_registry', isTestStudent: 'true' },
      { mmsId: 'sdt_other', isTestStudent: '' },
    ],
  );

  assert.deepEqual([...ids].sort(), ['sdt_registry', 'sdt_sheet']);
});

test('filterOperationalStudents removes explicitly flagged test students', () => {
  const students = [
    { mmsId: 'sdt_test', isTestStudent: 'true' },
    { mmsId: 'sdt_real', fullName: 'Test-like name but no flag' },
  ];

  assert.deepEqual(filterOperationalStudents(students), [
    { mmsId: 'sdt_real', fullName: 'Test-like name but no flag' },
  ]);
});
