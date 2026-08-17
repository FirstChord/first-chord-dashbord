/**
 * @fileoverview Secret-gated nightly pause-expectation reconciliation, followed
 * by a live Stripe rescan.
 *
 * The manual button this replaces was never wrong — it was just never pressed.
 * A pause ending is a silent event: Stripe resumes billing on its own schedule
 * and the Students sheet keeps saying `stripe_paused_expected` until a human
 * clicks Sync. Over one summer that produced 36 identical
 * SUBSCRIPTION_STATE_MISMATCH issues, none of which meant anyone was billed
 * wrongly. Running it nightly means the sheet is never more than a day behind.
 *
 * The two phases must run in this order and are deliberately coupled in one
 * endpoint so they cannot drift apart:
 *
 *   1. reconcile — writes `payment_expectation` in the Students sheet.
 *   2. rescan    — re-derives the `stripe_live` issue rows.
 *
 * Only the rescan can mark a `stripe_live` queue row absent (getAdminIssues
 * manages the other four sources, not this one), so reconciling without
 * rescanning fixes the data and leaves the board still showing the old
 * mismatch. Rescanning without reconciling first re-detects the mismatch it was
 * about to fix.
 *
 * What makes the write safe to run unattended is upstream, in
 * derivePauseExpectationDecision: `shouldAutoSync` requires a Pause History row
 * matched by Stripe subscription ID at high confidence *and* confirmed usual-
 * lesson coverage. Anything weaker returns an issue for a human instead. The
 * cap below is the second line: a routine night moves a handful of students, so
 * an unusually large plan means an upstream input changed shape, and that
 * deserves eyes rather than a batch write.
 */
export const MAX_UNATTENDED_CHANGES = 25;

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function timingSafeEqualString(leftValue = '', rightValue = '') {
  const left = clean(leftValue);
  const right = clean(rightValue);
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function parseMaxChanges(value, fallback = MAX_UNATTENDED_CHANGES) {
  // An absent param must mean the default cap, not a cap of zero — Number('')
  // is 0, which would refuse every plan on the nightly run.
  const raw = clean(value);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function createPauseExpectationCronHandler({
  getPreview,
  reconcile,
  rescan,
  env = process.env,
  actorEmail = 'cron@github-actions',
} = {}) {
  return async function POST(request) {
    const expectedSecret = clean(env.PAUSE_SYNC_SECRET);
    if (!expectedSecret) {
      return Response.json({ error: 'PAUSE_SYNC_SECRET is not configured' }, { status: 503 });
    }
    const providedSecret = request.headers.get('x-firstchord-pause-secret') || '';
    if (!timingSafeEqualString(providedSecret, expectedSecret)) {
      return Response.json({ error: 'Invalid or missing pause sync secret' }, { status: 401 });
    }

    const maxChanges = parseMaxChanges(new URL(request.url).searchParams.get('maxChanges'));

    // Preview first so an anomalous plan is refused *before* anything is
    // written, and so the refusal can name the students it declined to touch.
    let preview;
    try {
      preview = await getPreview();
    } catch (error) {
      return Response.json({
        success: false,
        error: error?.message || 'Pause expectation preview failed',
        stage: 'preview',
      }, { status: 500 });
    }

    if (preview.changeCount > maxChanges) {
      return Response.json({
        success: false,
        error: `Pause expectation plan of ${preview.changeCount} exceeds the unattended cap of ${maxChanges}`,
        stage: 'cap',
        checkedCount: preview.checkedCount,
        plannedChangeCount: preview.changeCount,
        changeCount: 0,
        changes: preview.changes,
      }, { status: 409 });
    }

    let reconciled = { checkedCount: preview.checkedCount, plannedChangeCount: 0, changeCount: 0, synced: [] };
    if (preview.changeCount > 0) {
      try {
        reconciled = await reconcile({ actorEmail });
      } catch (error) {
        return Response.json({
          success: false,
          error: error?.message || 'Pause expectation reconciliation failed',
          stage: 'reconcile',
          ...(error?.partialResult ? { partialResult: error.partialResult } : {}),
        }, { status: 500 });
      }
    }

    // The rescan is what makes the change visible on the Issues board. A
    // rescan failure leaves correct sheet data and a stale board, so it is
    // reported as a failure without unwinding the writes above.
    try {
      const scan = await rescan();
      return Response.json({
        success: true,
        checkedCount: reconciled.checkedCount ?? preview.checkedCount,
        changeCount: reconciled.changeCount ?? 0,
        changes: reconciled.synced ?? [],
        scannedCount: scan.scannedCount,
        openIssueCount: scan.issues.filter((issue) => issue.status === 'open' && issue.sourcePresent).length,
        scannedAt: scan.scannedAt,
      });
    } catch (error) {
      return Response.json({
        success: false,
        error: error?.message || 'Live Stripe rescan failed',
        stage: 'rescan',
        changeCount: reconciled.changeCount ?? 0,
        changes: reconciled.synced ?? [],
      }, { status: 500 });
    }
  };
}
