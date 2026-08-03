/** @fileoverview Idempotent orchestration boundary for scheduled Finance_Snapshot writes. */

function clean(value = '') {
  return `${value || ''}`.trim();
}

export function utcMonthKey(at = new Date()) {
  const parsed = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(parsed.getTime())) throw new Error('A valid snapshot time is required');
  return parsed.toISOString().slice(0, 7);
}

export function findMonthlyFinanceSnapshot(snapshotRows = [], { at = new Date() } = {}) {
  const month = utcMonthKey(at);
  return snapshotRows
    .filter((row) => clean(row.period_type) === 'monthly' && clean(row.snapshot_at).startsWith(month))
    .sort((left, right) => clean(left.snapshot_at).localeCompare(clean(right.snapshot_at)))[0] || null;
}

export async function runFinanceSnapshot({
  periodType = 'weekly',
  at = new Date(),
  getSnapshotRows,
  buildSnapshotRow,
  appendSnapshotRow,
} = {}) {
  const period = clean(periodType) === 'monthly' ? 'monthly' : 'weekly';
  if (typeof buildSnapshotRow !== 'function') throw new Error('buildSnapshotRow is required');
  if (typeof appendSnapshotRow !== 'function') throw new Error('appendSnapshotRow is required');

  if (period === 'monthly') {
    if (typeof getSnapshotRows !== 'function') throw new Error('getSnapshotRows is required for monthly snapshots');
    const existing = findMonthlyFinanceSnapshot(await getSnapshotRows(), { at });
    if (existing) {
      return {
        success: true,
        skipped: true,
        reason: 'monthly_snapshot_exists',
        row: existing,
      };
    }
  }

  const row = await buildSnapshotRow({ periodType: period, at });
  const appendResult = await appendSnapshotRow(row);
  return {
    success: true,
    skipped: appendResult?.appended === false,
    reason: appendResult?.appended === false ? 'snapshot_id_exists' : '',
    row,
  };
}
