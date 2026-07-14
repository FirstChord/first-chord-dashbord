import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStudentContextCollection,
  normaliseStudentSheetRow,
} from '../../lib/admin/student-context-helpers.mjs';

test('student normalisation accepts canonical and legacy identity headers', () => {
  const student = normaliseStudentSheetRow({
    'MMS Id': 'sdt_alias',
    'First Name': 'Ali',
    Surname: 'Example',
    Phone: '07000 000000',
    'Lesson Length': '45',
  });
  assert.equal(student.mmsId, 'sdt_alias');
  assert.equal(student.firstName, 'Ali');
  assert.equal(student.lastName, 'Example');
  assert.equal(student.fullName, 'Ali Example');
  assert.equal(student.contactNumber, '07000 000000');
  assert.equal(student.lessonLength, '45');
});

test('shared context preserves Sheet-first values, applies registry fallbacks, and exposes conflicts', () => {
  const { students } = buildStudentContextCollection({
    rawSheetRows: [{
      mms_id: 'sdt_context',
      'Student forename': 'Sam',
      'Student Surname': 'Example',
      Instrument: 'Piano',
      'FC Student ID': 'fc_sheet',
      payment_mode: 'stripe',
      payment_expectation: 'stripe_active_expected',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
    }],
    registryEntries: [{
      mmsId: 'sdt_context',
      firstName: 'Sam',
      lastName: 'Example',
      instrument: 'Guitar',
      lessonType: 'sibling_group',
      fcStudentId: 'fc_registry',
      tutor: 'Kenny',
    }],
    flagRows: [{ mms_id: 'sdt_context', category: 'TUTOR CONFLICT', detail: 'Review both sources' }],
    currentDate: '2026-07-14T12:00:00.000Z',
  });

  const student = students[0];
  assert.equal(student.instrument, 'Piano');
  assert.equal(student.lessonType, 'sibling_group');
  assert.equal(student.fcStudentId, 'fc_sheet');
  assert.equal(student.registryTutor, 'Kenny');
  assert.equal(student.hasFlags, true);
  assert.equal(student.provenance.fields.instrument.selectedSource, 'students_sheet');
  assert.equal(student.provenance.fields.lessonType.selectedSource, 'student_registry');
  assert.deepEqual(
    student.provenance.conflicts.map((conflict) => [conflict.field, conflict.severity]),
    [['instrument', 'review'], ['fcStudentId', 'high']],
  );
  assert.equal(student.provenance.fields.paymentMode.selectedSource, 'students_sheet');
});

test('schedule cache provenance reports freshness without changing deterministic value output', () => {
  const { students } = buildStudentContextCollection({
    rawSheetRows: [{
      mms_id: 'sdt_schedule',
      'Student forename': 'Ada',
      'Student Surname': 'Example',
      'Lesson length': '30',
      payment_mode: 'stripe',
      payment_expectation: 'stripe_active_expected',
      stripe_customer_id: 'cus_2',
      stripe_subscription_id: 'sub_2',
    }],
    scheduleRows: [{
      mmsId: 'sdt_schedule',
      studentName: 'Ada Example',
      status: 'found',
      nextLessonAt: '2026-07-16T16:00:00',
      usualWeekday: 'Thursday',
      usualTime: '16:00',
      durationMinutes: '30',
      teacherId: 'teacher_1',
      confidence: 'high',
      checkedAt: '2026-06-01T12:00:00.000Z',
    }],
    currentDate: '2026-07-14T12:00:00.000Z',
  });

  assert.equal(students[0].provenance.sources.scheduleContext.freshness, 'stale');
  assert.equal(students[0].paymentValueContext.baselineWeeklyValue, 25);
});

test('operational context excludes test students and reports duplicate live IDs', () => {
  const rawSheetRows = [
    { mms_id: 'sdt_live', 'Student forename': 'Live', 'Student Surname': 'One' },
    { mms_id: 'sdt_live', 'Student forename': 'Live', 'Student Surname': 'Duplicate' },
    { mms_id: 'sdt_test', 'Student forename': 'Test', 'Student Surname': 'One', is_test_student: 'yes' },
  ];
  const result = buildStudentContextCollection({ rawSheetRows, excludeTestStudents: true });

  assert.deepEqual(result.students.map((student) => student.mmsId), ['sdt_live', 'sdt_live']);
  assert.deepEqual(result.duplicateMmsIds, ['sdt_live']);
  assert.equal(result.testStudentIds.has('sdt_test'), true);
  assert.equal(result.studentByMmsId.get('sdt_live').fullName, 'Live One');
});
