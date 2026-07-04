import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCalibration,
  buildStripeAmountsCacheRows,
  buildStripeAmountsMap,
  mapSubscriptionToAmounts,
  previousMonthKey,
  summariseCollectedInvoices,
} from '../../lib/admin/stripe-amounts-helpers.mjs';

const NOW = new Date('2026-07-06T06:00:00Z');

function weeklySub({ id = 'sub_1', customer = 'cus_1', unitAmount = 2500, quantity = 1, status = 'active', paused = false, interval = 'week', intervalCount = 1, coupon = null } = {}) {
  return {
    id,
    customer,
    status,
    pause_collection: paused ? { behavior: 'void' } : null,
    discount: coupon ? { coupon } : null,
    items: {
      data: [{
        quantity,
        price: { unit_amount: unitAmount, currency: 'gbp', recurring: { interval, interval_count: intervalCount } },
      }],
    },
  };
}

test('mapSubscriptionToAmounts converts weekly pence to weekly/monthly pounds', () => {
  const mapped = mapSubscriptionToAmounts(weeklySub({ unitAmount: 2500 }));
  assert.equal(mapped.weekly, 25);
  assert.equal(mapped.monthly, Math.round(25 * (52 / 12) * 100) / 100);
  assert.equal(mapped.interval, 'week');
  assert.equal(mapped.paused, false);
});

test('mapSubscriptionToAmounts handles monthly interval and pause_collection', () => {
  const mapped = mapSubscriptionToAmounts(weeklySub({ unitAmount: 4250, interval: 'month', paused: true }));
  assert.equal(mapped.monthly, 42.5);
  assert.equal(mapped.weekly, Math.round(((42.5 * 12) / 52) * 100) / 100);
  assert.equal(mapped.paused, true);
});

test('mapSubscriptionToAmounts applies percent and amount discounts', () => {
  const pct = mapSubscriptionToAmounts(weeklySub({ unitAmount: 2000, coupon: { percent_off: 50 } }));
  assert.equal(pct.weekly, 10);
  assert.equal(pct.discountPct, 50);

  const off = mapSubscriptionToAmounts(weeklySub({ unitAmount: 2000, coupon: { amount_off: 500 } }));
  assert.equal(off.weekly, 15);
});

test('mapSubscriptionToAmounts returns null for unpriced or unknown intervals', () => {
  assert.equal(mapSubscriptionToAmounts({ items: { data: [] } }), null);
  assert.equal(mapSubscriptionToAmounts(weeklySub({ interval: 'day' })), null);
});

test('buildStripeAmountsCacheRows joins by subscription id first, then best customer subscription', () => {
  const subs = [
    weeklySub({ id: 'sub_direct', customer: 'cus_a', unitAmount: 2500 }),
    weeklySub({ id: 'sub_paused', customer: 'cus_b', unitAmount: 3300, paused: true }),
    weeklySub({ id: 'sub_active', customer: 'cus_b', unitAmount: 3300 }),
  ];
  const students = [
    { mmsId: 'sdt_1', fullName: 'Direct Match', paymentMode: 'stripe', stripeSubscriptionId: 'sub_direct', stripeCustomerId: '' },
    { mmsId: 'sdt_2', fullName: 'Customer Match', paymentMode: 'stripe', stripeSubscriptionId: '', stripeCustomerId: 'cus_b' },
    { mmsId: 'sdt_3', fullName: 'No Stripe', paymentMode: 'stripe', stripeSubscriptionId: '', stripeCustomerId: '' },
    { mmsId: 'sdt_4', fullName: 'Manual Payer', paymentMode: 'manual' },
  ];

  const { rows, unmatchedStudents, unmatchedSubscriptions } = buildStripeAmountsCacheRows(subs, students, { now: NOW });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].mms_id, 'sdt_1');
  assert.equal(rows[0].weekly_amount, 25);
  // active unpaused beats paused for the same customer
  assert.equal(rows[1].stripe_subscription_id, 'sub_active');
  assert.equal(rows[1].paused, 'no');
  assert.equal(unmatchedStudents, 1); // sdt_3 is stripe-managed with no match; manual payer not counted
  assert.equal(unmatchedSubscriptions, 1); // sub_paused matched no student
  assert.equal(rows[0].checked_at, NOW.toISOString());
});

test('buildStripeAmountsMap filters stale and unpriced rows', () => {
  const cacheRows = [
    { mms_id: 'sdt_fresh', weekly_amount: '25', monthly_amount: '108.33', checked_at: '2026-07-06T05:30:00Z' },
    { mms_id: 'sdt_stale', weekly_amount: '33', monthly_amount: '143', checked_at: '2026-06-01T05:30:00Z' },
    { mms_id: 'sdt_zero', weekly_amount: '0', monthly_amount: '0', checked_at: '2026-07-06T05:30:00Z' },
    { mms_id: '', weekly_amount: '25', checked_at: '2026-07-06T05:30:00Z' },
  ];
  const { amounts, count, staleCount } = buildStripeAmountsMap(cacheRows, { now: NOW, maxAgeDays: 14 });

  assert.equal(count, 1);
  assert.equal(staleCount, 1);
  assert.deepEqual(amounts.sdt_fresh, { weekly: 25, monthly: 108.33 });
  assert.equal(amounts.sdt_stale, undefined);
});

test('summariseCollectedInvoices sums paid invoices in the requested month only', () => {
  const june = Math.floor(new Date('2026-06-15T12:00:00Z').getTime() / 1000);
  const july = Math.floor(new Date('2026-07-01T12:00:00Z').getTime() / 1000);
  const invoices = [
    { status: 'paid', amount_paid: 2500, created: june },
    { status: 'paid', amount_paid: 3300, created: june },
    { status: 'paid', amount_paid: 2500, created: july }, // wrong month
    { status: 'open', amount_paid: 2500, created: june }, // not paid
    { status: 'paid', amount_paid: 0, created: june }, // nothing collected
  ];
  const summary = summariseCollectedInvoices(invoices, { month: '2026-06' });

  assert.equal(summary.month, '2026-06');
  assert.equal(summary.collectedTotal, 58);
  assert.equal(summary.invoiceCount, 2);
});

test('previousMonthKey returns the last full calendar month, across year ends', () => {
  assert.equal(previousMonthKey(new Date('2026-07-06T06:00:00Z')), '2026-06');
  assert.equal(previousMonthKey(new Date('2026-01-10T06:00:00Z')), '2025-12');
});

test('buildCalibration prefers the frozen monthly snapshot for the estimate basis', () => {
  const calibration = buildCalibration({
    collectedRows: [{ month: '2026-06', collected_total: '4200', invoice_count: '160' }],
    snapshotRows: [
      { period_type: 'monthly', snapshot_at: '2026-06-01T06:30:00Z', revenue_stripe_weekly: '1000' },
      { period_type: 'weekly', snapshot_at: '2026-06-08T06:00:00Z', revenue_stripe_weekly: '999' },
    ],
    currentStripeWeekly: 1200,
    now: NOW,
  });

  assert.equal(calibration.month, '2026-06');
  assert.equal(calibration.collectedTotal, 4200);
  assert.equal(calibration.estimateBasis, 'monthly_snapshot');
  assert.equal(calibration.estimatedStripeMonthly, Math.round(1000 * (52 / 12) * 100) / 100);
  // (4200 − 4333.33) / 4333.33 ≈ −3.1%
  assert.equal(calibration.deltaPct, -3.1);
});

test('buildCalibration falls back to the current estimate and handles a missing collected row', () => {
  const fallback = buildCalibration({
    collectedRows: [],
    snapshotRows: [],
    currentStripeWeekly: 1200,
    now: NOW,
  });
  assert.equal(fallback.collectedTotal, null);
  assert.equal(fallback.deltaPct, null);
  assert.equal(fallback.estimateBasis, 'current_estimate');
  assert.equal(fallback.estimatedStripeMonthly, Math.round(1200 * (52 / 12) * 100) / 100);
});
