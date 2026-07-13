import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPathsSignal } from '../../lib/songs/paths-signal.mjs';

const CATALOGUE = {
  fc_song_a: { title: 'A', instruments: ['Guitar'], level: 'Debut' },
  fc_song_b: { title: 'B', instruments: ['Piano'], level: 'Debut' },
};

const STUDENTS = [
  { mmsId: 'sdt_g1', firstName: 'Gia', tutor: 'Finn', instrument: 'Guitar' },
  { mmsId: 'sdt_g2', firstName: 'Gus', tutor: 'Finn', instrument: 'Guitar' },
  { mmsId: 'sdt_p1', firstName: 'Pia', tutor: 'Dean', instrument: 'Piano' },
  { mmsId: 'sdt_d1', firstName: 'Dru', tutor: 'Dean', instrument: 'Drums' }, // no catalogue songs
  { mmsId: 'sdt_t1', firstName: 'Test', tutor: 'Finn', instrument: 'Guitar', isTestStudent: 'true' },
];

test('counts eligible students and groups the gap by tutor', () => {
  const signal = buildPathsSignal({
    students: STUDENTS,
    assignmentRows: [
      { mmsId: 'sdt_g1', status: 'working' },
      { mmsId: 'sdt_p1', status: 'done' }, // done is not active
    ],
    catalogue: CATALOGUE,
  });
  assert.equal(signal.eligibleCount, 3); // drums + test student excluded
  assert.equal(signal.withActiveCount, 1);
  assert.equal(signal.noActiveCount, 2);
  assert.deepEqual(signal.noActiveByTutor, [
    { label: 'Dean', count: 1 },
    { label: 'Finn', count: 1 },
  ]);
});

test('combo instruments and duplicate registry entries are handled', () => {
  const signal = buildPathsSignal({
    students: [
      { mmsId: 'sdt_c1', tutor: 'Finn', instrument: 'Piano / Guitar' },
      { mmsId: 'sdt_c1', tutor: 'Dean', instrument: 'Piano / Guitar' }, // duplicate: last wins
    ],
    assignmentRows: [],
    catalogue: CATALOGUE,
  });
  assert.equal(signal.eligibleCount, 1);
  assert.deepEqual(signal.noActiveByTutor, [{ label: 'Dean', count: 1 }]);
});

test('empty inputs produce a quiet signal', () => {
  const signal = buildPathsSignal({ students: [], assignmentRows: [], catalogue: CATALOGUE });
  assert.equal(signal.eligibleCount, 0);
  assert.equal(signal.noActiveCount, 0);
  assert.deepEqual(signal.noActiveByTutor, []);
});
