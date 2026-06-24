import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCapacityValue } from '../../lib/admin/capacity-value.mjs';

const NOW = new Date('2026-06-24T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const bookable = (overrides = {}) => ({
  mmsId: overrides.mmsId || 'b1',
  dateStarted: daysAgo(10),
  capacityMatchStatus: 'matched',
  capacityMatches: [{ teacherName: 'Patrick' }],
  uncoveredInstruments: [],
  ...overrides,
});

const blockedNeedHours = (overrides = {}) => ({
  mmsId: overrides.mmsId || 'h1',
  dateStarted: daysAgo(20),
  capacityMatchStatus: 'no_match',
  capacityMatches: [],
  uncoveredInstruments: [{ instrument: 'Guitar', reason: 'no_free_slots' }],
  ...overrides,
});

const blockedNeedTutor = (overrides = {}) => ({
  mmsId: overrides.mmsId || 't1',
  dateStarted: daysAgo(20),
  capacityMatchStatus: 'no_match',
  capacityMatches: [],
  uncoveredInstruments: [{ instrument: 'Harp', reason: 'not_taught' }],
  ...overrides,
});

test('splits the waiting list into bookable-now vs blocked', () => {
  const v = buildCapacityValue([bookable(), blockedNeedHours(), blockedNeedTutor()], { now: NOW });
  assert.equal(v.bookableNow.freshCount, 1);
  assert.equal(v.needHours.freshCount, 1);
  assert.equal(v.needTutor.freshCount, 1);
  assert.equal(v.blocked.freshCount, 2);
});

test('values fresh students at the 30-min contribution and net revenue', () => {
  const v = buildCapacityValue([bookable()], { now: NOW });
  const weeksPerMonth = 52 / 12;
  const net = Math.round(25 * weeksPerMonth * 0.89 * 100) / 100;
  const contribution = Math.round((25 * weeksPerMonth * 0.89 - 12 * weeksPerMonth) * 100) / 100;
  assert.equal(v.bookableNow.revenueMonthly, net);
  assert.equal(v.bookableNow.contributionMonthly, contribution);
});

test('stale entries are excluded from the headline £ but still counted', () => {
  const v = buildCapacityValue([bookable(), bookable({ mmsId: 'old', dateStarted: daysAgo(200) })], { now: NOW });
  assert.equal(v.bookableNow.count, 2);
  assert.equal(v.bookableNow.freshCount, 1); // only the recent one drives £
  assert.equal(v.staleCount, 1);
  assert.equal(v.freshTotal, 1);
});

test('recruiting targets rank unmet instrument demand by fresh count', () => {
  const v = buildCapacityValue([
    blockedNeedTutor({ mmsId: 'a' }),
    blockedNeedTutor({ mmsId: 'b' }),
    blockedNeedHours({ mmsId: 'c' }),
  ], { now: NOW });
  assert.equal(v.recruitingTargets[0].instrument, 'Harp');
  assert.equal(v.recruitingTargets[0].reason, 'not_taught');
  assert.equal(v.recruitingTargets[0].freshCount, 2);
});

test('a matched student counts as bookable even with a secondary uncovered instrument', () => {
  const v = buildCapacityValue([
    bookable({ uncoveredInstruments: [{ instrument: 'Drums', reason: 'no_free_slots' }] }),
  ], { now: NOW });
  assert.equal(v.bookableNow.freshCount, 1);
  assert.equal(v.needHours.freshCount, 0);
  // the secondary gap still shows as a recruiting/heads-up signal
  assert.equal(v.recruitingTargets[0].instrument, 'Drums');
});

test('instrument_unknown is set aside, not counted as demand', () => {
  const v = buildCapacityValue([
    { mmsId: 'u', dateStarted: daysAgo(5), capacityMatchStatus: 'instrument_unknown', capacityMatches: [], uncoveredInstruments: [] },
  ], { now: NOW });
  assert.equal(v.unknownCount, 1);
  assert.equal(v.bookableNow.freshCount, 0);
  assert.equal(v.blocked.freshCount, 0);
});
