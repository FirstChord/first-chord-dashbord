/** @fileoverview Scheduled pause-expectation reconciliation, fail-closed behind its own PAUSE_SYNC_SECRET because it writes payment_expectation. */
import { createPauseExpectationCronHandler } from '@/lib/admin/pause-expectation-cron.mjs';
import { scanLiveStripeIssues } from '@/lib/admin/issues';
import {
  getPauseExpectationReconciliationPreview,
  reconcilePauseExpectations,
} from '@/lib/admin/pause-expectation-workflow';

export const dynamic = 'force-dynamic';

// Outside admin-session middleware because GitHub Actions calls it. Fail-closed
// behind PAUSE_SYNC_SECRET, which is deliberately separate from
// SCHEDULE_REFRESH_SECRET: the schedule endpoints refresh a rebuildable cache,
// this one writes payment_expectation, so it should be revocable on its own.
export const POST = createPauseExpectationCronHandler({
  getPreview: getPauseExpectationReconciliationPreview,
  reconcile: reconcilePauseExpectations,
  rescan: scanLiveStripeIssues,
  env: process.env,
});
