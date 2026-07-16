import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExternalTutorKey,
  deriveTeachingDaysByTeacherId,
  normaliseAvailableDays,
  normaliseCoverBankCallStatus,
  normaliseCoverBankNotice,
  normaliseCoverBankTutorType,
  normaliseCoverBankWilling,
  summariseCoverForDay,
} from '../../lib/admin/cover-bank-helpers.mjs';

test('normaliseCoverBankCallStatus falls back to not_called', () => {
  assert.equal(normaliseCoverBankCallStatus('completed'), 'completed');
  assert.equal(normaliseCoverBankCallStatus(' No_Answer '), 'no_answer');
  assert.equal(normaliseCoverBankCallStatus('nonsense'), 'not_called');
  assert.equal(normaliseCoverBankCallStatus(''), 'not_called');
});

test('normaliseCoverBankWilling is yes/no only — "maybe" carries no information', () => {
  assert.equal(normaliseCoverBankWilling('YES'), 'yes');
  assert.equal(normaliseCoverBankWilling('no'), 'no');
  assert.equal(normaliseCoverBankWilling('maybe'), '');
  assert.equal(normaliseCoverBankWilling('definitely'), '');
});

test('normaliseCoverBankNotice keeps only known notice answers', () => {
  assert.equal(normaliseCoverBankNotice('Same_Day'), 'same_day');
  assert.equal(normaliseCoverBankNotice('needs_notice'), 'needs_notice');
  assert.equal(normaliseCoverBankNotice('whenever'), '');
});

test('normaliseCoverBankTutorType defaults to internal', () => {
  assert.equal(normaliseCoverBankTutorType('external'), 'external');
  assert.equal(normaliseCoverBankTutorType(''), 'internal');
  assert.equal(normaliseCoverBankTutorType('anything'), 'internal');
});

test('normaliseAvailableDays dedupes, drops unknowns, and orders Monday-first', () => {
  assert.deepEqual(
    normaliseAvailableDays(['Friday', 'Monday', 'Friday', 'Funday', '']),
    ['Monday', 'Friday'],
  );
  assert.deepEqual(normaliseAvailableDays([]), []);
});

test('buildExternalTutorKey slugifies names including accents', () => {
  assert.equal(buildExternalTutorKey('Jane Smith'), 'ext:jane-smith');
  assert.equal(buildExternalTutorKey('Eléna Esposito'), 'ext:elena-esposito');
  assert.equal(buildExternalTutorKey('  '), '');
});

test('deriveTeachingDaysByTeacherId collects weekdays from found schedule rows only', () => {
  const teachingDays = deriveTeachingDaysByTeacherId([
    { status: 'found', teacherId: 'tch_1', usualWeekday: 'Monday' },
    { status: 'found', teacherId: 'tch_1', usualWeekday: 'Wednesday' },
    { status: 'found', teacherId: 'tch_1', usualWeekday: 'Monday' },
    { status: 'not_found', teacherId: 'tch_2', usualWeekday: 'Tuesday' },
    { status: 'found', teacherId: 'tch_2', usualWeekday: '' },
  ]);

  assert.deepEqual([...teachingDays.get('tch_1')], ['Monday', 'Wednesday']);
  assert.equal(teachingDays.has('tch_2'), false);
});

test('summariseCoverForDay flags tutors already teaching that day instead of hiding them', () => {
  const records = [
    { tutor: { tutorKey: 'A', teachingDays: [] }, state: { willing: 'yes', availableDays: ['Monday'] } },
    { tutor: { tutorKey: 'B', teachingDays: ['Monday'] }, state: { willing: 'yes', availableDays: ['Monday'] } },
    { tutor: { tutorKey: 'C', teachingDays: [] }, state: { willing: 'no', availableDays: ['Monday'] } },
    { tutor: { tutorKey: 'D', teachingDays: [] }, state: { willing: 'yes', availableDays: ['Tuesday'] } },
    { tutor: { tutorKey: 'E', teachingDays: [] }, state: { willing: '', availableDays: ['Monday'] } },
  ];

  const summary = summariseCoverForDay(records, 'Monday');
  assert.deepEqual(summary.free.map((record) => record.tutor.tutorKey), ['A']);
  assert.deepEqual(summary.alreadyTeaching.map((record) => record.tutor.tutorKey), ['B']);
});
