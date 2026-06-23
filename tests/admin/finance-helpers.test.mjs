import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveStudentRevenue,
  buildRevenueRunRate,
  formatMoney,
} from '../../lib/admin/finance-helpers.mjs';

const oneToOne30 = (overrides = {}) => ({
  mmsId: 'm1',
  lifecycleStatus: 'active',
  paymentMode: 'stripe',
  instrument: 'Guitar',
  scheduleContext: { status: 'found', durationMinutes: '30' },
  ...overrides,
});

test('resolveStudentRevenue estimates from the price table by default', () => {
  const rev = resolveStudentRevenue(oneToOne30());
  assert.equal(rev.source, 'estimate');
  assert.equal(rev.weekly, 25);
  assert.equal(rev.lessonKind, 'one_to_one');
  assert.equal(rev.priced, true);
});

test('resolveStudentRevenue prefers a cached Stripe actual when supplied (B seam)', () => {
  const rev = resolveStudentRevenue(oneToOne30(), {
    stripeAmounts: { m1: { weekly: 30, lessonKind: 'one_to_one' } },
  });
  assert.equal(rev.source, 'stripe_actual');
  assert.equal(rev.weekly, 30);
  assert.equal(rev.confidence, 'high');
});

test('resolveStudentRevenue flags unpriced students (no duration in table)', () => {
  const rev = resolveStudentRevenue({ mmsId: 'x', instrument: 'Piano', lessonLength: '35' });
  assert.equal(rev.priced, false);
  assert.equal(rev.weekly, null);
});

test('buildRevenueRunRate sums active students only', () => {
  const runRate = buildRevenueRunRate([
    oneToOne30({ mmsId: 'a' }),
    oneToOne30({ mmsId: 'b' }),
  ]);
  assert.equal(runRate.active.count, 2);
  assert.equal(runRate.active.weekly, 50);
  assert.equal(runRate.active.monthly, Math.round(50 * (52 / 12) * 100) / 100);
});

test('buildRevenueRunRate excludes paused students from the live figure but reports them', () => {
  const runRate = buildRevenueRunRate([
    oneToOne30({ mmsId: 'a' }),
    oneToOne30({ mmsId: 'b', lifecycleStatus: 'paused' }),
  ]);
  assert.equal(runRate.active.count, 1);
  assert.equal(runRate.active.weekly, 25);
  assert.equal(runRate.paused.count, 1);
  assert.equal(runRate.paused.weekly, 25);
});

test('buildRevenueRunRate ignores non-active, non-paused lifecycle statuses', () => {
  const runRate = buildRevenueRunRate([
    oneToOne30({ mmsId: 'a' }),
    oneToOne30({ mmsId: 'w', lifecycleStatus: 'waiting' }),
    oneToOne30({ mmsId: 's', lifecycleStatus: 'stopped' }),
  ]);
  assert.equal(runRate.active.count, 1);
  assert.equal(runRate.active.weekly, 25);
});

test('buildRevenueRunRate breaks down by lesson kind with group and orchestra pricing', () => {
  const runRate = buildRevenueRunRate([
    oneToOne30({ mmsId: 'a' }),
    {
      mmsId: 'g',
      lifecycleStatus: 'active',
      paymentMode: 'stripe',
      lessonType: 'sibling_group',
      scheduleContext: { status: 'found', durationMinutes: '45' },
    },
    {
      mmsId: 'o',
      lifecycleStatus: 'active',
      paymentMode: 'manual',
      instrument: 'Adult Ukulele Orchestra',
      scheduleContext: { status: 'found', durationMinutes: '60' },
    },
  ]);
  assert.equal(runRate.byLessonKind.one_to_one.weekly, 25);
  assert.equal(runRate.byLessonKind.group.weekly, 20);
  // orchestra is monthly-priced; weekly is derived (£42.50 ÷ weeks-per-month)
  assert.ok(runRate.byLessonKind.orchestra.count === 1);
  assert.ok(runRate.byLessonKind.orchestra.weekly > 0);
});

test('buildRevenueRunRate splits active revenue by payment mode', () => {
  const runRate = buildRevenueRunRate([
    oneToOne30({ mmsId: 'a', paymentMode: 'stripe' }),
    oneToOne30({ mmsId: 'b', paymentMode: 'manual' }),
    oneToOne30({ mmsId: 'c', paymentMode: undefined }),
  ]);
  assert.equal(runRate.byPaymentMode.stripe.weekly, 25);
  assert.equal(runRate.byPaymentMode.manual.weekly, 25);
  assert.equal(runRate.byPaymentMode.unknown.weekly, 25);
});

test('buildRevenueRunRate counts active unpriced students separately', () => {
  const runRate = buildRevenueRunRate([
    oneToOne30({ mmsId: 'a' }),
    { mmsId: 'u', lifecycleStatus: 'active', instrument: 'Piano', lessonLength: '35' },
  ]);
  assert.equal(runRate.active.count, 2);
  assert.equal(runRate.active.weekly, 25);
  assert.equal(runRate.activeUnpriced, 1);
});

test('buildRevenueRunRate reports estimate-only until a Stripe actual lands', () => {
  const estimateOnly = buildRevenueRunRate([oneToOne30({ mmsId: 'a' })]);
  assert.equal(estimateOnly.isEstimateOnly, true);

  const withActual = buildRevenueRunRate([oneToOne30({ mmsId: 'a' })], {
    stripeAmounts: { a: { weekly: 30 } },
  });
  assert.equal(withActual.isEstimateOnly, false);
  assert.equal(withActual.bySource.stripe_actual.weekly, 30);
});

test('formatMoney trims trailing pence-zeros and handles non-numbers', () => {
  assert.equal(formatMoney(25), '£25');
  assert.equal(formatMoney(108.33), '£108.33');
  assert.equal(formatMoney(null), '—');
});
