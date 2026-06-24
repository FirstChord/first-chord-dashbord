import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFinanceCoverage } from '../../lib/admin/finance-coverage.mjs';
import { parseTutorPay } from '../../lib/admin/cost-helpers.mjs';

const tutorPay = parseTutorPay([
  { tutor: 'Finn', pay_model: 'salary', monthly_salary: '2600' },
  { tutor: 'Patrick', pay_model: 'hourly', hourly_rate: '24' },
]);

const active = (overrides = {}) => ({
  mmsId: overrides.mmsId || 'm1',
  fullName: overrides.fullName || 'Clean Student',
  lifecycleStatus: 'active',
  registryTutor: 'Patrick',
  instrument: 'Guitar',
  scheduleContext: { status: 'found', durationMinutes: '30' },
  ...overrides,
});

test('a fully-specified active student raises no flags and counts as covered', () => {
  const c = buildFinanceCoverage([active()], { tutorPay });
  assert.equal(c.activeCount, 1);
  assert.equal(c.pricedCount, 1);
  assert.equal(c.coveragePct, 100);
  assert.equal(c.isClean, true);
  assert.equal(c.flagged.length, 0);
});

test('only active students are assessed', () => {
  const c = buildFinanceCoverage([active(), active({ mmsId: 'p', lifecycleStatus: 'paused' })], { tutorPay });
  assert.equal(c.activeCount, 1);
});

test('flags an unpriced / no-duration student (35-min not in price table, no schedule)', () => {
  const c = buildFinanceCoverage([active({ mmsId: 'x', instrument: 'Piano', scheduleContext: undefined, lessonLength: '35' })], { tutorPay });
  const row = c.flagged[0];
  assert.ok(row.flags.includes('noRevenuePrice'));
  assert.ok(row.flags.includes('noSchedule'));
  assert.equal(c.coveragePct, 0);
});

test('flags a student with no resolvable duration as noDuration', () => {
  const c = buildFinanceCoverage([active({ mmsId: 'd', instrument: 'Piano', scheduleContext: undefined, lessonLength: 'Uke' })], { tutorPay });
  assert.ok(c.flagged[0].flags.includes('noDuration'));
  assert.equal(c.flagCounts.noDuration, 1);
});

test('detects a tutor teaching active students but missing from Tutor_Pay', () => {
  const c = buildFinanceCoverage([
    active({ mmsId: 'a', registryTutor: 'Finn Le Marinel' }),
    active({ mmsId: 'b', registryTutor: 'Finn Le Marinel' }),
  ], { tutorPay });
  assert.equal(c.tutorsNotInPayTable.length, 1);
  assert.equal(c.tutorsNotInPayTable[0].tutor, 'Finn Le Marinel');
  assert.equal(c.tutorsNotInPayTable[0].studentCount, 2);
  // tutor-not-in-pay-table is informational (tutor-level), not a per-student gap flag
  assert.equal(c.flagged.length, 0);
});

test('flags a student with no tutor resolved', () => {
  const c = buildFinanceCoverage([active({ mmsId: 'n', registryTutor: '', tutor: '', tutors: [] })], { tutorPay });
  assert.ok(c.flagged[0].flags.includes('noTutor'));
});

test('coverage percentage reflects priced share of active students', () => {
  const c = buildFinanceCoverage([
    active({ mmsId: 'ok' }),
    active({ mmsId: 'bad', instrument: 'Piano', scheduleContext: undefined, lessonLength: '35' }),
  ], { tutorPay });
  assert.equal(c.activeCount, 2);
  assert.equal(c.pricedCount, 1);
  assert.equal(c.coveragePct, 50);
});
