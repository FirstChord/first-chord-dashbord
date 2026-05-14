import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFlagsFreshnessSummary, buildIssueEvidenceSummary } from '../../lib/admin/health-helpers.mjs';

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
