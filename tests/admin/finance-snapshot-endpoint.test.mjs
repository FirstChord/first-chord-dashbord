import assert from 'node:assert/strict';
import test from 'node:test';

import { createFinanceSnapshotPostHandler } from '../../lib/admin/finance-snapshot-endpoint.mjs';

const AT = new Date('2026-08-03T06:30:00.000Z');
const SECRET = 'finance-secret';

function request({ period = '', secret = SECRET } = {}) {
  const suffix = period ? `?period=${encodeURIComponent(period)}` : '';
  return new Request(`https://dashboard.test/api/cron/finance-snapshot${suffix}`, {
    method: 'POST',
    headers: secret === null ? {} : { 'x-firstchord-finance-secret': secret },
  });
}

function createHandler(overrides = {}) {
  return createFinanceSnapshotPostHandler({
    getSecret: () => SECRET,
    now: () => AT,
    getSnapshotRows: async () => [],
    buildSnapshotRow: async ({ periodType, at }) => ({
      snapshot_id: `fs_${periodType}_${at.toISOString()}`,
      active_count: 12,
      active_monthly_revenue: 3456,
      margin_monthly: 1234,
    }),
    appendSnapshotRow: async () => ({ appended: true }),
    ...overrides,
  });
}

test('finance snapshot endpoint rejects missing configuration and bad secrets before work', async () => {
  let builds = 0;
  const unconfigured = createHandler({
    getSecret: () => '',
    buildSnapshotRow: async () => { builds += 1; return {}; },
  });
  const missingConfigResponse = await unconfigured(request());
  assert.equal(missingConfigResponse.status, 503);
  assert.deepEqual(await missingConfigResponse.json(), {
    error: 'FINANCE_SNAPSHOT_SECRET is not configured',
  });

  const configured = createHandler({
    buildSnapshotRow: async () => { builds += 1; return {}; },
  });
  const badSecretResponse = await configured(request({ secret: 'finance-secrex' }));
  assert.equal(badSecretResponse.status, 401);
  assert.deepEqual(await badSecretResponse.json(), {
    error: 'Invalid or missing finance snapshot secret',
  });
  assert.equal(builds, 0);
});

test('finance snapshot endpoint carries monthly requests through the idempotent skip', async () => {
  let builds = 0;
  let appends = 0;
  const existing = {
    snapshot_id: 'fs_monthly_2026-08',
    period_type: 'monthly',
    snapshot_at: '2026-08-01T06:30:00.000Z',
    active_count: 18,
    active_monthly_revenue: 5100,
    margin_monthly: 2400,
  };
  const handler = createHandler({
    getSnapshotRows: async () => [existing],
    buildSnapshotRow: async () => { builds += 1; return {}; },
    appendSnapshotRow: async () => { appends += 1; return { appended: true }; },
  });

  const response = await handler(request({ period: 'MONTHLY' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    periodType: 'monthly',
    skipped: true,
    reason: 'monthly_snapshot_exists',
    snapshotId: 'fs_monthly_2026-08',
    activeCount: 18,
    revenueMonthly: 5100,
    marginMonthly: 2400,
  });
  assert.equal(builds, 0);
  assert.equal(appends, 0);
});

test('finance snapshot endpoint defaults unknown periods to weekly and reports the append', async () => {
  let readExisting = 0;
  let buildArgs = null;
  let appendedRow = null;
  const handler = createHandler({
    getSnapshotRows: async () => { readExisting += 1; return []; },
    buildSnapshotRow: async (args) => {
      buildArgs = args;
      return {
        snapshot_id: 'fs_weekly_2026-08-03',
        active_count: 17,
        active_monthly_revenue: 5000,
        margin_monthly: 2300,
      };
    },
    appendSnapshotRow: async (row) => { appendedRow = row; return { appended: true }; },
  });

  const response = await handler(request({ period: 'quarterly' }));
  assert.equal(response.status, 200);
  assert.deepEqual(buildArgs, { periodType: 'weekly', at: AT });
  assert.equal(readExisting, 0);
  assert.equal(appendedRow.snapshot_id, 'fs_weekly_2026-08-03');
  assert.deepEqual(await response.json(), {
    success: true,
    periodType: 'weekly',
    skipped: false,
    reason: '',
    snapshotId: 'fs_weekly_2026-08-03',
    activeCount: 17,
    revenueMonthly: 5000,
    marginMonthly: 2300,
  });
});

test('finance snapshot endpoint returns a failing HTTP contract when construction fails', async () => {
  let appends = 0;
  const handler = createHandler({
    buildSnapshotRow: async () => { throw new Error('Finance inputs unavailable'); },
    appendSnapshotRow: async () => { appends += 1; },
  });

  const response = await handler(request());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Finance inputs unavailable' });
  assert.equal(appends, 0);
});
