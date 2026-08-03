import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFinanceAutomationHealth,
  buildFlagsFreshnessSummary,
  buildIssueEvidenceSummary,
  buildWorkflowRunHealth,
} from '../../lib/admin/health-helpers.mjs';

test('buildWorkflowRunHealth treats an old scheduled success as stale', () => {
  const run = {
    name: 'Stripe Amounts Cache',
    status: 'completed',
    conclusion: 'success',
    updated_at: '2026-07-20T06:00:00Z',
    html_url: 'https://example.test/run',
  };
  const summary = buildWorkflowRunHealth(run, {
    label: 'Stripe amounts',
    maxAgeHours: 8 * 24,
    now: new Date('2026-08-03T06:00:00Z'),
  });

  assert.equal(summary.status, 'Stale');
  assert.match(summary.detail, /hours old/u);
});

test('buildFinanceAutomationHealth checks the blind forecast, baseline, and prior-month collections', () => {
  const healthy = buildFinanceAutomationHealth({
    snapshotRows: [{ period_type: 'monthly', snapshot_at: '2026-08-01T06:30:00Z' }],
    forecastRows: [{ month: '2026-08', forecasted_at: '2026-08-01T05:00:00Z' }],
    collectedRows: [{ month: '2026-07', refreshed_at: '2026-08-01T05:15:00Z' }],
    now: new Date('2026-08-03T08:00:00Z'),
  });
  assert.equal(healthy.status, 'Healthy');

  const stale = buildFinanceAutomationHealth({
    snapshotRows: [],
    forecastRows: [{ month: '2026-08', forecasted_at: '2026-08-01T05:00:00Z' }],
    collectedRows: [{ month: '2026-07', refreshed_at: '2026-08-01T05:15:00Z' }],
    now: new Date('2026-08-03T08:00:00Z'),
  });
  assert.equal(stale.status, 'Stale');
  assert.match(stale.detail, /2026-08 monthly baseline/u);

  const missingForecast = buildFinanceAutomationHealth({
    snapshotRows: [{ period_type: 'monthly', snapshot_at: '2026-08-01T06:30:00Z' }],
    collectedRows: [{ month: '2026-07', refreshed_at: '2026-08-01T05:15:00Z' }],
    now: new Date('2026-08-03T08:00:00Z'),
  });
  assert.equal(missingForecast.status, 'Stale');
  assert.match(missingForecast.detail, /blind Stripe forecast/u);

  const pending = buildFinanceAutomationHealth({ now: new Date('2026-08-01T04:00:00Z') });
  assert.equal(pending.status, 'Running');
});

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

test('buildIssueEvidenceSummary explains review flag freshness', () => {
  const evidence = buildIssueEvidenceSummary(
    {
      source: 'review_flags',
      sourcePresent: true,
      generatedDate: '2026-05-14',
    },
    {
      status: 'Fresh',
      statusDetail: 'Review flags look current.',
      latestGeneratedAt: new Date('2026-05-14T00:00:00.000Z'),
    },
  );

  assert.equal(evidence.label, 'Review Flags');
  assert.equal(evidence.status, 'Fresh');
  assert.match(evidence.detail, /current/);
});

test('buildIssueEvidenceSummary explains system-cleared issues', () => {
  const evidence = buildIssueEvidenceSummary({
    source: 'review_flags',
    sourcePresent: false,
    lastSeenAt: '2026-05-12T10:00:00.000Z',
  });

  assert.equal(evidence.status, 'Cleared');
  assert.match(evidence.detail, /no longer detects/);
});

test('buildIssueEvidenceSummary classifies sheet and manual Stripe sources', () => {
  const sheetEvidence = buildIssueEvidenceSummary({
    source: 'payment_static',
    sourcePresent: true,
  });
  const stripeEvidence = buildIssueEvidenceSummary({
    source: 'stripe_live',
    sourcePresent: true,
  });

  assert.equal(sheetEvidence.status, 'Current');
  assert.equal(stripeEvidence.status, 'Manual');
});
