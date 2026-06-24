// Pure foundation for the finance trend view. Reads append-only Finance_Snapshot rows
// and returns a clean, typed time series: one point per period (deduped), sorted, with
// explicit gaps (never synthetic zeros), period keys for like-for-like comparison, and
// week-over-week deltas. The chart sits on top of this; a future agent/tool can consume
// the same structured output. Data only — no interpretation.

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const METRIC_KEYS = ['revenueMonthly', 'marginMonthly', 'activeCount'];

function toNum(value) {
  const n = Number.parseFloat(`${value ?? ''}`.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// ISO-8601 week (weeks start Monday; week belongs to the year of its Thursday).
function isoWeekParts(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // move to the Thursday of this week
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / MS_PER_WEEK);
  return { isoYear, week, thursdayTime: d.getTime() };
}

// A monotonic integer per period so consecutive periods differ by exactly 1 (gap math),
// plus a human/comparison key.
function periodInfo(date, period) {
  if (period === 'monthly') {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth(); // 0-11
    return { key: `${y}-${String(m + 1).padStart(2, '0')}`, index: y * 12 + m };
  }
  const { isoYear, week, thursdayTime } = isoWeekParts(date);
  return { key: `${isoYear}-W${String(week).padStart(2, '0')}`, index: Math.round(thursdayTime / MS_PER_WEEK) };
}

export function buildFinanceTrend(rows = [], { period = 'weekly', limit = 12 } = {}) {
  const wanted = period === 'monthly' ? 'monthly' : 'weekly';

  // One point per period, keeping the latest snapshot if the cron fired more than once.
  const byKey = new Map();
  for (const row of rows) {
    if (`${row.period_type || ''}`.trim() !== wanted) continue;
    const at = `${row.snapshot_at || ''}`.trim();
    const date = at ? new Date(at) : null;
    if (!date || Number.isNaN(date.getTime())) continue;

    const { key, index } = periodInfo(date, wanted);
    const point = {
      periodKey: key,
      periodIndex: index,
      at,
      date: at.slice(0, 10),
      activeCount: toNum(row.active_count),
      pausedCount: toNum(row.paused_count),
      revenueMonthly: toNum(row.active_monthly_revenue),
      weeklyRevenue: toNum(row.active_weekly_revenue),
      marginMonthly: toNum(row.margin_monthly),
      source: `${row.source || 'estimate'}`.trim() || 'estimate',
      gapBefore: false,
    };

    const existing = byKey.get(key);
    if (!existing || new Date(point.at).getTime() >= new Date(existing.at).getTime()) {
      byKey.set(key, point);
    }
  }

  let points = [...byKey.values()].sort((a, b) => a.periodIndex - b.periodIndex);

  // Gaps are honest holes in the series, not zeros — flag the point after a gap and
  // count missing periods (computed across the full series before trimming to the window).
  let gapCount = 0;
  for (let i = 1; i < points.length; i += 1) {
    const missing = points[i].periodIndex - points[i - 1].periodIndex - 1;
    if (missing > 0) {
      points[i].gapBefore = true;
      gapCount += missing;
    }
  }

  if (limit && points.length > limit) {
    points = points.slice(points.length - limit);
  }

  const summary = {
    count: points.length,
    firstPeriod: points[0]?.periodKey || null,
    lastPeriod: points[points.length - 1]?.periodKey || null,
    gapCount,
    sourceMix: { estimate: 0, mixed: 0 },
  };
  for (const point of points) {
    if (point.source === 'mixed') summary.sourceMix.mixed += 1;
    else summary.sourceMix.estimate += 1;
  }
  for (const key of METRIC_KEYS) {
    const values = points.map((p) => p[key]).filter((v) => Number.isFinite(v));
    summary[key] = {
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      latest: points.length ? points[points.length - 1][key] : null,
    };
  }

  // Latest vs previous period (week-over-week / month-over-month).
  let deltas = null;
  if (points.length >= 2) {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    deltas = {};
    for (const key of METRIC_KEYS) {
      const a = last[key];
      const b = prev[key];
      const abs = Number.isFinite(a) && Number.isFinite(b) ? Math.round((a - b) * 100) / 100 : null;
      const pct = Number.isFinite(abs) && Number.isFinite(b) && b !== 0 ? Math.round((abs / b) * 1000) / 10 : null;
      deltas[key] = { abs, pct };
    }
  }

  return {
    period: wanted,
    points,
    latest: points.length ? points[points.length - 1] : null,
    deltas,
    summary,
  };
}
