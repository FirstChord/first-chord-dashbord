/** @fileoverview Executable HTTP boundary for the scheduled Finance_Snapshot job. */

import { authenticateFinanceCronRequest } from './finance-cron-auth.mjs';
import { runFinanceSnapshot } from './finance-snapshot-runner.mjs';

function clean(value = '') {
  return `${value || ''}`.trim();
}

function requireFunction(name, value) {
  if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  return value;
}

export function createFinanceSnapshotPostHandler({
  getSecret,
  now = () => new Date(),
  getSnapshotRows,
  buildSnapshotRow,
  appendSnapshotRow,
  runSnapshot = runFinanceSnapshot,
} = {}) {
  requireFunction('now', now);
  requireFunction('getSnapshotRows', getSnapshotRows);
  requireFunction('buildSnapshotRow', buildSnapshotRow);
  requireFunction('appendSnapshotRow', appendSnapshotRow);
  requireFunction('runSnapshot', runSnapshot);

  return async function financeSnapshotPost(request) {
    const authError = authenticateFinanceCronRequest(request, { getSecret });
    if (authError) return authError;

    const url = new URL(request.url);
    const periodType = clean(url.searchParams.get('period')).toLowerCase() === 'monthly'
      ? 'monthly'
      : 'weekly';

    try {
      const at = now();
      const result = await runSnapshot({
        periodType,
        at,
        getSnapshotRows,
        buildSnapshotRow,
        appendSnapshotRow,
      });
      const row = result.row;

      return Response.json({
        success: true,
        periodType,
        skipped: result.skipped,
        reason: result.reason,
        snapshotId: row.snapshot_id,
        activeCount: row.active_count,
        revenueMonthly: row.active_monthly_revenue,
        marginMonthly: row.margin_monthly,
      });
    } catch (error) {
      return Response.json(
        { error: error?.message || 'Finance snapshot failed' },
        { status: 500 },
      );
    }
  };
}
