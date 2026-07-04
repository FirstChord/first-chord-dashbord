import test from 'node:test';
import assert from 'node:assert/strict';

import { buildForwardOutlook } from '../../lib/admin/forward-outlook.mjs';
import { buildPauseForecast } from '../../lib/admin/pause-forecast.mjs';

// net 11000, variable 4000, salaried 5000, fixed 1000, 100 active
// → contribution 7000, avg per student 70, base margin 1000
const totals = { netRevenueMonthly: 11000, variableMonthly: 4000, salariedMonthly: 5000, fixedMonthly: 1000 };
const NOW = new Date('2026-07-01T09:00:00Z');

const awayItem = (mmsId, start, end) => ({
  planningId: `p_${mmsId}`,
  title: `Pause Student ${mmsId} from x; returning y`,
  notes: `Pause type: away period.\nFirst lesson to pause date: ${start}.\nReturning from date: ${end}.`,
  linkedStudentId: mmsId,
});

const waitingRow = (mmsId, status) => ({ mmsId, status, note: '', dateStarted: '', updatedAt: '' });

test('pipeline counts only genuinely-waiting statuses', () => {
  const outlook = buildForwardOutlook({
    totals,
    activeCount: 100,
    waitingRows: [
      waitingRow('w1', 'new'),
      waitingRow('w2', 'contacted'),
      waitingRow('w3', 'welcome_call_booked'),
      waitingRow('w4', 'onboarding_ready'),
      waitingRow('w5', 'onboarded'), // already on the roster
      waitingRow('w6', 'closed'), // left the funnel
      waitingRow('w7', 'no_response'), // gone cold
      waitingRow('w8', ''), // blank → normalises to 'new'
    ],
    weeks: 4,
    now: NOW,
  });
  assert.equal(outlook.pipeline.waitingCount, 5);
  assert.deepEqual(outlook.pipeline.byStatus, {
    new: 2,
    contacted: 1,
    welcome_call_booked: 1,
    onboarding_ready: 1,
  });
  assert.equal(outlook.summary.waitingCount, 5);
});

test('potentialMonthly = waiting count × average contribution per student', () => {
  const outlook = buildForwardOutlook({
    totals,
    activeCount: 100,
    waitingRows: [waitingRow('w1', 'new'), waitingRow('w2', 'contacted'), waitingRow('w3', 'call_completed')],
    weeks: 4,
    now: NOW,
  });
  assert.equal(outlook.pipeline.avgContributionPerStudent, 70); // 7000 contribution / 100 active
  assert.equal(outlook.pipeline.potentialMonthly, 210);
  assert.equal(outlook.summary.pipelinePotentialMonthly, 210);
  assert.equal(outlook.pipeline.timelined, false);
});

test('empty waiting list → zero pipeline, note still present', () => {
  const outlook = buildForwardOutlook({ totals, activeCount: 100, waitingRows: [], weeks: 4, now: NOW });
  assert.equal(outlook.pipeline.waitingCount, 0);
  assert.deepEqual(outlook.pipeline.byStatus, {});
  assert.equal(outlook.pipeline.potentialMonthly, 0);
  assert.ok(outlook.pipeline.note.length > 0);
  assert.equal(outlook.seasonal, null);
});

test('pauses passthrough carries buildPauseForecast output unchanged', () => {
  const pauseItems = [awayItem('a', '2026-07-06', '2026-08-17')];
  const outlook = buildForwardOutlook({
    totals,
    activeCount: 100,
    activeMmsIds: ['a'],
    pauseItems,
    weeks: 12,
    now: NOW,
  });
  const direct = buildPauseForecast({ totals, activeCount: 100, activeMmsIds: ['a'], pauseItems, weeks: 12, now: NOW });
  assert.deepEqual(outlook.pauses, direct);
  assert.equal(outlook.summary.horizonWeeks, 12);
  assert.equal(outlook.summary.baseMarginMonthly, direct.summary.baseMarginMonthly);
  assert.equal(outlook.summary.troughMarginMonthly, direct.summary.trough.marginMonthly);
});

test('deterministic now → identical output across calls', () => {
  const args = {
    totals,
    activeCount: 100,
    pauseItems: [awayItem('a', '2026-07-06', '2026-08-17')],
    waitingRows: [waitingRow('w1', 'new')],
    weeks: 8,
    now: NOW,
  };
  assert.deepEqual(buildForwardOutlook(args), buildForwardOutlook(args));
});
