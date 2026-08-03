import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findMonthlyFinanceSnapshot,
  runFinanceSnapshot,
  utcMonthKey,
} from '../../lib/admin/finance-snapshot-runner.mjs';

test('utcMonthKey and findMonthlyFinanceSnapshot use the real UTC capture month', () => {
  const at = new Date('2026-08-03T08:00:00Z');
  assert.equal(utcMonthKey(at), '2026-08');
  assert.equal(findMonthlyFinanceSnapshot([
    { snapshot_id: 'weekly', period_type: 'weekly', snapshot_at: '2026-08-01T06:00:00Z' },
    { snapshot_id: 'later', period_type: 'monthly', snapshot_at: '2026-08-03T06:30:00Z' },
    { snapshot_id: 'first', period_type: 'monthly', snapshot_at: '2026-08-01T06:30:00Z' },
  ], { at })?.snapshot_id, 'first');
});

test('runFinanceSnapshot skips an existing monthly row before expensive construction', async () => {
  let built = 0;
  let appended = 0;
  const result = await runFinanceSnapshot({
    periodType: 'monthly',
    at: new Date('2026-08-04T06:30:00Z'),
    getSnapshotRows: async () => [{ snapshot_id: 'existing', period_type: 'monthly', snapshot_at: '2026-08-01T06:30:00Z' }],
    buildSnapshotRow: async () => { built += 1; return {}; },
    appendSnapshotRow: async () => { appended += 1; },
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'monthly_snapshot_exists');
  assert.equal(result.row.snapshot_id, 'existing');
  assert.equal(built, 0);
  assert.equal(appended, 0);
});

test('runFinanceSnapshot appends the first monthly row and reports an adapter race as a no-op', async () => {
  const row = { snapshot_id: 'fs_monthly_2026-08', period_type: 'monthly', snapshot_at: '2026-08-01T06:30:00Z' };
  const appended = await runFinanceSnapshot({
    periodType: 'monthly',
    at: new Date('2026-08-01T06:30:00Z'),
    getSnapshotRows: async () => [],
    buildSnapshotRow: async () => row,
    appendSnapshotRow: async () => ({ appended: true }),
  });
  assert.equal(appended.skipped, false);

  const raced = await runFinanceSnapshot({
    periodType: 'monthly',
    at: new Date('2026-08-01T06:30:00Z'),
    getSnapshotRows: async () => [],
    buildSnapshotRow: async () => row,
    appendSnapshotRow: async () => ({ appended: false }),
  });
  assert.equal(raced.skipped, true);
  assert.equal(raced.reason, 'snapshot_id_exists');
});
