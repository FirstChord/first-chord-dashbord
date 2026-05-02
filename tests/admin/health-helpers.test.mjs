import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFlagsFreshnessSummary } from '../../lib/admin/health-helpers.mjs';

test('buildFlagsFreshnessSummary reports unknown when no generated dates exist', () => {
  const summary = buildFlagsFreshnessSummary([]);

  assert.equal(summary.status, 'Unknown');
  assert.equal(summary.latestGeneratedAt, null);
  assert.equal(summary.ageDays, null);
});

test('buildFlagsFreshnessSummary reports fresh for today-generated flags', () => {
  const today = new Date().toISOString().slice(0, 10);
  const summary = buildFlagsFreshnessSummary([{ generated_date: today }]);

  assert.equal(summary.status, 'Fresh');
  assert.equal(summary.distinctGeneratedDates.length, 1);
});

test('buildFlagsFreshnessSummary reports stale for older flags', () => {
  const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const summary = buildFlagsFreshnessSummary([{ generated_date: staleDate }]);

  assert.equal(summary.status, 'Stale');
  assert.equal(summary.ageDays >= 9, true);
});
