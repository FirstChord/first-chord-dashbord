import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOnboardedWaitingNote,
  buildWelcomeGroupMessage,
  isActiveWaitingStatus,
  normaliseWaitingStatus,
} from '../../lib/admin/waiting-workflow.js';
import {
  getWaitingRestoreStatus,
  getWaitingStatusLabel,
  partitionWaitingStudents,
} from '../../lib/admin/waiting-status.mjs';

test('normaliseWaitingStatus falls back to new for unknown values', () => {
  assert.equal(normaliseWaitingStatus('contacted'), 'contacted');
  assert.equal(normaliseWaitingStatus('bad-value'), 'new');
});

test('isActiveWaitingStatus excludes parked and completed waiting states', () => {
  assert.equal(isActiveWaitingStatus('new'), true);
  assert.equal(isActiveWaitingStatus('onboarding_ready'), true);
  assert.equal(isActiveWaitingStatus('closed'), false);
  assert.equal(isActiveWaitingStatus('no_response'), false);
  assert.equal(isActiveWaitingStatus('onboarded'), false);
});

test('partitionWaitingStudents keeps inactive records available without counting them as active', () => {
  const students = [
    { mmsId: 'new', waitingStatus: 'new' },
    { mmsId: 'cold', waitingStatus: 'no_response' },
    { mmsId: 'parked', waitingStatus: 'closed' },
    { mmsId: 'done', waitingStatus: 'onboarded' },
  ];

  const result = partitionWaitingStudents(students);

  assert.deepEqual(result.activeStudents.map((student) => student.mmsId), ['new']);
  assert.deepEqual(result.inactiveStudents.map((student) => student.mmsId), ['cold', 'parked', 'done']);
});

test('only no-response and closed records return to the contacted stage', () => {
  assert.equal(getWaitingRestoreStatus('no_response'), 'contacted');
  assert.equal(getWaitingRestoreStatus('closed'), 'contacted');
  assert.equal(getWaitingRestoreStatus('onboarded'), '');
  assert.equal(getWaitingStatusLabel('no_response'), 'No response');
});

test('buildWelcomeGroupMessage addresses a parent and refers to the student by name', () => {
  const message = buildWelcomeGroupMessage({
    firstName: 'Jamie',
    lastName: 'Smith',
    fullName: 'Jamie Smith',
    parentFirstName: 'Jennifer',
    parentLastName: 'Smith',
  });

  assert.match(message, /^Hey Jennifer!/);
  assert.match(message, /sort Jamie out with a first lesson/);
  assert.match(message, /their musical interests and goals/);
  assert.match(message, /match them with the perfect tutor/);
  assert.match(message, /Alternatively, feel free to just give us a ring/);
  assert.match(message, /firstchord\.co\.uk\/handbook/);
});

test('buildWelcomeGroupMessage uses direct pronouns for an adult student contact', () => {
  const message = buildWelcomeGroupMessage({
    firstName: 'Sian',
    lastName: 'Malyin',
    fullName: 'Sian Malyin',
    parentFirstName: 'Sian',
    parentLastName: 'Malyin',
  });

  assert.match(message, /sort you out with a first lesson/);
  assert.match(message, /your musical interests and goals/);
  assert.match(message, /match you with the perfect tutor/);
});

test('buildOnboardedWaitingNote preserves existing notes and appends onboarding context', () => {
  const note = buildOnboardedWaitingNote({
    existingNote: 'Parent prefers Fridays.',
    studentName: 'Jamie Smith',
    tutorName: 'Chloe Mak',
    lessonDate: '2026-05-20',
    lessonTime: '16:00',
    now: '2026-05-14T10:00:00.000Z',
  });

  assert.match(note, /^Parent prefers Fridays\./);
  assert.match(note, /Auto-closed by onboarding on 2026-05-14/);
  assert.match(note, /student: Jamie Smith/);
  assert.match(note, /tutor: Chloe Mak/);
  assert.match(note, /lesson: 2026-05-20 16:00/);
});

test('buildOnboardedWaitingNote records partial MMS follow-up when needed', () => {
  const note = buildOnboardedWaitingNote({
    lessonWarning: 'MMS lesson creation failed',
    now: '2026-05-14T10:00:00.000Z',
  });

  assert.match(note, /MMS follow-up needed: MMS lesson creation failed/);
});
