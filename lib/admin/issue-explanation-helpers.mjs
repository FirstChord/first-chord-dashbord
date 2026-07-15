const SCHEMA_VERSION = 1;

const SOURCE_COPY = {
  review_flags: {
    label: 'Review Flags and current student records',
    notChecked: '',
  },
  payment_static: {
    label: 'Current student payment and pause records',
    notChecked: 'Live Stripe was not checked. This rule only compares the payment, linkage and pause facts already recorded by the dashboard.',
  },
  practice_delivery: {
    label: 'Recorded Practice Chat delivery issue',
    notChecked: 'The Practice Chat delivery detector was not replayed. This explanation uses its recorded Issue Queue result.',
  },
  finance_coverage: {
    label: 'Recorded finance coverage issue',
    notChecked: 'The finance estimate was not recalculated. This explanation uses its recorded Issue Queue result.',
  },
  stripe_live: {
    label: 'Recorded live Stripe scan result',
    notChecked: 'Stripe was not refreshed. Use the existing “Refresh Stripe” action before relying on the current provider state.',
  },
};

const RULE_COPY = {
  TUTOR_CONFLICT: {
    name: 'Tutor agreement check',
    statement: 'Show this issue when the tutor recorded in Sheets does not match the tutor in the student registry.',
  },
  SHEETS_ONLY: {
    name: 'Student record presence check',
    statement: 'Show this issue when a student exists in the operational Students sheet but has no matching dashboard registry entry.',
  },
  REGISTRY_ONLY: {
    name: 'Student record presence check',
    statement: 'Show this issue when a student exists in the dashboard registry but has no matching operational Students sheet row.',
  },
  PAYMENT_SETUP_PENDING: {
    name: 'Payment setup check',
    statement: 'Show this issue while the student is still explicitly marked as waiting for payment setup.',
  },
  SETUP_PENDING_STRIPE_LINKED: {
    name: 'Payment setup consistency check',
    statement: 'Show this issue when Stripe customer and subscription links are recorded but the payment expectation still says setup is pending.',
  },
  STRIPE_SETUP_INCOMPLETE: {
    name: 'Stripe linkage check',
    statement: 'Show this issue when Stripe payment is expected but neither a Stripe customer link nor a subscription link is recorded.',
  },
  STRIPE_CUSTOMER_MISSING: {
    name: 'Stripe linkage check',
    statement: 'Show this issue when a Stripe subscription link is recorded but the customer link is missing.',
  },
  STRIPE_SUBSCRIPTION_MISSING: {
    name: 'Stripe linkage check',
    statement: 'Show this issue when Stripe payment is expected but no subscription link is recorded.',
  },
  ACTIVE_WITHOUT_SUBSCRIPTION: {
    name: 'Live subscription check',
    statement: 'Show this issue when the student is expected to be actively billed but the last live Stripe scan found no usable subscription.',
  },
  SUBSCRIPTION_CANCELLED_UNEXPECTEDLY: {
    name: 'Live subscription check',
    statement: 'Show this issue when active billing is expected but the last live Stripe scan found an ended or cancelled subscription.',
  },
  SUBSCRIPTION_STATE_MISMATCH: {
    name: 'Billing-state agreement check',
    statement: 'Show this issue when the last live Stripe billing or pause state does not match the payment expectation recorded for the student.',
  },
  PAUSE_EXPECTATION_MISMATCH: {
    name: 'Pause expectation check',
    statement: 'Show this issue when Pause History says the student is currently paused but the recorded payment expectation does not say paused.',
  },
  PAUSE_EXPECTATION_STALE: {
    name: 'Pause expectation check',
    statement: 'Show this issue when the latest pause has ended but the recorded payment expectation still says paused.',
  },
  INACTIVE_STILL_BILLING: {
    name: 'Inactive billing check',
    statement: 'Show this issue when the student is inactive or stopped but the last live Stripe scan still found active billing.',
  },
  PAYMENT_FAILED: {
    name: 'Live payment check',
    statement: 'Show this issue when the last live Stripe scan found a failed invoice or payment attempt that still needs attention.',
  },
  PAYMENT_RETRYING: {
    name: 'Live payment retry check',
    statement: 'Show this information when Stripe has scheduled another automatic attempt after a recoverable payment failure.',
  },
  PRACTICE_NOTE_DELIVERY_FAILED: {
    name: 'Practice note delivery check',
    statement: 'Show this issue when a parent lesson-note email is recorded as failed and still needs manual follow-up.',
  },
  FINANCE_DATA_GAP: {
    name: 'Finance coverage check',
    statement: 'Show this issue when missing student source data prevents the finance estimate from pricing the student.',
  },
};

const AMBIGUITY_COPY = {
  stripe_live_not_refreshed: 'The live Stripe facts may have changed since the issue was recorded.',
  detector_not_evaluated: 'The original detector was not run again for this explanation.',
  current_issue_not_recorded_in_queue: 'The rule currently detects the issue, but no matching Issue Queue row was available.',
  queue_presence_disagrees_with_detector: 'The current rule result and the recorded Issue Queue presence disagree.',
  possible_identity_collision: 'A possible same-name or identity collision needs human review.',
  student_source_conflict: 'At least one student field has conflicting source records.',
  schedule_cache_stale: 'The cached lesson schedule is stale.',
  low_lifecycle_confidence: 'The student lifecycle classification has low confidence.',
  low_pause_match_confidence: 'The Pause History match has low confidence.',
};

function normaliseIssueType(value = '') {
  return `${value}`.trim().toUpperCase().replace(/[ -]+/g, '_');
}
function titleCase(value = '') {
  return `${value}`
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function yesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Not known';
}

function known(value) {
  return value !== null && value !== undefined && `${value}`.trim() !== '';
}

function addEvidence(evidence, label, value, sourceRole = 'Current deterministic context') {
  if (!known(value)) return;
  evidence.push({ label, value: `${value}`, sourceRole });
}

function buildStatus(context) {
  const detector = context.detector || {};
  const queue = context.queue || {};

  if (detector.evaluated && detector.currentPresent === true) {
    return {
      code: 'currently_detected',
      label: 'Currently detected',
      detail: 'The safe deterministic rule was run again and still finds this issue.',
      tone: 'attention',
    };
  }

  if (detector.evaluated && detector.currentPresent === false) {
    return {
      code: 'not_currently_detected',
      label: 'Not currently detected',
      detail: queue.recordedSourcePresent === true
        ? 'The rule no longer finds the issue, but the recorded queue state has not caught up.'
        : 'The rule was run again and no longer finds the issue.',
      tone: 'clear',
    };
  }

  if (queue.recorded && queue.recordedSourcePresent === true) {
    return {
      code: 'recorded_not_rechecked',
      label: 'Recorded — not rechecked',
      detail: 'The Issue Queue says the source was present when recorded; the source detector was not run again here.',
      tone: 'caution',
    };
  }

  if (queue.recorded && queue.recordedSourcePresent === false) {
    return {
      code: 'recorded_as_cleared',
      label: 'Recorded as no longer detected',
      detail: 'The Issue Queue says the source disappeared; the source detector was not run again here.',
      tone: 'clear',
    };
  }

  return {
    code: 'insufficient_evidence',
    label: 'Evidence incomplete',
    detail: 'There is not enough retrieved evidence to say whether the issue still exists.',
    tone: 'neutral',
  };
}

function buildQueueState(queue = {}) {
  if (!queue.recorded) return { label: 'Not recorded', sourcePresent: null };
  return {
    label: titleCase(queue.status || 'recorded'),
    sourcePresent: queue.recordedSourcePresent,
  };
}

function buildEvidence(context) {
  const issueType = normaliseIssueType(context.issue?.type);
  const source = `${context.issue?.source || ''}`.trim().toLowerCase();
  const facts = context.evidence || {};
  const evidence = [];
  const recordTypes = new Set(['TUTOR_CONFLICT', 'SHEETS_ONLY', 'REGISTRY_ONLY']);
  const paymentType = source === 'payment_static' || source === 'stripe_live';
  const pauseType = issueType.startsWith('PAUSE_EXPECTATION') || issueType === 'SUBSCRIPTION_STATE_MISMATCH';

  if (recordTypes.has(issueType) || source === 'finance_coverage') {
    addEvidence(evidence, 'Students sheet row', yesNo(facts.recordPresence?.studentsSheet));
    addEvidence(evidence, 'Registry entry', yesNo(facts.recordPresence?.studentRegistry));
  }

  if (facts.identity?.sourceConflict) {
    addEvidence(evidence, 'Student source conflict', 'Yes — the records disagree');
  }
  if (facts.identity?.possibleIdentityCollision) {
    addEvidence(evidence, 'Possible identity collision', 'Yes — human review needed');
  }

  if (paymentType) {
    addEvidence(evidence, 'Payment mode', titleCase(facts.payment?.mode));
    addEvidence(evidence, 'Payment expectation', titleCase(facts.payment?.expectation));
    addEvidence(evidence, 'Stripe customer link recorded', yesNo(facts.payment?.customerLinkRecorded));
    addEvidence(evidence, 'Stripe subscription link recorded', yesNo(facts.payment?.subscriptionLinkRecorded));
  }

  if (pauseType || facts.pause?.hasHistory) {
    addEvidence(evidence, 'Pause History found', yesNo(facts.pause?.hasHistory));
    if (facts.pause?.hasHistory) {
      addEvidence(evidence, 'Currently inside recorded pause', yesNo(facts.pause?.currentlyPaused));
      addEvidence(evidence, 'Upcoming recorded pause', yesNo(facts.pause?.upcomingPause));
      addEvidence(evidence, 'Pause match confidence', titleCase(facts.pause?.matchConfidence));
      addEvidence(evidence, 'Lesson coverage', titleCase(facts.pause?.coverageStatus));
    }
  }

  if (source === 'practice_delivery' && (facts.practiceDelivery?.lessonDate || facts.practiceDelivery?.deliveryStatus)) {
    addEvidence(evidence, 'Lesson date', facts.practiceDelivery.lessonDate, 'Recorded Practice Chat evidence');
    addEvidence(evidence, 'Delivery status', titleCase(facts.practiceDelivery.deliveryStatus), 'Recorded Practice Chat evidence');
    addEvidence(evidence, 'Manual follow-up needed', yesNo(facts.practiceDelivery.manualFollowUpNeeded), 'Recorded Practice Chat evidence');
  }

  if (source === 'finance_coverage' && facts.financeCoverage?.flags?.length) {
    addEvidence(evidence, 'Finance gaps', facts.financeCoverage.flags.map(titleCase).join(', '), 'Recorded finance evidence');
    addEvidence(evidence, 'Lesson kind', titleCase(facts.financeCoverage.lessonKind), 'Recorded finance evidence');
    addEvidence(evidence, 'Coverage confidence', titleCase(facts.financeCoverage.confidence), 'Recorded finance evidence');
  }

  if (source === 'stripe_live' && facts.stripeLive?.recordedEvidence) {
    addEvidence(evidence, 'Subscription status at recorded scan', titleCase(facts.stripeLive.subscriptionStatus), 'Recorded Stripe evidence');
    addEvidence(evidence, 'Billing at recorded scan', yesNo(facts.stripeLive.activelyBilling), 'Recorded Stripe evidence');
    addEvidence(evidence, 'Latest invoice status at recorded scan', titleCase(facts.stripeLive.latestInvoiceStatus), 'Recorded Stripe evidence');
    addEvidence(evidence, 'Payment attempt status at recorded scan', titleCase(facts.stripeLive.latestPaymentIntentStatus), 'Recorded Stripe evidence');
  }

  if (context.queue?.recorded) {
    addEvidence(
      evidence,
      'Issue Queue source state',
      context.queue.recordedSourcePresent === true
        ? 'Recorded as present'
        : context.queue.recordedSourcePresent === false
          ? 'Recorded as no longer present'
          : 'Not known',
      'Workflow record — not source truth',
    );
  }

  return evidence.slice(0, 12);
}

function buildNotChecked(context, availability = {}) {
  const source = `${context.issue?.source || ''}`.trim().toLowerCase();
  const items = [];
  const sourceMessage = SOURCE_COPY[source]?.notChecked;
  if (sourceMessage) items.push(sourceMessage);

  if (availability.issueQueue?.available === false) {
    items.push('Issue Queue state was unavailable, so acknowledgement and resolution state could not be compared.');
  }
  if (context.ambiguityCodes?.includes('schedule_cache_stale')) {
    items.push('The lesson schedule was not refreshed because this explanation only reads the existing cache.');
  }

  return [...new Set(items)];
}

export function buildIssueExplanation(context, { availability = {} } = {}) {
  if (!context || context.kind !== 'issue_context') {
    throw new TypeError('A redacted issue context is required');
  }

  const issueType = normaliseIssueType(context.issue?.type);
  const source = `${context.issue?.source || ''}`.trim().toLowerCase();
  const rule = RULE_COPY[issueType] || {
    name: 'Recorded issue rule',
    statement: 'This issue type does not yet have a more specific plain-English rule description. Review its deterministic summary and evidence.',
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'issue_explanation',
    generatedAt: context.generatedAt || '',
    status: buildStatus(context),
    rule: {
      name: rule.name,
      statement: rule.statement,
      result: context.issue?.summary || 'No deterministic result summary is available.',
    },
    source: {
      code: source,
      label: SOURCE_COPY[source]?.label || 'Recorded deterministic issue source',
      detectorRechecked: Boolean(context.detector?.evaluated),
    },
    queue: buildQueueState(context.queue),
    evidence: buildEvidence(context),
    ambiguity: (context.ambiguityCodes || []).map((code) => ({
      code,
      explanation: AMBIGUITY_COPY[code] || `Additional review is needed: ${titleCase(code)}.`,
    })),
    notChecked: buildNotChecked(context, availability),
    nextStep: {
      actionCode: context.issue?.actionCode || 'manual_review',
      label: context.issue?.recommendedAction || 'Review this issue manually.',
      approvalRequired: true,
    },
  };
}
