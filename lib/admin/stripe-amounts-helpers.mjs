// Pure mapping from Stripe API objects to the Stripe_Amounts_Cache rows and the
// stripeAmounts map that resolveStudentRevenue consumes (the "slice B" seam in
// finance-helpers). Amounts are what Stripe would bill (post-discount), converted
// to the same weekly/monthly basis as the estimate — so per-student figures flip
// from 'estimate' to 'stripe_actual' with no aggregation/UI changes.
//
// FORMAT CONTRACT (Stripe API fields relied on — see STATE_TABS_SCHEMA Format
// Contracts): subscription.items.data[].price.unit_amount (pence) ×
// .quantity, price.recurring.interval/interval_count, subscription.pause_collection,
// subscription.discount.coupon.{percent_off,amount_off}, invoice.amount_paid/status/created.

const WEEKS_PER_MONTH = 52 / 12;
const DAY_MS = 24 * 60 * 60 * 1000;

function round(n) {
  return Math.round(n * 100) / 100;
}

function toNumber(value) {
  const parsed = Number.parseFloat(`${value ?? ''}`.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

// Per-period gross for one subscription (pounds), summed across items, with the
// subscription-level coupon applied. Returns null when nothing is priced.
function subscriptionPeriodAmount(subscription = {}) {
  const items = subscription.items?.data || [];
  let pence = 0;
  let priced = false;
  for (const item of items) {
    const unit = Number(item?.price?.unit_amount);
    const quantity = Number(item?.quantity ?? 1);
    if (!Number.isFinite(unit)) continue;
    pence += unit * (Number.isFinite(quantity) ? quantity : 1);
    priced = true;
  }
  if (!priced) return null;

  const coupon = subscription.discount?.coupon || null;
  if (coupon?.percent_off) {
    pence *= 1 - Number(coupon.percent_off) / 100;
  } else if (coupon?.amount_off) {
    pence = Math.max(0, pence - Number(coupon.amount_off));
  }
  return pence / 100;
}

// Normalise one subscription to weekly + monthly pounds. First Chord bills weekly
// (orchestra monthly), but handle month/year intervals so an odd subscription
// still lands on the shared basis instead of silently dropping out.
export function mapSubscriptionToAmounts(subscription = {}) {
  const item = subscription.items?.data?.[0] || null;
  const interval = `${item?.price?.recurring?.interval || ''}`.trim().toLowerCase();
  const intervalCount = Number(item?.price?.recurring?.interval_count) || 1;
  const amount = subscriptionPeriodAmount(subscription);
  if (amount === null || !interval) return null;

  let weekly = null;
  let monthly = null;
  if (interval === 'week') {
    weekly = amount / intervalCount;
    monthly = weekly * WEEKS_PER_MONTH;
  } else if (interval === 'month') {
    monthly = amount / intervalCount;
    weekly = (monthly * 12) / 52;
  } else if (interval === 'year') {
    monthly = amount / (12 * intervalCount);
    weekly = (monthly * 12) / 52;
  } else {
    return null; // day-interval or unknown: not meaningful as a run-rate
  }

  const coupon = subscription.discount?.coupon || null;
  return {
    subscriptionId: `${subscription.id || ''}`,
    customerId: `${subscription.customer || ''}`,
    status: `${subscription.status || ''}`.trim().toLowerCase(),
    paused: Boolean(subscription.pause_collection),
    interval,
    weekly: round(weekly),
    monthly: round(monthly),
    currency: `${item?.price?.currency || 'gbp'}`.toLowerCase(),
    discountPct: coupon?.percent_off ? Number(coupon.percent_off) : '',
  };
}

// Prefer the subscription that best represents what the student is billed:
// active unpaused first, then active paused, then anything else, newest first.
function scoreSubscription(mapped) {
  if (mapped.status === 'active' && !mapped.paused) return 0;
  if (mapped.status === 'active') return 1;
  if (mapped.status === 'trialing') return 2;
  return 3;
}

// Join Stripe subscriptions to students by subscription id first (exact), then by
// customer id (best subscription wins). Returns cache rows (keys match
// STRIPE_AMOUNTS_CACHE_HEADERS) plus unmatched counts for the cron response.
export function buildStripeAmountsCacheRows(subscriptions = [], students = [], { now = new Date() } = {}) {
  const bySubscriptionId = new Map();
  const byCustomerId = new Map();
  for (const raw of subscriptions) {
    const mapped = mapSubscriptionToAmounts(raw);
    if (!mapped) continue;
    if (mapped.subscriptionId) bySubscriptionId.set(mapped.subscriptionId, mapped);
    if (mapped.customerId) {
      const current = byCustomerId.get(mapped.customerId);
      if (!current || scoreSubscription(mapped) < scoreSubscription(current)) {
        byCustomerId.set(mapped.customerId, mapped);
      }
    }
  }

  const rows = [];
  const matchedSubscriptionIds = new Set();
  let unmatchedStudents = 0;
  const checkedAt = now.toISOString();

  for (const student of students) {
    if (!student?.mmsId) continue;
    const subId = `${student.stripeSubscriptionId || ''}`.trim();
    const custId = `${student.stripeCustomerId || ''}`.trim();
    const mapped = (subId && bySubscriptionId.get(subId)) || (custId && byCustomerId.get(custId)) || null;
    if (!mapped) {
      if (student.paymentMode === 'stripe') unmatchedStudents += 1;
      continue;
    }
    matchedSubscriptionIds.add(mapped.subscriptionId);
    rows.push({
      mms_id: student.mmsId,
      student_name: student.fullName || '',
      stripe_customer_id: mapped.customerId,
      stripe_subscription_id: mapped.subscriptionId,
      subscription_status: mapped.status,
      paused: mapped.paused ? 'yes' : 'no',
      interval: mapped.interval,
      weekly_amount: mapped.weekly,
      monthly_amount: mapped.monthly,
      currency: mapped.currency,
      discount_pct: mapped.discountPct,
      checked_at: checkedAt,
    });
  }

  const unmatchedSubscriptions = [...bySubscriptionId.keys()].filter((id) => !matchedSubscriptionIds.has(id)).length;
  return { rows, unmatchedStudents, unmatchedSubscriptions };
}

// Cache rows → the stripeAmounts map resolveStudentRevenue expects. A stale cache
// (dead cron) degrades honestly: rows older than maxAgeDays are ignored and those
// students fall back to the estimate.
export function buildStripeAmountsMap(cacheRows = [], { now = new Date(), maxAgeDays = 14 } = {}) {
  const map = {};
  const cutoff = now.getTime() - maxAgeDays * DAY_MS;
  let staleCount = 0;
  for (const row of cacheRows) {
    const mmsId = `${row.mms_id ?? row.mmsId ?? ''}`.trim();
    const weekly = toNumber(row.weekly_amount ?? row.weeklyAmount);
    const monthly = toNumber(row.monthly_amount ?? row.monthlyAmount);
    if (!mmsId || !Number.isFinite(weekly) || weekly <= 0) continue;
    const checkedAt = new Date(`${row.checked_at ?? row.checkedAt ?? ''}`);
    if (Number.isNaN(checkedAt.getTime()) || checkedAt.getTime() < cutoff) {
      staleCount += 1;
      continue;
    }
    map[mmsId] = {
      weekly,
      monthly: Number.isFinite(monthly) ? monthly : round(weekly * WEEKS_PER_MONTH),
    };
  }
  return { amounts: map, count: Object.keys(map).length, staleCount };
}

// Sum what Stripe actually collected in a calendar month ('YYYY-MM'): paid
// invoices, amount_paid (pence), bucketed by invoice creation time.
export function summariseCollectedInvoices(invoices = [], { month = '' } = {}) {
  const key = `${month || ''}`.trim();
  let totalPence = 0;
  let invoiceCount = 0;
  for (const invoice of invoices) {
    if (`${invoice?.status || ''}`.trim().toLowerCase() !== 'paid') continue;
    const created = Number(invoice?.created);
    if (!Number.isFinite(created)) continue;
    const createdMonth = new Date(created * 1000).toISOString().slice(0, 7);
    if (key && createdMonth !== key) continue;
    const paid = Number(invoice?.amount_paid);
    if (!Number.isFinite(paid) || paid <= 0) continue;
    totalPence += paid;
    invoiceCount += 1;
  }
  return { month: key, collectedTotal: round(totalPence / 100), invoiceCount };
}

// The last full calendar month for a given date (the cron calibrates against a
// completed month, never the in-progress one).
export function previousMonthKey(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

// The calibration read: last full month's Stripe collections vs what the estimate
// said Stripe-managed students should bill that month. Prefers the frozen monthly
// snapshot from that month (like-for-like basis); falls back to the caller's
// current Stripe-mode weekly estimate, flagged via estimateBasis. Shared by the
// finance page and the JSON overview endpoint.
export function buildCalibration({ collectedRows = [], snapshotRows = [], currentStripeWeekly = null, now = new Date() } = {}) {
  const month = previousMonthKey(now);
  const collectedRow = collectedRows.find((row) => `${row.month || ''}`.trim() === month) || null;
  const collectedTotal = collectedRow ? toNumber(collectedRow.collected_total ?? collectedRow.collectedTotal) : null;
  const invoiceCount = collectedRow ? toNumber(collectedRow.invoice_count ?? collectedRow.invoiceCount) : null;
  const monthSnapshot = snapshotRows
    .filter((row) => `${row.period_type || ''}`.trim() === 'monthly' && `${row.snapshot_at || ''}`.startsWith(month))
    .sort((a, b) => `${b.snapshot_at || ''}`.localeCompare(`${a.snapshot_at || ''}`))[0] || null;
  const weekly = monthSnapshot ? toNumber(monthSnapshot.revenue_stripe_weekly) : toNumber(currentStripeWeekly);
  const estimatedStripeMonthly = Number.isFinite(weekly) ? round(weekly * WEEKS_PER_MONTH) : null;
  const deltaPct = Number.isFinite(collectedTotal) && Number.isFinite(estimatedStripeMonthly) && estimatedStripeMonthly > 0
    ? Math.round(((collectedTotal - estimatedStripeMonthly) / estimatedStripeMonthly) * 1000) / 10
    : null;
  return {
    month,
    collectedTotal,
    invoiceCount,
    estimatedStripeMonthly,
    estimateBasis: monthSnapshot ? 'monthly_snapshot' : 'current_estimate',
    deltaPct,
  };
}
