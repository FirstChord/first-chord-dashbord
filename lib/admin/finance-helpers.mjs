import { derivePaymentValueContext } from './payment-value-helpers.mjs';
import { buildExpenseLogSummary, buildTutorCost, parseExpenses, resolveWeeklyWeight } from './cost-helpers.mjs';

// Read-only revenue run-rate from existing per-student value. This is the foundation
// slice (A): an *estimate* (schedule × price table), clearly labelled. The B-ready
// seam is `resolveStudentRevenue` — when cached Stripe actuals exist, pass them in and
// the same aggregation/UI report real money instead, with no other changes.

const WEEKS_PER_MONTH = 52 / 12;
const WEEKS_PER_YEAR = 52;

const ACTIVE = 'active';
const PAUSED = 'paused';
const SETUP_PENDING = 'setup_pending';

export function formatMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `£${value.toFixed(2).replace(/\.00$/, '')}`;
}

// The single source-of-revenue resolver. Today: estimate only. Later (slice B):
// pass `stripeAmounts[mmsId] = { weekly, monthly?, lessonKind? }` and a present entry
// is preferred, flipping `source` to 'stripe_actual' — aggregation/UI unchanged.
export function resolveStudentRevenue(student = {}, { stripeAmounts = null } = {}) {
  const actual = stripeAmounts && student.mmsId ? stripeAmounts[student.mmsId] : null;
  if (actual && Number.isFinite(actual.weekly)) {
    return {
      weekly: actual.weekly,
      monthly: Number.isFinite(actual.monthly) ? actual.monthly : actual.weekly * WEEKS_PER_MONTH,
      source: 'stripe_actual',
      confidence: 'high',
      lessonKind: actual.lessonKind || '',
      priced: true,
    };
  }

  const value = derivePaymentValueContext(student);
  const weekly = value.baselineWeeklyValue;
  const monthly = value.baselineMonthlyValue;
  return {
    weekly: Number.isFinite(weekly) ? weekly : null,
    monthly: Number.isFinite(monthly) ? monthly : null,
    source: 'estimate',
    confidence: value.confidence,
    lessonKind: value.lessonKind,
    priced: Number.isFinite(weekly),
  };
}

function emptyBucket() {
  return { count: 0, weekly: 0, monthly: 0 };
}

function addToBucket(bucket, rev) {
  bucket.count += 1;
  bucket.weekly += rev.weekly;
  bucket.monthly += rev.monthly;
}

function roundBucket(bucket) {
  const round = (n) => Math.round(n * 100) / 100;
  return { count: bucket.count, weekly: round(bucket.weekly), monthly: round(bucket.monthly) };
}

// Aggregate current recurring run-rate. Only `active` students count toward the live
// figure; paused students are reported separately as "currently not billing"; others
// (waiting/onboarding/needs_review/stopped) are excluded. Returns raw numbers — the
// page formats them.
export function buildRevenueRunRate(students = [], { stripeAmounts = null } = {}) {
  const active = emptyBucket();
  const paused = emptyBucket();
  const byLessonKind = { one_to_one: emptyBucket(), group: emptyBucket(), orchestra: emptyBucket(), unknown: emptyBucket() };
  const byPaymentMode = { stripe: emptyBucket(), manual: emptyBucket(), unknown: emptyBucket() };
  const bySource = { estimate: emptyBucket(), stripe_actual: emptyBucket() };
  let activeUnpriced = 0;
  let setupPendingCount = 0;

  for (const student of students) {
    const status = `${student.lifecycleStatus || ''}`.trim();
    if (status === SETUP_PENDING) setupPendingCount += 1;

    const baseRev = resolveStudentRevenue(student, { stripeAmounts });
    // Scale the run-rate contribution by lesson cadence (e.g. fortnightly = half),
    // leaving the per-lesson price untouched.
    const weight = resolveWeeklyWeight(student);
    const rev = baseRev.priced
      ? { ...baseRev, weekly: baseRev.weekly * weight, monthly: baseRev.monthly * weight }
      : baseRev;

    if (status === PAUSED) {
      paused.count += 1;
      if (rev.priced) {
        paused.weekly += rev.weekly;
        paused.monthly += rev.monthly;
      }
      continue;
    }

    if (status !== ACTIVE) continue;

    active.count += 1;
    if (!rev.priced) {
      activeUnpriced += 1;
      continue;
    }

    active.weekly += rev.weekly;
    active.monthly += rev.monthly;

    const kind = byLessonKind[rev.lessonKind] ? rev.lessonKind : 'unknown';
    addToBucket(byLessonKind[kind], rev);

    const mode = byPaymentMode[student.paymentMode] ? student.paymentMode : 'unknown';
    addToBucket(byPaymentMode[mode], rev);

    const src = bySource[rev.source] ? rev.source : 'estimate';
    addToBucket(bySource[src], rev);
  }

  const round = (n) => Math.round(n * 100) / 100;
  const mapBuckets = (groups) => Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, roundBucket(v)]));

  return {
    active: roundBucket(active),
    paused: roundBucket(paused),
    setupPendingCount,
    activeUnpriced,
    activeAnnual: round(active.weekly * WEEKS_PER_YEAR),
    byLessonKind: mapBuckets(byLessonKind),
    byPaymentMode: mapBuckets(byPaymentMode),
    bySource: mapBuckets(bySource),
    // True once cached Stripe actuals feed in (slice B). Until then the figure is an estimate.
    isEstimateOnly: bySource.stripe_actual.count === 0,
  };
}

// Full read-only financial picture: revenue run-rate − variable tutor pay − salaries −
// fixed overhead = monthly margin. `tutorPay` is a Map from parseTutorPay; `expenseRows`
// are raw Expenses sheet rows. Pure; the page and the snapshot writer both use this.
export function buildFinanceOverview(students = [], { tutorPay = new Map(), expenseRows = [], expenseLogRows = [], stripeAmounts = null, at = new Date() } = {}) {
  const revenue = buildRevenueRunRate(students, { stripeAmounts });
  const cost = buildTutorCost(students, { tutorPay });
  const expenses = parseExpenses(expenseRows);
  const actualSpend = buildExpenseLogSummary(expenseLogRows, { at });

  const round = (n) => Math.round(n * 100) / 100;
  const variableMonthly = cost.variableMonthly;
  const salariedMonthly = cost.salariedMonthly;
  const fixedMonthly = expenses.monthlyTotal;
  const totalCostMonthly = round(variableMonthly + salariedMonthly + fixedMonthly);
  const revenueMonthly = revenue.active.monthly;
  const marginMonthly = round(revenueMonthly - totalCostMonthly);
  const cashViewCostMonthToDate = round(totalCostMonthly + actualSpend.monthTotal);
  const cashViewMarginMonthToDate = round(revenueMonthly - cashViewCostMonthToDate);

  return {
    revenue,
    cost,
    expenses,
    actualSpend,
    totals: {
      revenueMonthly,
      variableMonthly,
      salariedMonthly,
      fixedMonthly,
      totalCostMonthly,
      marginMonthly,
      actualSpendMonthToDate: actualSpend.monthTotal,
      cashViewCostMonthToDate,
      cashViewMarginMonthToDate,
      marginPct: revenueMonthly > 0 ? round((marginMonthly / revenueMonthly) * 100) : null,
      cashViewMarginPct: revenueMonthly > 0 ? round((cashViewMarginMonthToDate / revenueMonthly) * 100) : null,
    },
  };
}

// Flatten an overview into a Finance_Snapshot row (keys match FINANCE_SNAPSHOT_HEADERS).
export function buildFinanceSnapshotRow(overview, { periodType = 'weekly', at = new Date() } = {}) {
  const { revenue, totals } = overview;
  return {
    snapshot_id: `fs_${at.getTime()}_${periodType}`,
    snapshot_at: at.toISOString(),
    period_type: periodType,
    active_count: revenue.active.count,
    paused_count: revenue.paused.count,
    setup_pending_count: revenue.setupPendingCount,
    active_unpriced_count: revenue.activeUnpriced,
    active_weekly_revenue: revenue.active.weekly,
    active_monthly_revenue: revenue.active.monthly,
    paused_weekly_revenue: revenue.paused.weekly,
    revenue_one_to_one_weekly: revenue.byLessonKind.one_to_one.weekly,
    revenue_group_weekly: revenue.byLessonKind.group.weekly,
    revenue_orchestra_weekly: revenue.byLessonKind.orchestra.weekly,
    revenue_stripe_weekly: revenue.byPaymentMode.stripe.weekly,
    revenue_manual_weekly: revenue.byPaymentMode.manual.weekly,
    unpriced_cost_slots: overview.cost.unpricedSlots,
    variable_tutor_monthly: totals.variableMonthly,
    salaried_monthly: totals.salariedMonthly,
    fixed_monthly: totals.fixedMonthly,
    actual_spend_month_to_date: totals.actualSpendMonthToDate,
    cash_view_cost_month_to_date: totals.cashViewCostMonthToDate,
    total_cost_monthly: totals.totalCostMonthly,
    margin_monthly: totals.marginMonthly,
    cash_view_margin_month_to_date: totals.cashViewMarginMonthToDate,
    margin_pct: totals.marginPct ?? '',
    source: revenue.isEstimateOnly ? 'estimate' : 'mixed',
    notes: '',
  };
}
