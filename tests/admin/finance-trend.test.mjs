import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFinanceTrend } from '../../lib/admin/finance-trend.mjs';

const weekly = (at, overrides = {}) => ({
  period_type: 'weekly',
  snapshot_at: at,
  active_count: '100',
  paused_count: '10',
  active_weekly_revenue: '1000',
  active_monthly_revenue: '4333',
  margin_monthly: '1000',
  source: 'estimate',
  ...overrides,
});

test('builds an ordered weekly series, one point per ISO week', () => {
  const t = buildFinanceTrend([
    weekly('2026-06-22T09:00:00Z'),
    weekly('2026-06-08T09:00:00Z'),
    weekly('2026-06-15T09:00:00Z'),
  ]);
  assert.equal(t.points.length, 3);
  assert.deepEqual(t.points.map((p) => p.date), ['2026-06-08', '2026-06-15', '2026-06-22']);
  assert.equal(t.summary.gapCount, 0);
});

test('dedupes multiple snapshots in the same week, keeping the latest', () => {
  const t = buildFinanceTrend([
    weekly('2026-06-22T09:00:00Z', { active_monthly_revenue: '4000' }),
    weekly('2026-06-22T18:00:00Z', { active_monthly_revenue: '4500' }),
  ]);
  assert.equal(t.points.length, 1);
  assert.equal(t.points[0].revenueMonthly, 4500);
});

test('flags a gap as a hole, never a zero', () => {
  const t = buildFinanceTrend([
    weekly('2026-06-08T09:00:00Z'), // W24
    weekly('2026-06-22T09:00:00Z'), // W26 — W25 missing
  ]);
  assert.equal(t.points.length, 2);
  assert.equal(t.summary.gapCount, 1);
  assert.equal(t.points[1].gapBefore, true);
  // no synthetic point inserted for the missing week
  assert.ok(t.points.every((p) => Number.isFinite(p.revenueMonthly)));
});

test('computes week-over-week deltas (abs + pct)', () => {
  const t = buildFinanceTrend([
    weekly('2026-06-15T09:00:00Z', { active_monthly_revenue: '100', margin_monthly: '50', active_count: '100' }),
    weekly('2026-06-22T09:00:00Z', { active_monthly_revenue: '110', margin_monthly: '40', active_count: '95' }),
  ]);
  assert.equal(t.deltas.revenueMonthly.abs, 10);
  assert.equal(t.deltas.revenueMonthly.pct, 10);
  assert.equal(t.deltas.marginMonthly.abs, -10);
  assert.equal(t.deltas.activeCount.abs, -5);
});

test('only includes rows matching the requested period', () => {
  const t = buildFinanceTrend([
    weekly('2026-06-22T09:00:00Z'),
    { period_type: 'monthly', snapshot_at: '2026-06-01T09:00:00Z', active_monthly_revenue: '4000', margin_monthly: '900', active_count: '100' },
  ], { period: 'weekly' });
  assert.equal(t.points.length, 1);
  assert.equal(t.period, 'weekly');
});

test('groups monthly rows by calendar month with consecutive indices', () => {
  const t = buildFinanceTrend([
    { period_type: 'monthly', snapshot_at: '2026-05-01T09:00:00Z', active_monthly_revenue: '4000', margin_monthly: '900', active_count: '100' },
    { period_type: 'monthly', snapshot_at: '2026-06-01T09:00:00Z', active_monthly_revenue: '4200', margin_monthly: '950', active_count: '102' },
  ], { period: 'monthly' });
  assert.deepEqual(t.points.map((p) => p.periodKey), ['2026-05', '2026-06']);
  assert.equal(t.summary.gapCount, 0);
  assert.equal(t.deltas.revenueMonthly.abs, 200);
});

test('respects the limit, keeping the most recent points', () => {
  const rows = ['2026-05-04', '2026-05-11', '2026-05-18', '2026-05-25'].map((d) => weekly(`${d}T09:00:00Z`));
  const t = buildFinanceTrend(rows, { period: 'weekly', limit: 2 });
  assert.equal(t.points.length, 2);
  assert.equal(t.points[1].date, '2026-05-25');
});

test('handles empty and single-point series safely', () => {
  const empty = buildFinanceTrend([]);
  assert.equal(empty.points.length, 0);
  assert.equal(empty.latest, null);
  assert.equal(empty.deltas, null);

  const one = buildFinanceTrend([weekly('2026-06-22T09:00:00Z')]);
  assert.equal(one.points.length, 1);
  assert.equal(one.deltas, null);
  assert.equal(one.summary.revenueMonthly.latest, 4333);
});

test('tracks source mix so estimate vs actuals stays visible', () => {
  const t = buildFinanceTrend([
    weekly('2026-06-15T09:00:00Z', { source: 'estimate' }),
    weekly('2026-06-22T09:00:00Z', { source: 'mixed' }),
  ]);
  assert.equal(t.summary.sourceMix.estimate, 1);
  assert.equal(t.summary.sourceMix.mixed, 1);
});
