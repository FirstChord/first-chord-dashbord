function response(status, body, headers = {}) {
  return { status, body, headers };
}

export async function executePauseExpectationPreview({ session, getPreview }) {
  if (!session?.user?.isAdmin) return response(401, { error: 'Unauthorized' });
  try {
    return response(200, await getPreview(), { 'Cache-Control': 'no-store' });
  } catch (error) {
    return response(500, { error: error?.message || 'Pause expectation preview failed' });
  }
}

export async function executePauseExpectationReconciliation({ session, payload, reconcile }) {
  if (!session?.user?.isAdmin) return response(401, { error: 'Unauthorized' });
  if (payload?.confirm !== true) {
    return response(400, {
      error: 'Explicit confirmation is required before changing payment expectations',
    });
  }

  try {
    return response(200, await reconcile({ actorEmail: session.user.email || '' }));
  } catch (error) {
    return response(500, {
      error: error?.message || 'Pause expectation reconciliation failed',
      ...(error?.partialResult ? { partialResult: error.partialResult } : {}),
    });
  }
}
