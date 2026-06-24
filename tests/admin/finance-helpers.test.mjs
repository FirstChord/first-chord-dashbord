import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveStudentRevenue,
  buildRevenueRunRate,
  buildFinanceOverview,
  buildFinanceSnapshotRow,
  formatMoney,
} from '../../lib/admin/finance-helpers.mjs';
import { parseTutorPay } from '../../lib/admin/cost-helpers.mjs';

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

test('buildRevenueRunRate scales a fortnightly student to half its weekly value', () => {
  const weekly = buildRevenueRunRate([oneToOne30({ mmsId: 'a' })]);
  const fortnightly = buildRevenueRunRate([oneToOne30({ mmsId: 'a', lessonFrequency: 'fortnightly' })]);
  assert.equal(weekly.active.weekly, 25);
  assert.equal(fortnightly.active.weekly, 12.5);
  assert.equal(fortnightly.active.count, 1); // still one student
});

test('buildFinanceOverview composes revenue minus variable, salaries and fixed into margin', () => {
  const students = [
    // hourly tutor (Patrick), 60-min 1:1 => £24/wk revenue, £24/wk cost
    { mmsId: 'a', fullName: 'A', lifecycleStatus: 'active', paymentMode: 'stripe', registryTutor: 'Patrick', instrument: 'Guitar', scheduleContext: { status: 'found', durationMinutes: '60' } },
  ];
  const tutorPay = parseTutorPay([{ tutor: 'Salaried Tutor', pay_model: 'salary', monthly_salary: '1000' }]);
  const expenseRows = [{ name: 'Rent', amount: '1100', period: 'monthly' }];
  const expenseLogRows = [{ expense_id: 'e1', date: '2026-06-24', amount: '50', category: 'Room improvement', description: 'Paint' }];
  const o = buildFinanceOverview(students, { tutorPay, expenseRows, expenseLogRows, at: new Date('2026-06-24T12:00:00Z') });

  const weeksPerMonth = 52 / 12;
  const round = (n) => Math.round(n * 100) / 100;
  const gross = round(41.5 * weeksPerMonth);
  const vat = round(gross * 0.11);
  const net = round(gross - vat);
  assert.equal(o.totals.revenueMonthly, gross); // gross turnover (back-compat key)
  assert.equal(o.totals.grossRevenueMonthly, gross);
  assert.equal(o.totals.vatRate, 0.11);
  assert.equal(o.totals.vatLiabilityMonthly, vat);
  assert.equal(o.totals.netRevenueMonthly, net);
  assert.equal(o.totals.variableMonthly, round(24 * weeksPerMonth));
  assert.equal(o.totals.salariedMonthly, 1000);
  assert.equal(o.totals.fixedMonthly, 1100);
  assert.equal(o.totals.actualSpendMonthToDate, 50);
  // margin is on NET (after-VAT) revenue
  assert.equal(o.totals.marginMonthly, round(net - o.totals.variableMonthly - 1000 - 1100));
  assert.equal(o.totals.cashViewMarginMonthToDate, round(o.totals.marginMonthly - 50));
});

test('buildFinanceOverview deducts Flat Rate VAT from revenue before margin', () => {
  const students = [oneToOne30({ mmsId: 'a' })]; // 30-min 1:1 → £25/wk gross
  const o = buildFinanceOverview(students, {});
  const weeksPerMonth = 52 / 12;
  const round = (n) => Math.round(n * 100) / 100;
  const gross = round(25 * weeksPerMonth);
  assert.equal(o.totals.grossRevenueMonthly, gross);
  assert.equal(o.totals.vatLiabilityMonthly, round(gross * 0.11));
  assert.equal(o.totals.netRevenueMonthly, round(gross - gross * 0.11));
  // margin is net revenue minus costs (this student carries default hourly tutor cost)
  assert.equal(o.totals.marginMonthly, round(o.totals.netRevenueMonthly - o.totals.totalCostMonthly));
});

test('buildFinanceSnapshotRow keeps estimate quality counters flat and visible', () => {
  const overview = buildFinanceOverview([
    oneToOne30({ mmsId: 'priced' }),
    { mmsId: 'unpriced-revenue', lifecycleStatus: 'active', paymentMode: 'stripe', instrument: 'Piano', lessonLength: '35' },
    { mmsId: 'unpriced-cost', fullName: 'Unknown Duration', lifecycleStatus: 'active', paymentMode: 'stripe', registryTutor: 'Patrick', instrument: 'Guitar' },
  ], {
    expenseLogRows: [{ expense_id: 'e1', date: '2026-06-24', amount: '35', category: 'Equipment', description: 'Stool' }],
    at: new Date('2026-06-24T12:00:00Z'),
  });
  const row = buildFinanceSnapshotRow(overview, { periodType: 'weekly', at: new Date('2026-06-24T12:00:00Z') });

  assert.equal(row.period_type, 'weekly');
  assert.equal(row.active_unpriced_count, 2);
  assert.equal(row.unpriced_cost_slots, 1);
  assert.equal(row.actual_spend_month_to_date, 35);
  assert.equal(row.cash_view_margin_month_to_date, overview.totals.cashViewMarginMonthToDate);
  assert.equal(row.source, 'estimate');
});

test('formatMoney trims trailing pence-zeros and handles non-numbers', () => {
  assert.equal(formatMoney(25), '£25');
  assert.equal(formatMoney(108.33), '£108.33');
  assert.equal(formatMoney(null), '—');
});
