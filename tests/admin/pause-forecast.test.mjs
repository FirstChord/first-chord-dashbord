import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePauseWindowsFromPlanning, buildPauseForecast } from '../../lib/admin/pause-forecast.mjs';

// net 11000, variable 4000, salaried 5000, fixed 1000, 100 active → break-even 86, base margin 1000
const totals = { netRevenueMonthly: 11000, variableMonthly: 4000, salariedMonthly: 5000, fixedMonthly: 1000 };
const NOW = new Date('2026-07-01T09:00:00Z');

const awayItem = (mmsId, start, end, planningId = `p_${mmsId}`) => ({
  planningId,
  title: `Pause Student ${mmsId} from x; returning y`,
  notes: `Pause type: away period.\nFirst lesson to pause date: ${start}.\nReturning from date: ${end}.`,
  linkedStudentId: mmsId,
});

const singleItem = (mmsId, date) => ({
  planningId: `s_${mmsId}`,
  title: `Pause Student ${mmsId} lesson on x`,
  notes: `Pause type: single lesson.\nLesson date: ${date}.`,
  linkedStudentId: mmsId,
});

test('parses away-period and single pause windows, flags unparseable ones', () => {
  const { windows, unparsed } = parsePauseWindowsFromPlanning([
    awayItem('a', '2026-07-06', '2026-08-17'),
    singleItem('b', '2026-07-13'),
    { planningId: 'x', title: 'Pause Bob', notes: 'Pause type: away period.', linkedStudentId: 'c' }, // no dates
    { planningId: 'n', title: 'Email a parent', notes: 'not a pause' }, // not a pause
  ]);
  assert.equal(windows.length, 2);
  assert.equal(unparsed.length, 1);
  const away = windows.find((w) => w.mmsId === 'a');
  assert.equal(away.type, 'away');
  assert.equal(away.start.toISOString().slice(0, 10), '2026-07-06');
  assert.equal(away.end.toISOString().slice(0, 10), '2026-08-17');
});

test('explicit is_pause flag overrides content: converted-to-general drops out, flagged-pause stays', () => {
  const { windows } = parsePauseWindowsFromPlanning([
    // Looks like a pause by content, but was converted to a general card.
    { ...awayItem('a', '2026-07-06', '2026-08-17'), isPause: 'false' },
    // Explicitly a pause and has parseable dates.
    { ...awayItem('b', '2026-07-06', '2026-08-17'), isPause: 'true' },
  ]);

  assert.deepEqual(windows.map((window) => window.mmsId), ['b']);
});

test('parked pause planning items are ignored but done items still forecast', () => {
  const { windows } = parsePauseWindowsFromPlanning([
    { ...awayItem('a', '2026-07-06', '2026-08-17'), status: 'parked' },
    { ...awayItem('b', '2026-07-06', '2026-08-17'), status: 'done' },
  ]);

  assert.deepEqual(windows.map((window) => window.mmsId), ['b']);
});

test('counts overlapping pauses per week and reduces margin', () => {
  const forecast = buildPauseForecast({
    totals,
    activeCount: 100,
    pauseItems: [awayItem('a', '2026-07-06', '2026-08-17'), singleItem('b', '2026-07-13')],
    weeks: 12,
    now: NOW,
  });
  // the week containing 13 Jul has both 'a' (away, ongoing) and 'b' (single) paused
  const wk = forecast.weeks.find((w) => w.weekStart === '2026-07-13');
  assert.equal(wk.pausedCount, 2);
  assert.equal(wk.activeProjected, 98);
  assert.ok(wk.marginMonthly < forecast.summary.baseMarginMonthly);
  assert.equal(forecast.summary.maxPausedInAWeek, 2);
});

test('only counts pauses for currently-active students when activeMmsIds is given', () => {
  const forecast = buildPauseForecast({
    totals,
    activeCount: 100,
    activeMmsIds: ['a'], // 'b' is not active → ignored
    pauseItems: [awayItem('a', '2026-07-06', '2026-08-17'), singleItem('b', '2026-07-13')],
    weeks: 12,
    now: NOW,
  });
  const wk = forecast.weeks.find((w) => w.weekStart === '2026-07-13');
  assert.equal(wk.pausedCount, 1);
});

test('a big summer pause dips below break-even and recovers after the return date', () => {
  const items = Array.from({ length: 20 }, (_, i) => awayItem(`m${i}`, '2026-07-06', '2026-08-17'));
  const forecast = buildPauseForecast({ totals, activeCount: 100, pauseItems: items, weeks: 12, now: NOW });
  assert.equal(forecast.summary.maxPausedInAWeek, 20);
  assert.equal(forecast.summary.trough.activeProjected, 80);
  assert.equal(forecast.summary.trough.marginMonthly, -400); // 8800 net - 3200 var - 6000 fixed
  assert.ok(forecast.summary.belowBreakEvenWeeks > 0);
  assert.ok(forecast.summary.recoveryWeek && forecast.summary.recoveryWeek >= '2026-08-17');
  // a week after return is back at full active
  const back = forecast.weeks.find((w) => w.weekStart >= '2026-08-17' && w.pausedCount === 0);
  assert.ok(back);
});

test('no planned pauses → flat forecast at base margin', () => {
  const forecast = buildPauseForecast({ totals, activeCount: 100, pauseItems: [], weeks: 6, now: NOW });
  assert.equal(forecast.summary.maxPausedInAWeek, 0);
  assert.equal(forecast.summary.belowBreakEvenWeeks, 0);
  assert.ok(forecast.weeks.every((w) => w.marginMonthly === forecast.summary.baseMarginMonthly));
});
