import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFinanceScenario } from '../../lib/admin/finance-scenario.mjs';

// net 11000, variable 4000, salaried 5000, fixed 1000, 100 active
// contribution = 7000 (avg 70/student); fixed costs = 6000; base margin = 1000
const totals = {
  netRevenueMonthly: 11000,
  variableMonthly: 4000,
  salariedMonthly: 5000,
  fixedMonthly: 1000,
};

test('no change reproduces the base margin and average contribution', () => {
  const s = buildFinanceScenario(totals, 100);
  assert.equal(s.base.marginMonthly, 1000);
  assert.equal(s.avgContributionPerStudent, 70);
  assert.equal(s.isChanged, false);
  assert.equal(s.scenario.marginMonthly, 1000);
});

test('break-even count and buffer are derived from contribution vs fixed costs', () => {
  const s = buildFinanceScenario(totals, 100);
  // 100 × 6000 / 7000 = 85.7 → ceil 86
  assert.equal(s.breakEvenActiveCount, 86);
  assert.equal(s.bufferStudents, 14);
  assert.equal(s.bufferPct, 14);
});

test('losing students scales revenue and variable pay together (paused = no pay)', () => {
  const s = buildFinanceScenario(totals, 100, { studentsDelta: -50 });
  // scale 0.5 → net 5500, variable 2000, margin 5500-2000-6000 = -2500
  assert.equal(s.scenario.activeCount, 50);
  assert.equal(s.scenario.netRevenueMonthly, 5500);
  assert.equal(s.scenario.variableMonthly, 2000);
  assert.equal(s.scenario.marginMonthly, -2500);
  assert.equal(s.scenario.aboveBreakEven, false);
});

test('a summer dip down to the break-even count lands near zero margin', () => {
  const s = buildFinanceScenario(totals, 100, { studentsDelta: -14 });
  assert.equal(s.scenario.activeCount, 86);
  assert.ok(s.scenario.marginMonthly >= 0 && s.scenario.marginMonthly < 70);
  assert.equal(s.scenario.aboveBreakEven, true);
});

test('a price rise lifts margin without touching variable pay', () => {
  const s = buildFinanceScenario(totals, 100, { pricePctDelta: 0.1 });
  // net ×1.1 = 12100, variable 4000, margin 12100-4000-6000 = 2100
  assert.equal(s.scenario.netRevenueMonthly, 12100);
  assert.equal(s.scenario.variableMonthly, 4000);
  assert.equal(s.scenario.marginMonthly, 2100);
  assert.equal(s.scenario.marginDelta, 1100);
});

test('volume and price combine', () => {
  const s = buildFinanceScenario(totals, 100, { studentsDelta: -20, pricePctDelta: 0.05 });
  // scale 0.8, price 1.05 → net 11000*1.05*0.8 = 9240, variable 3200, margin 9240-3200-6000 = 40
  assert.equal(s.scenario.netRevenueMonthly, 9240);
  assert.equal(s.scenario.variableMonthly, 3200);
  assert.equal(s.scenario.marginMonthly, 40);
});

test('handles zero active count safely', () => {
  const s = buildFinanceScenario(totals, 0);
  assert.equal(s.avgContributionPerStudent, 0);
  assert.equal(s.scenario.activeCount, 0);
});
