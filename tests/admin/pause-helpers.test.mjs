import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPauseSummary, normalisePauseHistoryRow } from '../../lib/admin/pause-helpers.mjs';

test('normalisePauseHistoryRow handles Pause History field variations', () => {
  const row = normalisePauseHistoryRow({
    'Student Name': 'Owen Example',
    Email: 'parent@example.com',
    Tutor: 'Chloe',
    'Subscription ID': 'sub_123',
    'Start Date': '2026-05-01',
    'End Date': '2026-05-10',
    'Stripe Status': 'paused',
  });

  assert.equal(row.studentName, 'Owen Example');
  assert.equal(row.email, 'parent@example.com');
  assert.equal(row.subscriptionId, 'sub_123');
  assert.equal(row.stripeStatus, 'paused');
});

test('buildPauseSummary finds a current pause by subscription id', () => {
  const summary = buildPauseSummary({
    studentEmail: 'parent@example.com',
    stripeSubscriptionId: 'sub_123',
    pauseRows: [
      {
        subscriptionId: 'sub_123',
        startDate: '2026-05-01',
        endDate: '2099-05-10',
        stripeStatus: 'paused',
      },
    ],
  });

  assert.equal(summary.hasPauseHistory, true);
  assert.equal(summary.currentlyPaused, true);
  assert.equal(summary.latestPause.subscriptionId, 'sub_123');
});

test('buildPauseSummary falls back to email matching and expired pauses are not current', () => {
  const summary = buildPauseSummary({
    studentEmail: 'parent@example.com',
    stripeSubscriptionId: '',
    pauseRows: [
      {
        email: 'parent@example.com',
        startDate: '2025-01-01',
        endDate: '2025-01-10',
        stripeStatus: 'paused',
      },
    ],
  });

  assert.equal(summary.hasPauseHistory, true);
  assert.equal(summary.currentlyPaused, false);
});
