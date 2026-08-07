import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSongTeachingHistory,
  summariseTeachingHistory,
} from '../../lib/songs/teaching-history.mjs';

const assignment = (overrides = {}) => ({
  songId: 'fc_song_crazy',
  mmsId: 'sdt_a',
  assignedBy: 'Tom',
  assignedAt: '2026-07-01T10:00:00.000Z',
  status: 'assigned',
  ...overrides,
});

const outcome = (overrides = {}) => ({
  songId: 'fc_song_crazy',
  mmsId: 'sdt_a',
  recordedBy: 'Tom',
  recordedAt: '2026-07-27T10:00:00.000Z',
  atStatus: 'done',
  outcome: 'about_right',
  note: 'Big finger stretch between frets',
  ...overrides,
});

test('gathers tutors and a student count for a song', () => {
  const history = buildSongTeachingHistory({
    assignmentRows: [
      assignment(),
      assignment({ mmsId: 'sdt_b' }),
      assignment({ mmsId: 'sdt_c', assignedBy: 'Fennella' }),
    ],
  });

  const entry = history.fc_song_crazy;
  assert.equal(entry.studentCount, 3);
  assert.deepEqual(entry.tutors, [
    { name: 'Tom', students: 2 },
    { name: 'Fennella', students: 1 },
  ]);
});

test('no student identity survives the build', () => {
  const history = buildSongTeachingHistory({
    assignmentRows: [assignment({ mmsId: 'sdt_secret' })],
    outcomeRows: [outcome({ mmsId: 'sdt_secret' })],
    practiceNotes: [
      { songIds: ['fc_song_crazy'], studentMmsId: 'sdt_secret', tutorName: 'Tom', lessonDate: '2026-08-01' },
    ],
  });

  const serialised = JSON.stringify(history);
  assert.equal(serialised.includes('sdt_secret'), false);
  assert.equal(serialised.includes('mmsId'), false);
});

test('keeps the tutor note and counts the outcome', () => {
  const history = buildSongTeachingHistory({ outcomeRows: [outcome()] });
  const entry = history.fc_song_crazy;

  assert.equal(entry.outcomes.length, 1);
  assert.equal(entry.outcomes[0].note, 'Big finger stretch between frets');
  assert.equal(entry.outcomes[0].tutor, 'Tom');
  assert.equal(entry.outcomeCounts.about_right, 1);
});

test('an outcome chip with no note is counted but not quoted back', () => {
  const history = buildSongTeachingHistory({
    outcomeRows: [outcome({ note: '', outcome: 'cruised' })],
  });

  assert.equal(history.fc_song_crazy.outcomes.length, 0);
  assert.equal(history.fc_song_crazy.outcomeCounts.cruised, 1);
});

test('outcome notes come back newest first and are capped', () => {
  const history = buildSongTeachingHistory({
    outcomeRows: [
      outcome({ note: 'oldest', recordedAt: '2026-01-01T00:00:00.000Z' }),
      outcome({ note: 'newest', recordedAt: '2026-09-01T00:00:00.000Z' }),
      outcome({ note: 'middle', recordedAt: '2026-05-01T00:00:00.000Z' }),
    ],
    maxOutcomes: 2,
  });

  assert.deepEqual(
    history.fc_song_crazy.outcomes.map((entry) => entry.note),
    ['newest', 'middle'],
  );
});

test('test students are excluded from every lane', () => {
  const history = buildSongTeachingHistory({
    assignmentRows: [assignment({ mmsId: 'sdt_test' }), assignment({ mmsId: 'sdt_real' })],
    outcomeRows: [outcome({ mmsId: 'sdt_test', note: 'from the test student' })],
    practiceNotes: [
      { songIds: ['fc_song_crazy'], studentMmsId: 'sdt_test', tutorName: 'Finn' },
    ],
    excludeMmsIds: ['sdt_test'],
  });

  const entry = history.fc_song_crazy;
  assert.equal(entry.studentCount, 1);
  assert.equal(entry.outcomes.length, 0);
  assert.equal(entry.noteMentions, 0);
});

test('a practice-note song link is teaching evidence on its own', () => {
  const history = buildSongTeachingHistory({
    practiceNotes: [
      {
        songIds: ['fc_song_everybody_dance'],
        studentMmsId: 'sdt_a',
        tutorName: 'Tom Walters',
        lessonDate: '2026-08-04',
      },
    ],
  });

  const entry = history.fc_song_everybody_dance;
  assert.equal(entry.noteMentions, 1);
  assert.equal(entry.studentCount, 1);
  assert.deepEqual(entry.tutors, [{ name: 'Tom Walters', students: 1 }]);
  assert.equal(entry.lastTaughtAt, '2026-08-04');
});

test('a tutor with no identifiable student still counts as having taught it', () => {
  const history = buildSongTeachingHistory({
    assignmentRows: [assignment({ mmsId: '' })],
  });

  assert.deepEqual(history.fc_song_crazy.tutors, [{ name: 'Tom', students: 0 }]);
  assert.equal(history.fc_song_crazy.studentCount, 0);
});

test('songs nobody has taught are absent, not empty', () => {
  const history = buildSongTeachingHistory({ assignmentRows: [assignment()] });
  assert.equal(history.fc_song_never_taught, undefined);
});

test('one tutor is one tutor, however their name reached the row', () => {
  // A real defect: the note-to-shelf sync wrote `acting_tutor` — a display
  // label, "Self-attested: Calum" — into assigned_by, so Calum appeared twice
  // on the same song as two different people. The sync strips the prefix now;
  // this pins the consequence rather than the mechanism.
  const history = buildSongTeachingHistory({
    assignmentRows: [
      assignment({ mmsId: 'sdt_a', assignedBy: 'Calum Steel' }),
      assignment({ mmsId: 'sdt_b', assignedBy: 'Calum Steel' }),
    ],
  });

  assert.deepEqual(history.fc_song_crazy.tutors, [{ name: 'Calum Steel', students: 2 }]);
  assert.equal(history.fc_song_crazy.studentCount, 2);
});

test('summary names who to ask and how many students', () => {
  assert.equal(
    summariseTeachingHistory({ tutors: [{ name: 'Tom', students: 3 }], studentCount: 3 }),
    'Tom · 3 students',
  );
  assert.equal(
    summariseTeachingHistory({
      tutors: [{ name: 'Tom', students: 2 }, { name: 'Kim', students: 1 }],
      studentCount: 3,
    }),
    'Tom and Kim · 3 students',
  );
  assert.equal(
    summariseTeachingHistory({
      tutors: [
        { name: 'Tom', students: 2 },
        { name: 'Kim', students: 1 },
        { name: 'Dean', students: 1 },
      ],
      studentCount: 4,
    }),
    'Tom, Kim +1 · 4 students',
  );
  assert.equal(summariseTeachingHistory({ tutors: [], studentCount: 1 }), '1 student');
  assert.equal(summariseTeachingHistory(null), '');
  assert.equal(summariseTeachingHistory({ tutors: [], studentCount: 0 }), '');
});
