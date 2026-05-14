import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOnboardedWaitingNote,
  buildWelcomeGroupMessage,
  normaliseWaitingStatus,
} from '../../lib/admin/waiting-workflow.js';

test('normaliseWaitingStatus falls back to new for unknown values', () => {
  assert.equal(normaliseWaitingStatus('contacted'), 'contacted');
  assert.equal(normaliseWaitingStatus('bad-value'), 'new');
});

test('buildWelcomeGroupMessage injects the parent first name', () => {
  const message = buildWelcomeGroupMessage({
    parentFirstName: 'Jennifer',
  });

  assert.match(message, /^Hey Jennifer!/);
  assert.match(message, /firstchord\.co\.uk\/handbook/);
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
