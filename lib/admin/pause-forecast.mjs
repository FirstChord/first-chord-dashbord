import { buildFinanceScenario } from './finance-scenario.mjs';

// Forward "what's coming" forecast from planned pauses. Reads pause planning items
// (created via the structured pause helper), extracts each pause window, and walks
// forward week-by-week — removing students during their window, returning them after —
// running the existing break-even/margin math per week. The grounded middle between the
// past (trend) and the hypothetical (what-if). Pure, read-only.
//
// FORMAT CONTRACT: pause windows are parsed from the planning item notes written by
// buildStructuredPausePlanningDraft:
//   away period → "First lesson to pause date: YYYY-MM-DD" + "Returning from date: YYYY-MM-DD"
//   single      → "Lesson date: YYYY-MM-DD"
// If those lines change, update the regexes below (see docs STATE_TABS_SCHEMA Format Contracts).

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function parseISO(value) {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(`${value || ''}`);
  if (!m) return null;
  // Midnight so windows are clean half-open [start, end) intervals — a return date
  // (the first day back) is the exclusive end and is correctly NOT counted as paused.
  const d = new Date(`${m[1]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isPauseItem(item = {}) {
  return /^pause\b/i.test(`${item.title || ''}`) || /pause type:/i.test(`${item.notes || ''}`);
}

// Extract pause windows [start, end) from planning items. Returns parsed windows and the
// pause items we couldn't read (so they can be surfaced, not silently dropped).
export function parsePauseWindowsFromPlanning(items = []) {
  const windows = [];
  const unparsed = [];

  for (const item of items) {
    if (!isPauseItem(item)) continue;
    const notes = `${item.notes || ''}`;
    const mmsIds = `${item.linkedStudentId || ''}`.split(',').map((s) => s.trim()).filter(Boolean);

    const awayStart = /First lesson to pause date:\s*(\d{4}-\d{2}-\d{2})/i.exec(notes);
    const awayEnd = /Returning from date:\s*(\d{4}-\d{2}-\d{2})/i.exec(notes);
    const single = /Lesson date:\s*(\d{4}-\d{2}-\d{2})/i.exec(notes);

    let start = null;
    let end = null;
    let type = '';
    if (awayStart && awayEnd) {
      start = parseISO(awayStart[1]);
      end = parseISO(awayEnd[1]); // return date = first day back (exclusive end)
      type = 'away';
    } else if (single) {
      start = parseISO(single[1]);
      end = start ? new Date(start.getTime() + DAY_MS) : null; // one missed lesson (one day → its week)
      type = 'single';
    }

    if (!start || !end || end.getTime() <= start.getTime()) {
      unparsed.push({ planningId: item.planningId || '', title: item.title || '' });
      continue;
    }

    if (mmsIds.length) {
      for (const mmsId of mmsIds) windows.push({ planningId: item.planningId || '', mmsId, type, start, end });
    } else {
      windows.push({ planningId: item.planningId || '', mmsId: '', type, start, end });
    }
  }

  return { windows, unparsed };
}

export function buildPauseForecast({
  totals = {},
  activeCount = 0,
  activeMmsIds = null,
  pauseItems = [],
  weeks = 12,
  now = new Date(),
} = {}) {
  const { windows, unparsed } = parsePauseWindowsFromPlanning(pauseItems);
  const activeSet = activeMmsIds ? new Set(activeMmsIds) : null;
  // Only count pauses for students who are currently active (so it's a drop from today's
  // billing base); a student with no mmsId or not in the active set is skipped.
  const relevant = windows.filter((w) => (activeSet ? (w.mmsId && activeSet.has(w.mmsId)) : true));

  const firstMonday = startOfWeek(now);
  const timeline = [];

  for (let i = 0; i < weeks; i += 1) {
    const weekStart = new Date(firstMonday.getTime() + i * WEEK_MS);
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
    const pausedIds = new Set();
    for (const w of relevant) {
      if (w.start.getTime() < weekEnd.getTime() && w.end.getTime() > weekStart.getTime()) {
        pausedIds.add(w.mmsId || `${w.planningId}`);
      }
    }
    const pausedCount = pausedIds.size;
    const projection = buildFinanceScenario(totals, activeCount, { studentsDelta: -pausedCount });
    timeline.push({
      weekStart: weekStart.toISOString().slice(0, 10),
      pausedCount,
      activeProjected: projection.scenario.activeCount,
      marginMonthly: projection.scenario.marginMonthly,
      belowBreakEven: !projection.scenario.aboveBreakEven,
    });
  }

  const base = buildFinanceScenario(totals, activeCount, {});
  const trough = timeline.reduce(
    (worst, wk) => (worst === null || wk.marginMonthly < worst.marginMonthly ? wk : worst),
    null,
  );
  const belowWeeks = timeline.filter((wk) => wk.belowBreakEven);
  // Recovery = first week after the trough that is back above break-even.
  let recoveryWeek = null;
  if (trough) {
    const troughIdx = timeline.findIndex((wk) => wk.weekStart === trough.weekStart);
    recoveryWeek = timeline.slice(troughIdx + 1).find((wk) => !wk.belowBreakEven) || null;
  }

  return {
    weeks: timeline,
    summary: {
      horizonWeeks: weeks,
      baseMarginMonthly: base.scenario.marginMonthly,
      breakEvenActiveCount: base.breakEvenActiveCount,
      maxPausedInAWeek: timeline.reduce((max, wk) => Math.max(max, wk.pausedCount), 0),
      trough: trough ? { weekStart: trough.weekStart, activeProjected: trough.activeProjected, marginMonthly: trough.marginMonthly } : null,
      belowBreakEvenWeeks: belowWeeks.length,
      firstBelowWeek: belowWeeks[0]?.weekStart || null,
      recoveryWeek: recoveryWeek?.weekStart || null,
      windowCount: relevant.length,
      unparsedCount: unparsed.length,
    },
    unparsed,
  };
}
