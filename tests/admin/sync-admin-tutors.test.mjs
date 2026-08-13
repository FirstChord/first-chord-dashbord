import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildOutput, validateTutors } = require('../../scripts/sync-admin-tutors.js');

const SAMPLE_TUTORS = [
  {
    short_name: 'Hamish',
    full_name: 'Hamish Roberts',
    mms_teacher_id: 'tch_zLnnJw',
    instruments: ['guitar'],
  },
];

test('validateTutors accepts a complete canonical tutor identity', () => {
  assert.equal(validateTutors(SAMPLE_TUTORS), SAMPLE_TUTORS);
});

test('validateTutors rejects duplicate names and MMS teacher IDs', () => {
  assert.throws(
    () => validateTutors([...SAMPLE_TUTORS, { ...SAMPLE_TUTORS[0] }]),
    /Duplicate tutor short name/,
  );
  assert.throws(
    () => validateTutors([
      ...SAMPLE_TUTORS,
      { ...SAMPLE_TUTORS[0], short_name: 'Other', full_name: 'Other Tutor' },
    ]),
    /Duplicate MMS teacher ID/,
  );
});

test('validateTutors rejects incomplete identities before generating dashboard code', () => {
  assert.throws(
    () => validateTutors([{ ...SAMPLE_TUTORS[0], mms_teacher_id: 'bad-id' }]),
    /invalid MMS teacher ID/,
  );
  assert.throws(
    () => validateTutors([{ ...SAMPLE_TUTORS[0], instruments: [] }]),
    /at least one instrument/,
  );
});

test('buildOutput identifies its canonical source and safely quotes names', () => {
  const output = buildOutput([
    { ...SAMPLE_TUTORS[0], short_name: "O'Neil", full_name: "O'Neil Tutor" },
  ]);

  assert.match(output, /Source: \.\.\/first-chord-brain\/tutors\.py TUTORS list/u);
  assert.match(output, /'O\\'Neil'/u);
});
