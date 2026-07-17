const activeDeliveryKeys = new Set();

function errorMessage(error, fallback) {
  return error?.message || `${error || ''}`.trim() || fallback;
}

export function buildPracticeNoteClaimFailureResponse({
  mode = 'execute',
  deliveryKey = '',
  claimResult = null,
  preview = {},
  isAbsentNoMakeup = false,
} = {}) {
  const channel = isAbsentNoMakeup ? 'none' : 'gmail';
  return {
    status: 503,
    body: {
      success: false,
      mode,
      error: 'Practice note delivery could not be claimed. No MMS attendance update or Gmail email was attempted.',
      idempotency: {
        status: 'claim_failed',
        deliveryKey,
      },
      practiceNoteLog: claimResult,
      ...preview,
      dryRun: false,
      attendanceSave: {
        ok: false,
        skipped: true,
        reason: 'delivery_claim_failed',
      },
      practiceNoteEmail: {
        ok: false,
        skipped: true,
        channel,
        reason: 'delivery_claim_failed',
      },
      emailNotes: {
        ok: false,
        skipped: true,
        channel,
        reason: 'delivery_claim_failed',
      },
      partialSuccess: false,
    },
  };
}

// This guard prevents duplicate execution inside one running dashboard process.
// It is not cross-instance safety: a transactional store with a unique
// delivery_key is still required before the Practice Chat pilot widens.
export async function executeClaimedPracticeNoteDelivery({
  deliveryKey = '',
  saveClaim,
  executeDelivery,
  finalizeDelivery,
} = {}) {
  const key = `${deliveryKey || ''}`.trim();
  if (!key) {
    throw new Error('deliveryKey is required');
  }
  if (typeof saveClaim !== 'function') {
    throw new Error('saveClaim is required');
  }
  if (typeof executeDelivery !== 'function') {
    throw new Error('executeDelivery is required');
  }

  if (activeDeliveryKeys.has(key)) {
    return {
      ok: false,
      reason: 'in_process',
      inProgress: true,
    };
  }

  activeDeliveryKeys.add(key);

  try {
    let claimResult;
    try {
      claimResult = await saveClaim();
    } catch (error) {
      return {
        ok: false,
        reason: 'claim_failed',
        claimResult: {
          ok: false,
          error: errorMessage(error, 'Practice note delivery claim save failed'),
        },
      };
    }

    if (claimResult?.inProgress || claimResult?.alreadyCompleted) {
      return {
        ok: false,
        reason: 'in_progress',
        inProgress: true,
        claimResult,
      };
    }

    if (claimResult?.error || claimResult?.ok === false) {
      return {
        ok: false,
        reason: 'claim_failed',
        claimResult: {
          ...claimResult,
          ok: false,
          error: errorMessage(claimResult?.error, 'Practice note delivery claim save failed'),
        },
      };
    }

    const deliveryResult = await executeDelivery();
    const finalResult = typeof finalizeDelivery === 'function'
      ? await finalizeDelivery(deliveryResult)
      : null;

    return {
      ok: true,
      claimResult: {
        ...claimResult,
        ok: true,
      },
      deliveryResult,
      finalResult,
    };
  } finally {
    activeDeliveryKeys.delete(key);
  }
}
