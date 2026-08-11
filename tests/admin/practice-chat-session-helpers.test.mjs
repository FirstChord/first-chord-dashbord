import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ABANDONED_AFTER_MS,
  buildPracticeChatSessionSheetRow,
  deriveSessionOutcome,
  normalisePracticeChatSessionPayload,
  normalisePracticeChatSessionRow,
  normaliseSessionSteps,
  selectSessionForPriorRating,
} from '../../lib/admin/practice-chat-session-helpers.mjs';
import { PRACTICE_CHAT_SESSIONS_HEADERS } from '../../lib/admin/sheets/core.mjs';

const NOW = new Date('2026-08-10T12:00:00.000Z');

test('a session needs an id and a student', () => {
  assert.deepEqual(
    normalisePracticeChatSessionPayload({}, NOW).errors,
    ['sessionId is required', 'studentMmsId is required'],
  );
  assert.deepEqual(
    normalisePracticeChatSessionPayload({ sessionId: 's1', studentId: 'sdt_1' }, NOW).errors,
    [],
  );
});

test('the row builder emits exactly the sheet headers', () => {
  assert.deepEqual(
    Object.keys(buildPracticeChatSessionSheetRow({})).sort(),
    [...PRACTICE_CHAT_SESSIONS_HEADERS].sort(),
  );
});

test('blank and zero stay different measurements', () => {
  // A typed note never started a recording; a recording that failed instantly
  // did. Coercing the first to 0 would invent a measurement and drag medians
  // down with sessions that never captured anything.
  const typed = normalisePracticeChatSessionPayload(
    { sessionId: 's1', studentId: 'sdt_1', typedNotSpoken: true },
    NOW,
  );
  assert.equal(typed.msCaptureTotal, '');

  const failedFast = normalisePracticeChatSessionPayload(
    { sessionId: 's2', studentId: 'sdt_1', msCaptureTotal: 0 },
    NOW,
  );
  assert.equal(failedFast.msCaptureTotal, 0);
});

test('a slept laptop cannot dominate the p90', () => {
  // Six hours is a lid that closed, not a lesson note. One such row would own
  // the tail of a few hundred sessions.
  const session = normalisePracticeChatSessionPayload(
    { sessionId: 's1', studentId: 'sdt_1', msActive: 6 * 60 * 60 * 1000 },
    NOW,
  );
  assert.equal(session.msActive, 4 * 60 * 60 * 1000);
});

test('negative and non-numeric durations are dropped, not clamped to zero', () => {
  for (const bogus of [-1, 'soon', NaN, {}]) {
    const session = normalisePracticeChatSessionPayload(
      { sessionId: 's1', studentId: 'sdt_1', msActive: bogus },
      NOW,
    );
    assert.equal(session.msActive, '', `${JSON.stringify(bogus)} should not become a duration`);
  }
});

test('an edit delta keeps its sign', () => {
  // Cutting the note down and padding it out are different tutor behaviours.
  const trimmed = normalisePracticeChatSessionPayload(
    { sessionId: 's1', studentId: 'sdt_1', editCharDelta: -120 },
    NOW,
  );
  assert.equal(trimmed.editCharDelta, -120);
});

test('only 1-5 counts as a rating', () => {
  for (const [input, expected] of [[1, 1], [5, 5], [3, 3], [0, ''], [6, ''], [2.5, ''], ['', ''], ['4', 4]]) {
    const session = normalisePracticeChatSessionPayload(
      { sessionId: 's1', studentId: 'sdt_1', ratingAccuracy: input },
      NOW,
    );
    assert.equal(session.ratingAccuracy, expected, `rating ${JSON.stringify(input)}`);
  }
});

test('an unrecognised phase or step falls back rather than being stored', () => {
  const session = normalisePracticeChatSessionPayload(
    { sessionId: 's1', studentId: 'sdt_1', phase: 'abandoned', lastStep: 'q9' },
    NOW,
  );
  // "abandoned" is deliberately not a phase a client may claim.
  assert.equal(session.phase, 'opened');
  assert.equal(session.lastStep, '');
});

test('the comment is capped and no note text can ride along', () => {
  const session = normalisePracticeChatSessionPayload(
    { sessionId: 's1', studentId: 'sdt_1', ratingComment: 'x'.repeat(500), rawNoteText: 'the whole lesson note' },
    NOW,
  );
  assert.equal(session.ratingComment.length, 200);
  assert.equal(
    JSON.stringify(buildPracticeChatSessionSheetRow(session)).includes('the whole lesson note'),
    false,
  );
});

test('steps are bounded at the three questions the ritual has', () => {
  const steps = normaliseSessionSteps([
    { q: 1, recordMs: 4000, transcribeMs: 900, chars: 120, errors: 0, skipped: false, reRecorded: 0 },
    { q: 2, recordMs: 3000, errors: 1, reRecorded: 1 },
    { q: 3, skipped: true },
    { q: 4, recordMs: 1000 },
  ]);
  assert.equal(steps.length, 3);
  assert.equal(steps[1].errors, 1);
  assert.equal(steps[2].skipped, true);
});

test('malformed steps_json reads as no detail rather than throwing', () => {
  assert.deepEqual(normaliseSessionSteps('{not json'), []);
  assert.deepEqual(normaliseSessionSteps(null), []);
});

test('a session round-trips through the sheet', () => {
  const session = normalisePracticeChatSessionPayload({
    sessionId: 's1',
    studentId: 'sdt_1',
    tutor: 'Finn',
    phase: 'finished',
    outcome: 'sent',
    noteId: 'practice_note:sdt_1:abc',
    msActive: 92000,
    asrErrorCount: 1,
    reRecordCount: 2,
    noteEdited: true,
    editCharDelta: 45,
    ratingAccuracy: 4,
    steps: [{ q: 1, recordMs: 4000, chars: 120 }],
  }, NOW);

  const row = buildPracticeChatSessionSheetRow(session);
  const read = normalisePracticeChatSessionRow(row);

  assert.equal(read.sessionId, 's1');
  assert.equal(read.phase, 'finished');
  assert.equal(read.outcome, 'sent');
  assert.equal(read.msActive, 92000);
  assert.equal(read.noteEdited, true);
  assert.equal(read.editCharDelta, 45);
  assert.equal(read.ratingAccuracy, 4);
  assert.equal(read.steps[0].chars, 120);
  // Booleans survive as booleans, not as the string "FALSE" (which is truthy).
  assert.equal(read.safetyAck, false);
});

test('every column survives a read-modify-write, not just the ones we spot-check', () => {
  // The rating routes read a finished row back, change one field and write the
  // whole thing again. If any column failed to round-trip it would be blanked
  // by a tutor answering a rating — exactly the failure
  // setPracticeNoteFollowUpHandled exists to avoid. So pin all of them.
  const session = normalisePracticeChatSessionPayload({
    sessionId: 's1',
    studentId: 'sdt_1',
    tutor: 'Finn',
    asrModel: 'whisper-1',
    buildVersion: '20260810-eval',
    phase: 'finished',
    outcome: 'sent',
    noteId: 'practice_note:sdt_1:abc',
    questionsAnswered: 3,
    questionsSkipped: 0,
    typedNotSpoken: false,
    lastStep: 'review',
    msToFirstRecord: 4200,
    msCaptureTotal: 61000,
    msTranscribeTotal: 5400,
    msActive: 92000,
    msSessionTotal: 480000,
    asrErrorCount: 1,
    reRecordCount: 2,
    safetyFlagCount: 1,
    safetyAck: true,
    noteEdited: true,
    editCharDelta: -45,
    songsSelected: 2,
    unlistedSongs: 1,
    priorNoteExists: true,
    priorNoteAgeDays: 7,
    priorHistoryOpened: true,
    ratingPrompted: true,
    ratingAccuracy: 4,
    ratingComment: 'Got the song title wrong',
    ratingAnsweredAt: '2026-08-10T11:00:00.000Z',
    priorUsefulness: 5,
    priorUsefulnessAt: '2026-08-10T10:00:00.000Z',
    steps: [{ q: 1, recordMs: 4000, transcribeMs: 900, chars: 120, errors: 0, skipped: false, reRecorded: 0 }],
  }, NOW);

  const firstRow = buildPracticeChatSessionSheetRow(session);
  const secondRow = buildPracticeChatSessionSheetRow(normalisePracticeChatSessionRow(firstRow));

  assert.deepEqual(secondRow, firstRow);
  // And nothing landed blank that we meant to store.
  for (const header of PRACTICE_CHAT_SESSIONS_HEADERS) {
    assert.notEqual(firstRow[header], '', `${header} should have a value in this fixture`);
  }
});

test('abandonment is derived from age, never taken from the client', () => {
  const opened = { phase: 'opened', openedAt: '2026-08-10T11:59:00.000Z' };
  const stale = { phase: 'capturing', openedAt: new Date(NOW.getTime() - ABANDONED_AFTER_MS - 1).toISOString() };
  const done = { phase: 'finished', openedAt: '2026-08-10T09:00:00.000Z' };

  // Recent and unfinished is neither a success nor a failure: the lesson may
  // still be running, so it must stay out of both sides of a completion rate.
  assert.equal(deriveSessionOutcome(opened, NOW), 'in_flight');
  assert.equal(deriveSessionOutcome(stale, NOW), 'abandoned');
  assert.equal(deriveSessionOutcome(done, NOW), 'completed');
});

test('an unfinished session with no usable opened_at is abandoned, not in flight', () => {
  // Otherwise a row with a corrupt timestamp would sit in "still running"
  // forever and quietly shrink the denominator.
  assert.equal(deriveSessionOutcome({ phase: 'opened', openedAt: 'nonsense' }, NOW), 'abandoned');
});

test('a prior-usefulness answer lands on the latest rateable session', () => {
  const sessions = [
    { sessionId: 'old', studentMmsId: 'sdt_1', noteId: 'n1', phase: 'finished', openedAt: '2026-08-01T10:00:00.000Z' },
    { sessionId: 'new', studentMmsId: 'sdt_1', noteId: 'n2', phase: 'finished', openedAt: '2026-08-08T10:00:00.000Z' },
    { sessionId: 'other', studentMmsId: 'sdt_2', noteId: 'n3', phase: 'finished', openedAt: '2026-08-09T10:00:00.000Z' },
  ];
  assert.equal(selectSessionForPriorRating(sessions, 'sdt_1').sessionId, 'new');
});

test('abandoned sessions and already-rated ones are not rateable', () => {
  const sessions = [
    // No note was produced, so there is nothing the tutor could have found useful.
    { sessionId: 'abandoned', studentMmsId: 'sdt_1', noteId: '', phase: 'opened', openedAt: '2026-08-09T10:00:00.000Z' },
    // Already answered: a double-tap must not overwrite it or walk backwards.
    { sessionId: 'rated', studentMmsId: 'sdt_1', noteId: 'n1', phase: 'finished', priorUsefulness: 4, openedAt: '2026-08-08T10:00:00.000Z' },
    { sessionId: 'open', studentMmsId: 'sdt_1', noteId: 'n2', phase: 'finished', openedAt: '2026-08-07T10:00:00.000Z' },
  ];
  assert.equal(selectSessionForPriorRating(sessions, 'sdt_1').sessionId, 'open');
  assert.equal(selectSessionForPriorRating(sessions, 'sdt_9'), null);
  assert.equal(selectSessionForPriorRating(sessions, ''), null);
});
