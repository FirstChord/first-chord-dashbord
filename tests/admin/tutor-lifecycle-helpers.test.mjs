import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorLifecycleEvent, normaliseTutorLifecycleDate, tutorMatchesIdentity } from '../../lib/admin/tutor-lifecycle-helpers.mjs';

test('tutor lifecycle dates accept only ISO calendar dates', () => {
  assert.equal(normaliseTutorLifecycleDate('2026-07-11'), '2026-07-11');
  assert.equal(normaliseTutorLifecycleDate('11/07/2026'), '');
  assert.equal(normaliseTutorLifecycleDate(''), '');
});

test('tutor matching handles short names, full names, and diacritics', () => {
  const tutor = { shortName: 'Eléna', fullName: 'Eléna Esposito' };
  assert.equal(tutorMatchesIdentity('Eléna', tutor), true);
  assert.equal(tutorMatchesIdentity('Elena Esposito', tutor), true);
  assert.equal(tutorMatchesIdentity('Patrick', tutor), false);
});

test('tutor lifecycle events preserve identity and handover context', () => {
  const event = buildTutorLifecycleEvent({
    tutor: { shortName: 'Patrick', fullName: 'Patrick Shand', teacherId: 'tch_1', finalTeachingDate: '2026-07-03', replacementTutorShortName: 'David' },
    previousStatus: 'leaving',
    nextStatus: 'retired',
    actorEmail: 'admin@example.com',
    occurredAt: '2026-07-11T09:00:00.000Z',
    note: 'Final payroll still to check',
  });
  assert.equal(event.entityType, 'tutor');
  assert.equal(event.eventType, 'tutor_lifecycle_retired');
  assert.equal(event.mmsId, 'tch_1');
  const payload = JSON.parse(event.payloadJson);
  assert.equal(payload.previous_status, 'leaving');
  assert.equal(payload.replacement_tutor_short_name, 'David');
});
