/** @fileoverview Blind monthly Stripe forecasts and student-level reconciliation. */

import { resolveWeeklyWeight } from './cost-helpers.mjs';
import { PRICE_ASSUMPTIONS_VERSION } from './finance-assumptions.mjs';
import { derivePaymentValueContext } from './payment-value-helpers.mjs';
import { parsePauseWindowsFromPlanning } from './pause-forecast.mjs';

const DAY_INDEX = new Map([
  ['sunday', 0],
  ['monday', 1],
  ['tuesday', 2],
  ['wednesday', 3],
  ['thursday', 4],
  ['friday', 5],
  ['saturday', 6],
]);
const WEEKS_PER_MONTH = 52 / 12;
const FORECAST_METHOD = 'dashboard_price_x_calendar_v1';

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function toNumber(value) {
  const parsed = Number.parseFloat(`${value ?? ''}`.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMonth(month) {
  const key = clean(month);
  if (!/^\d{4}-\d{2}$/u.test(key)) throw new Error('Forecast month must use YYYY-MM');
  const start = new Date(`${key}-01T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 7) !== key) {
    throw new Error('Forecast month must be valid');
  }
  return start;
}

export function currentMonthKey(at = new Date()) {
  const parsed = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(parsed.getTime())) throw new Error('A valid forecast time is required');
  return parsed.toISOString().slice(0, 7);
}

function previousMonthKey(at = new Date()) {
  const parsed = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(parsed.getTime())) throw new Error('A valid reconciliation time is required');
  const previous = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() - 1, 1));
  return previous.toISOString().slice(0, 7);
}

function weekdayDates(month, weekday) {
  const start = parseMonth(month);
  const target = DAY_INDEX.get(clean(weekday).toLowerCase());
  if (!Number.isInteger(target)) return [];
  const dates = [];
  const cursor = new Date(start);
  while (cursor.toISOString().slice(0, 7) === month) {
    if (cursor.getUTCDay() === target) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function dateInsideWindow(date, window) {
  const at = Date.parse(`${date}T00:00:00Z`);
  return at >= window.start.getTime() && at < window.end.getTime();
}

function compactForecastItem(student, { month, pauseWindows }) {
  const mmsId = clean(student.mmsId);
  const studentName = clean(student.fullName);
  const lifecycle = clean(student.lifecycleStatus).toLowerCase();
  const expectation = clean(student.paymentExpectation).toLowerCase();
  const value = derivePaymentValueContext(student);
  const lessonFrequency = clean(student.lessonFrequency || student.registry?.lessonFrequency) || 'weekly';
  const weekday = clean(student.scheduleContext?.usualWeekday);
  const base = {
    mms_id: mmsId,
    student_name: studentName,
    expected_amount: null,
    billing_basis: '',
    confidence: value.confidence || 'low',
    weekly_amount: Number.isFinite(value.baselineWeeklyValue) ? round(value.baselineWeeklyValue) : null,
    expected_occurrences: null,
    usual_weekday: weekday,
    lesson_kind: value.lessonKind || 'unknown',
    lesson_frequency: lessonFrequency,
  };

  if (lifecycle !== 'active' || expectation === 'stripe_paused_expected' || expectation === 'inactive_or_stopped') {
    return {
      ...base,
      expected_amount: 0,
      billing_basis: lifecycle === 'paused' || expectation === 'stripe_paused_expected'
        ? 'paused_expected'
        : 'not_expected_to_bill',
      confidence: 'high',
      expected_occurrences: 0,
    };
  }

  if (!Number.isFinite(value.baselineWeeklyValue)) {
    return { ...base, billing_basis: 'unpriced' };
  }

  if (value.lessonKind === 'orchestra' && Number.isFinite(value.baselineMonthlyValue)) {
    return {
      ...base,
      expected_amount: round(value.baselineMonthlyValue),
      billing_basis: 'monthly_price',
      expected_occurrences: 1,
    };
  }

  const scheduledDates = weekdayDates(month, weekday);
  if (!scheduledDates.length) {
    return {
      ...base,
      expected_amount: round(value.baselineWeeklyValue * WEEKS_PER_MONTH * resolveWeeklyWeight(student)),
      billing_basis: 'average_month_no_weekday',
      confidence: 'low',
      expected_occurrences: null,
    };
  }

  const studentWindows = pauseWindows.filter((window) => window.mmsId === mmsId);
  const billableDates = scheduledDates.filter((date) => !studentWindows.some((window) => dateInsideWindow(date, window)));
  const expectedOccurrences = round(billableDates.length * resolveWeeklyWeight(student));
  return {
    ...base,
    expected_amount: round(value.baselineWeeklyValue * expectedOccurrences),
    billing_basis: studentWindows.length ? 'calendar_less_structured_pauses' : 'calendar_weekday',
    confidence: value.confidence === 'high' ? 'medium' : value.confidence || 'low',
    expected_occurrences: expectedOccurrences,
  };
}

export function buildStripeMonthlyForecast({ students = [], planningRows = [], month = '', forecastedAt = new Date() } = {}) {
  const at = forecastedAt instanceof Date ? forecastedAt : new Date(forecastedAt);
  if (Number.isNaN(at.getTime())) throw new Error('A valid forecast time is required');
  const targetMonth = month || currentMonthKey(at);
  parseMonth(targetMonth);
  const { windows, unparsed } = parsePauseWindowsFromPlanning(planningRows);
  const items = students
    .filter((student) => clean(student.paymentMode).toLowerCase() === 'stripe')
    .filter((student) => clean(student.mmsId))
    .map((student) => compactForecastItem(student, { month: targetMonth, pauseWindows: windows }))
    .sort((left, right) => left.student_name.localeCompare(right.student_name));
  const pricedItems = items.filter((item) => Number.isFinite(item.expected_amount));
  const nonZeroItems = pricedItems.filter((item) => item.expected_amount > 0);
  const approximateCount = pricedItems.filter((item) => item.confidence !== 'high').length;

  return {
    month: targetMonth,
    forecastedAt: at.toISOString(),
    forecastTotal: round(pricedItems.reduce((sum, item) => sum + item.expected_amount, 0)),
    candidateStudentCount: items.length,
    forecastedStudentCount: pricedItems.length,
    billedStudentCount: nonZeroItems.length,
    zeroExpectedCount: pricedItems.length - nonZeroItems.length,
    unpricedCount: items.length - pricedItems.length,
    approximateCount,
    coveragePct: items.length ? round((pricedItems.length / items.length) * 100) : null,
    unparsedPauseCount: unparsed.length,
    method: FORECAST_METHOD,
    assumptionsVersion: PRICE_ASSUMPTIONS_VERSION,
    items,
  };
}

export function buildStripeForecastRow(forecast = {}) {
  // Keep the evidence cell comfortably below Google Sheets' 50k character
  // limit as the roster grows. These seven fields are sufficient to reproduce
  // every comparison and diagnose the forecast basis; richer live student
  // context remains in its authoritative lanes.
  const compactItems = (Array.isArray(forecast.items) ? forecast.items : []).map((item) => ({
    mms_id: item.mms_id,
    name: item.student_name,
    amount: item.expected_amount,
    basis: item.billing_basis,
    confidence: item.confidence,
    weekly: item.weekly_amount,
    occurrences: item.expected_occurrences,
  }));
  const itemsJson = JSON.stringify(compactItems);
  if (itemsJson.length > 45_000) {
    throw new Error('Stripe forecast evidence is too large for one Sheets cell; move detail to a dedicated lane before revealing Stripe');
  }
  return {
    month: clean(forecast.month),
    forecasted_at: clean(forecast.forecastedAt),
    forecast_total: Number.isFinite(forecast.forecastTotal) ? forecast.forecastTotal : '',
    candidate_student_count: Number.isFinite(forecast.candidateStudentCount) ? forecast.candidateStudentCount : '',
    forecasted_student_count: Number.isFinite(forecast.forecastedStudentCount) ? forecast.forecastedStudentCount : '',
    billed_student_count: Number.isFinite(forecast.billedStudentCount) ? forecast.billedStudentCount : '',
    zero_expected_count: Number.isFinite(forecast.zeroExpectedCount) ? forecast.zeroExpectedCount : '',
    unpriced_count: Number.isFinite(forecast.unpricedCount) ? forecast.unpricedCount : '',
    approximate_count: Number.isFinite(forecast.approximateCount) ? forecast.approximateCount : '',
    coverage_pct: Number.isFinite(forecast.coveragePct) ? forecast.coveragePct : '',
    unparsed_pause_count: Number.isFinite(forecast.unparsedPauseCount) ? forecast.unparsedPauseCount : '',
    method: clean(forecast.method) || FORECAST_METHOD,
    assumptions_version: clean(forecast.assumptionsVersion) || PRICE_ASSUMPTIONS_VERSION,
    items_json: itemsJson,
  };
}

export function findMonthlyStripeForecast(forecastRows = [], { month = '' } = {}) {
  const key = clean(month);
  return forecastRows
    .filter((row) => clean(row.month) === key)
    .sort((left, right) => clean(left.forecasted_at).localeCompare(clean(right.forecasted_at)))[0] || null;
}

export async function ensureMonthlyStripeForecast({
  at = new Date(),
  getForecastRows,
  buildForecastRow,
  appendForecastRow,
} = {}) {
  if (typeof getForecastRows !== 'function') throw new Error('getForecastRows is required');
  if (typeof buildForecastRow !== 'function') throw new Error('buildForecastRow is required');
  if (typeof appendForecastRow !== 'function') throw new Error('appendForecastRow is required');
  const month = currentMonthKey(at);
  const existing = findMonthlyStripeForecast(await getForecastRows(), { month });
  if (existing) return { row: existing, skipped: true, reason: 'monthly_forecast_exists' };
  const row = await buildForecastRow({ month, forecastedAt: at });
  const result = await appendForecastRow(row);
  return {
    row,
    skipped: result?.appended === false,
    reason: result?.appended === false ? 'monthly_forecast_exists' : '',
  };
}

function parseItems(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(clean(value) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function buildStripeReconciliation({ forecastRows = [], collectedRows = [], now = new Date() } = {}) {
  const month = previousMonthKey(now);
  const forecastRow = findMonthlyStripeForecast(forecastRows, { month });
  const collectedRow = collectedRows.find((row) => clean(row.month) === month) || null;
  const forecastItems = parseItems(forecastRow?.items_json ?? forecastRow?.itemsJson);
  const actualItems = parseItems(collectedRow?.student_breakdown_json ?? collectedRow?.studentBreakdownJson);
  const forecastById = new Map(forecastItems.map((item) => [clean(item.mms_id ?? item.mmsId), item]).filter(([id]) => id));
  const actualById = new Map(actualItems.map((item) => [clean(item.mms_id ?? item.mmsId), item]).filter(([id]) => id));
  const ids = new Set([...forecastById.keys(), ...actualById.keys()]);
  const differences = [...ids].map((mmsId) => {
    const forecast = forecastById.get(mmsId) || null;
    const actual = actualById.get(mmsId) || null;
    const expectedAmount = forecast ? toNumber(forecast.amount ?? forecast.expected_amount ?? forecast.expectedAmount) : 0;
    const actualAmount = actual ? toNumber(actual.amount) ?? 0 : 0;
    const difference = Number.isFinite(expectedAmount) ? round(actualAmount - expectedAmount) : null;
    let status = 'matched';
    if (!Number.isFinite(expectedAmount)) status = 'unpriced_forecast';
    else if (!forecast && actualAmount > 0) status = 'unforecast_collection';
    else if (!actual && expectedAmount > 0) status = 'no_paid_invoice';
    else if (Math.abs(difference) > 0.009) status = 'amount_mismatch';
    return {
      mmsId,
      studentName: clean(forecast?.name ?? forecast?.student_name ?? forecast?.studentName ?? actual?.student_name ?? actual?.studentName),
      expectedAmount,
      actualAmount,
      difference,
      invoiceCount: toNumber(actual?.invoice_count ?? actual?.invoiceCount) ?? 0,
      status,
    };
  });
  const actionable = differences
    .filter((item) => item.status !== 'matched')
    .sort((left, right) => Math.abs(right.difference ?? right.actualAmount) - Math.abs(left.difference ?? left.actualAmount));
  const collectedTotal = toNumber(collectedRow?.collected_total ?? collectedRow?.collectedTotal);
  const forecastTotal = toNumber(forecastRow?.forecast_total ?? forecastRow?.forecastTotal);
  const unmatchedActualTotal = toNumber(collectedRow?.unmatched_total ?? collectedRow?.unmatchedTotal) ?? 0;
  const netDifference = Number.isFinite(collectedTotal) && Number.isFinite(forecastTotal)
    ? round(collectedTotal - forecastTotal)
    : null;
  const deltaPct = Number.isFinite(netDifference) && forecastTotal > 0
    ? round((netDifference / forecastTotal) * 100)
    : null;
  const breakdownAvailable = Boolean(forecastRow && collectedRow && clean(collectedRow?.student_breakdown_json ?? collectedRow?.studentBreakdownJson));
  const itemAbsoluteError = breakdownAvailable
    ? differences.reduce((sum, item) => sum + (Number.isFinite(item.difference) ? Math.abs(item.difference) : Math.abs(item.actualAmount)), 0)
    : null;
  const totalAbsoluteError = Number.isFinite(itemAbsoluteError) ? round(itemAbsoluteError + unmatchedActualTotal) : null;
  const offsettingError = Number.isFinite(totalAbsoluteError) && Number.isFinite(netDifference)
    ? round(Math.max(0, totalAbsoluteError - Math.abs(netDifference)) / 2)
    : null;

  return {
    month,
    forecastPresent: Boolean(forecastRow),
    actualPresent: Boolean(collectedRow),
    breakdownAvailable,
    forecastedAt: forecastRow?.forecasted_at || null,
    refreshedAt: collectedRow?.refreshed_at || null,
    forecastTotal,
    collectedTotal,
    invoiceCount: toNumber(collectedRow?.invoice_count ?? collectedRow?.invoiceCount),
    netDifference,
    deltaPct,
    totalAbsoluteError,
    offsettingError,
    unmatchedActualTotal,
    unmatchedInvoiceCount: toNumber(collectedRow?.unmatched_invoice_count ?? collectedRow?.unmatchedInvoiceCount) ?? 0,
    matchedCollectionPct: Number.isFinite(collectedTotal) && collectedTotal > 0
      ? round(((collectedTotal - unmatchedActualTotal) / collectedTotal) * 100)
      : null,
    forecastCoveragePct: toNumber(forecastRow?.coverage_pct ?? forecastRow?.coveragePct),
    unpricedCount: toNumber(forecastRow?.unpriced_count ?? forecastRow?.unpricedCount) ?? 0,
    approximateCount: toNumber(forecastRow?.approximate_count ?? forecastRow?.approximateCount) ?? 0,
    mismatchCount: actionable.length,
    differences: actionable,
  };
}
