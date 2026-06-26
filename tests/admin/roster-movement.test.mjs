import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRosterMovement, onboardedDatesFromWaitingState, leftDatesFromArchive } from '../../lib/admin/roster-movement.mjs';

const NOW = new Date('2026-06-15T12:00:00Z');

test('buckets onboarded and left by month with net', () => {
  const r = buildRosterMovement({
    onboardedDates: ['2026-06-02', '2026-06-20', '2026-05-10'],
    leftDates: ['2026-06-05', '2026-04-01'],
    now: NOW,
    months: 6,
  });
  const jun = r.months.find((m) => m.month === '2026-06');
  const may = r.months.find((m) => m.month === '2026-05');
  assert.equal(jun.onboarded, 2);
  assert.equal(jun.left, 1);
  assert.equal(jun.net, 1);
  assert.equal(may.onboarded, 1);
  assert.equal(may.net, 1);
});

test('totals sum across the window; older-than-window dates are ignored', () => {
  const r = buildRosterMovement({
    onboardedDates: ['2026-06-02', '2025-01-01'], // 2025 is outside a 6-month window
    leftDates: ['2026-06-05'],
    now: NOW,
    months: 6,
  });
  assert.equal(r.totals.onboarded, 1);
  assert.equal(r.totals.left, 1);
  assert.equal(r.totals.net, 0);
});

test('window always has exactly `months` buckets, oldest→newest', () => {
  const r = buildRosterMovement({ now: NOW, months: 3 });
  assert.equal(r.months.length, 3);
  assert.deepEqual(r.months.map((m) => m.month), ['2026-04', '2026-05', '2026-06']);
});

test('onboardedDatesFromWaitingState picks onboarded rows, prefers updatedAt', () => {
  const dates = onboardedDatesFromWaitingState([
    { status: 'onboarded', updatedAt: '2026-06-02T10:00:00Z', dateStarted: '2026-05-01' },
    { status: 'contacted', updatedAt: '2026-06-03T10:00:00Z' },
    { status: 'onboarded', updatedAt: '', dateStarted: '2026-04-09' },
  ]);
  assert.deepEqual(dates, ['2026-06-02T10:00:00Z', '2026-04-09']);
});

test('leftDatesFromArchive reads archived_at', () => {
  assert.deepEqual(leftDatesFromArchive([{ archived_at: '2026-06-05T09:00:00Z' }, { archived_at: '' }]), ['2026-06-05T09:00:00Z']);
});
