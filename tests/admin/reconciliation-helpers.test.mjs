import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileEpisode, OUTCOME, ACTION, REASON } from '../../lib/admin/reconciliation-helpers.mjs';

// lesson instance: a tutor-absence-affected lesson (the L1 episode driver)
const inst = (overrides = {}) => ({
  eventId: overrides.eventId || 'e1',
  studentMmsId: overrides.studentMmsId || 'rosie',
  date: overrides.date || '2026-07-06',
  startTime: '16:00',
  durationMinutes: '30',
  lessonKind: 'one_to_one',
  tutorId: 'tom',
  lessonValue: overrides.lessonValue ?? 25,
  tutorPayAmount: overrides.tutorPayAmount ?? 12,
  absence: { decision: 'cancel', coverTutorId: '', coverPayAmount: 0, absenceRowRef: 'abs1', ...(overrides.absence || {}) },
  ...overrides,
});

const pause = (studentMmsId, startDate, endDate, matchConfidence = 'high') => ({
  studentMmsId, startDate, endDate, sourceRef: 'ph1', matchConfidence,
});

const rosie = () => [
  inst({ eventId: 'e1', date: '2026-07-06' }),
  inst({ eventId: 'e2', date: '2026-07-13' }),
  inst({ eventId: 'e3', date: '2026-07-20' }),
];

test('Rosie: 3 cancels, no overlap → 3 net-new no-lessons, one family message', () => {
  const r = reconcileEpisode({ lessonInstances: rosie(), pauseWindows: [] });
  assert.ok(r.instances.every((i) => i.outcome === OUTCOME.NO_LESSON));
  assert.equal(r.finance.netNewRevenueLost, 75);
  assert.equal(r.finance.netNewOriginalPaySaved, 36);
  assert.equal(r.finance.marginEffect, -39);
  assert.equal(r.finance.netNewNotBillingStudentWeeks, 3);
  const fam = r.familyEpisodes[0];
  assert.equal(fam.netNewDates.length, 3);
  assert.equal(fam.commsRequired, true);
  assert.deepEqual(fam.remainingActions, [ACTION.CONFIRM_PAUSE]);
});

test('cancel fully inside a student pause → 0 net-new, comms + planning suppressed (Student C)', () => {
  const r = reconcileEpisode({ lessonInstances: rosie(), pauseWindows: [pause('rosie', '2026-07-01', '2026-07-31')] });
  assert.ok(r.instances.every((i) => i.outcome === OUTCOME.NO_LESSON));
  assert.equal(r.finance.netNewRevenueLost, 0); // pause already accounts for it
  assert.equal(r.finance.netNewOriginalPaySaved, 0);
  assert.equal(r.finance.netNewNotBillingStudentWeeks, 0);
  assert.equal(r.instances[0].revenue.grossLost, 25); // evidence retains gross
  assert.equal(r.instances[0].revenue.ownedByCause, 'student_pause');
  const fam = r.familyEpisodes[0];
  assert.equal(fam.commsRequired, false);
  assert.deepEqual(fam.remainingActions, []);
  assert.ok(fam.suppressionReasons.includes(REASON.COMMS_ALREADY_COVERED));
});

test('partial overlap by date → only net-new dates count (Student B)', () => {
  const r = reconcileEpisode({ lessonInstances: rosie(), pauseWindows: [pause('rosie', '2026-07-06', '2026-07-06')] });
  assert.equal(r.finance.netNewRevenueLost, 50); // 2 of 3 are net-new
  assert.equal(r.familyEpisodes[0].netNewDates.length, 2);
  assert.ok(!r.familyEpisodes[0].netNewDates.includes('2026-07-06'));
});

test('cover, no overlap → lesson runs, cover paid, no revenue loss', () => {
  const r = reconcileEpisode({
    lessonInstances: [inst({ absence: { decision: 'cover', coverTutorId: 'kim', coverPayAmount: 12, absenceRowRef: 'abs1' } })],
    pauseWindows: [],
  });
  assert.equal(r.instances[0].outcome, OUTCOME.COVERED);
  assert.equal(r.finance.netNewRevenueLost, 0);
  assert.equal(r.finance.netNewOriginalPaySaved, 12);
  assert.equal(r.finance.netNewCoverPayAdded, 12);
  assert.equal(r.finance.marginEffect, 0);
  assert.deepEqual(r.familyEpisodes[0].remainingActions, [ACTION.ARRANGE_COVER]);
});

test('cover + student pause on the same lesson → conflict, needs_clarification (not auto-resolved)', () => {
  const r = reconcileEpisode({
    lessonInstances: [inst({ absence: { decision: 'cover', coverTutorId: 'kim', coverPayAmount: 12, absenceRowRef: 'abs1' } })],
    pauseWindows: [pause('rosie', '2026-07-01', '2026-07-31')],
  });
  assert.equal(r.instances[0].outcome, OUTCOME.NEEDS_CLARIFICATION);
  assert.equal(r.unresolved.length, 1);
  assert.equal(r.finance.netNewRevenueLost, 0);
  assert.equal(r.finance.netNewCoverPayAdded, 0); // nothing counted while unresolved
  assert.ok(r.instances[0].evidence.some((e) => e.rule === REASON.CONFLICT_COVER_AND_PAUSE));
});

test('low-confidence pause match → resolves conservatively as the absence, but flags clarify', () => {
  const r = reconcileEpisode({ lessonInstances: [inst()], pauseWindows: [pause('rosie', '2026-07-01', '2026-07-31', 'low')] });
  assert.equal(r.instances[0].outcome, OUTCOME.NO_LESSON);
  assert.equal(r.finance.netNewRevenueLost, 25); // NOT suppressed on a shaky match
  assert.equal(r.instances[0].ambiguity, 'needs_clarification');
  assert.equal(r.instances[0].planning.actionRequired, ACTION.CLARIFY);
});

test('group lesson (one event, two students) → revenue per student, tutor cost once per slot', () => {
  const r = reconcileEpisode({
    lessonInstances: [
      inst({ eventId: 'eG', studentMmsId: 's1', lessonValue: 20, tutorPayAmount: 18, lessonKind: 'group' }),
      inst({ eventId: 'eG', studentMmsId: 's2', lessonValue: 20, tutorPayAmount: 18, lessonKind: 'group' }),
    ],
    pauseWindows: [],
  });
  assert.equal(r.finance.netNewRevenueLost, 40); // per student
  assert.equal(r.finance.netNewOriginalPaySaved, 18); // slot counted once
});

test('missing/invalid absence decision → needs_clarification', () => {
  const r = reconcileEpisode({ lessonInstances: [inst({ absence: { decision: '', absenceRowRef: 'abs1' } })], pauseWindows: [] });
  assert.equal(r.instances[0].outcome, OUTCOME.NEEDS_CLARIFICATION);
  assert.ok(r.instances[0].evidence.some((e) => e.rule === REASON.INVALID_DECISION));
});

test('idempotent: same inputs produce a deep-equal result', () => {
  const args = { lessonInstances: rosie(), pauseWindows: [pause('rosie', '2026-07-06', '2026-07-06')] };
  assert.deepEqual(reconcileEpisode(args), reconcileEpisode(args));
});

test('invariant: no instance contributes more than the lesson value as net-new revenue loss', () => {
  const r = reconcileEpisode({ lessonInstances: rosie(), pauseWindows: [pause('rosie', '2026-07-13', '2026-07-13')] });
  for (const i of r.instances) {
    assert.ok(i.revenue.netNewLost <= i.lessonValue);
    assert.ok(i.revenue.netNewLost >= 0);
  }
});

test('"no action required" is a valid reconciled outcome', () => {
  const r = reconcileEpisode({ lessonInstances: [inst()], pauseWindows: [pause('rosie', '2026-07-01', '2026-07-31')] });
  assert.equal(r.instances[0].outcome, OUTCOME.NO_LESSON);
  assert.equal(r.instances[0].planning.actionRequired, ACTION.NONE);
  assert.equal(r.familyEpisodes[0].commsRequired, false);
});
