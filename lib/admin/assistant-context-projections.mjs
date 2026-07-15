const SCHEMA_VERSION = 1;
const MAX_ARRAY_ITEMS = 12;
const MAX_STRING_LENGTH = 500;

const PROVENANCE_FIELD_ALLOWLIST = [
  'instrument',
  'lessonType',
  'lessonFrequency',
  'paymentMode',
  'paymentExpectation',
];

const SENSITIVE_KEY_PARTS = [
  'firstname',
  'lastname',
  'fullname',
  'studentname',
  'parent',
  'recipient',
  'tutor',
  'phone',
  'contact',
  'raw',
  'url',
  'theta',
  'mmsid',
  'fcstudentid',
  'customerid',
  'subscriptionid',
  'billinggroupid',
  'grouppartner',
  'teacherid',
  'seriesid',
  'sharedstudent',
  'deliverykey',
  'noteid',
  'issueid',
  'contextkey',
  'resolutionnote',
  'detail',
];
const DIRECT_IDENTIFIER_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:cus|sub|sdt|pi|in|evt|ch|pm)_[A-Za-z0-9_-]+\b/g,
  /https?:\/\/\S+/gi,
  /(?:\+\d[\d\s()-]{7,}\d|\b0\d[\d\s()-]{7,}\d\b)/g,
];

function isSensitiveKey(key = '') {
  const normalised = `${key}`.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (normalised === 'email' || normalised.endsWith('email') || normalised.includes('emailaddress') || normalised.includes('emailerror')) {
    return true;
  }
  return SENSITIVE_KEY_PARTS.some((part) => normalised.includes(part));
}

function collectSensitiveValues(source, values = new Set(), parentKey = '') {
  if (source === null || source === undefined) return values;

  if (Array.isArray(source)) {
    for (const entry of source) collectSensitiveValues(entry, values, parentKey);
    return values;
  }

  if (typeof source !== 'object') {
    if (isSensitiveKey(parentKey)) {
      const value = `${source}`.trim();
      if (value.length >= 3) values.add(value);
    }
    return values;
  }

  for (const [key, value] of Object.entries(source)) {
    collectSensitiveValues(value, values, key);
  }
  return values;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSafeText(...sources) {
  const sensitiveValues = [...sources.reduce(
    (values, source) => collectSensitiveValues(source, values),
    new Set(),
  )]
    .filter((value) => value.length >= 3)
    .sort((a, b) => b.length - a.length);

  return (value) => {
    if (value === null || value === undefined) return '';
    let text = `${value}`.trim();

    for (const sensitiveValue of sensitiveValues) {
      text = text.replace(new RegExp(escapeRegExp(sensitiveValue), 'gi'), '[redacted]');
    }
    for (const pattern of DIRECT_IDENTIFIER_PATTERNS) {
      text = text.replace(pattern, '[redacted]');
    }

    return text.slice(0, MAX_STRING_LENGTH);
  };
}

function safeTextList(values, safeText, limit = MAX_ARRAY_ITEMS) {
  const result = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const text = safeText(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }

  return result;
}

function safeCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(99, Math.max(0, Math.trunc(number)));
}

function optionalBoolean(value) {
  if (value === true || `${value}`.trim().toLowerCase() === 'true') return true;
  if (value === false || `${value}`.trim().toLowerCase() === 'false') return false;
  return null;
}

function projectSource(source, safeText) {
  return {
    role: safeText(source?.role),
    present: optionalBoolean(source?.present),
    loaded: optionalBoolean(source?.loaded),
    freshness: safeText(source?.freshness),
    observedAt: safeText(source?.observedAt),
    checkedAt: safeText(source?.checkedAt),
    confidence: safeText(source?.confidence),
    matchConfidence: safeText(source?.matchConfidence),
    matchedBy: safeText(source?.matchedBy),
  };
}

function conflictArea(field = '') {
  if (['firstName', 'lastName', 'fullName'].includes(field)) return 'identity';
  if (field === 'fcStudentId') return 'portal_identity';
  if (['billingGroupId', 'groupPartnerMmsId'].includes(field)) return 'lesson_group';
  return field || 'unknown';
}

function projectConflicts(conflicts, safeText) {
  return (Array.isArray(conflicts) ? conflicts : [])
    .slice(0, MAX_ARRAY_ITEMS)
    .map((conflict) => ({
      area: safeText(conflictArea(conflict?.field)),
      code: safeText(conflict?.code),
      selectedSource: safeText(conflict?.selectedSource),
      severity: safeText(conflict?.severity),
    }));
}

function projectProvenance(provenance, safeText) {
  const sources = provenance?.sources || {};
  const fields = provenance?.fields || {};

  return {
    sources: {
      studentsSheet: projectSource(sources.studentsSheet, safeText),
      studentRegistry: projectSource(sources.studentRegistry, safeText),
      waitingState: projectSource(sources.waitingState, safeText),
      pauseHistory: projectSource(sources.pauseHistory, safeText),
      scheduleContext: projectSource(sources.scheduleContext, safeText),
    },
    fields: Object.fromEntries(PROVENANCE_FIELD_ALLOWLIST.map((field) => [
      field,
      {
        owner: safeText(fields[field]?.owner),
        selectedSource: safeText(fields[field]?.selectedSource),
        resolution: safeText(fields[field]?.resolution),
      },
    ])),
  };
}

function projectCoveredLessonDates(values, safeText) {
  return (Array.isArray(values) ? values : [])
    .slice(0, MAX_ARRAY_ITEMS)
    .map((entry) => ({
      date: safeText(entry?.date || entry),
      weekday: safeText(entry?.weekday),
      time: safeText(entry?.time),
    }));
}

function buildStudentProjection(student, generatedAt, safeText) {
  const provenance = student?.provenance || {};
  const pauseSummary = student?.pauseSummary || {};
  const latestPause = pauseSummary.latestPause || {};
  const pauseCoverage = student?.pauseCoverageContext || {};
  const schedule = student?.scheduleContext || {};
  const sourceConflicts = provenance.conflicts || [];

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'student_context',
    subject: 'selected_student',
    generatedAt: safeText(generatedAt),
    profile: {
      instrument: safeText(student?.instrument),
      lessonLengthMinutes: safeText(student?.lessonLength),
      lessonType: safeText(student?.lessonType),
      lessonFrequency: safeText(student?.lessonFrequency),
    },
    records: {
      studentsSheet: Boolean(provenance?.sources?.studentsSheet?.present ?? Object.keys(student || {}).length),
      studentRegistry: Boolean(student?.registryEntry || student?.registry || provenance?.sources?.studentRegistry?.present),
    },
    lifecycle: {
      status: safeText(student?.lifecycleStatus),
      label: safeText(student?.lifecycleLabel),
      confidence: safeText(student?.lifecycleConfidence),
      reasons: safeTextList(student?.lifecycleReasons, safeText),
      warnings: safeTextList(student?.lifecycleWarnings, safeText),
    },
    payment: {
      mode: safeText(student?.paymentMode),
      expectation: safeText(student?.paymentExpectation),
      customerLinkRecorded: Boolean(student?.stripeCustomerId || student?.customerLinkRecorded),
      subscriptionLinkRecorded: Boolean(student?.stripeSubscriptionId || student?.subscriptionLinkRecorded),
    },
    waiting: {
      status: safeText(student?.waitingStatus || student?.waitingState?.status),
      observedAt: safeText(provenance?.sources?.waitingState?.observedAt || student?.waitingState?.updatedAt),
    },
    pause: {
      hasHistory: Boolean(pauseSummary.hasPauseHistory),
      currentlyPaused: Boolean(pauseSummary.currentlyPaused),
      upcomingPause: Boolean(pauseSummary.upcomingPause),
      window: {
        startDate: safeText(latestPause.startDate),
        endDate: safeText(latestPause.endDate),
        stripeStatus: safeText(latestPause.stripeStatus),
      },
      match: {
        confidence: safeText(pauseSummary.matchConfidence),
        method: safeText(pauseSummary.matchedBy),
      },
      coverage: {
        status: safeText(pauseCoverage.status),
        confidence: safeText(pauseCoverage.confidence),
        coveredLessonDates: projectCoveredLessonDates(pauseCoverage.coveredLessonDates, safeText),
        nextBillableLessonDate: safeText(pauseCoverage.nextBillableLessonDate),
        warnings: safeTextList(pauseCoverage.warnings, safeText),
      },
    },
    schedule: {
      status: safeText(schedule.status),
      nextLessonAt: safeText(schedule.nextLessonAt),
      usualWeekday: safeText(schedule.usualWeekday),
      usualTime: safeText(schedule.usualTime),
      durationMinutes: safeText(schedule.durationMinutes),
      confidence: safeText(schedule.confidence),
      checkedAt: safeText(schedule.checkedAt),
      freshness: safeText(provenance?.sources?.scheduleContext?.freshness),
      warnings: safeTextList(schedule.warnings, safeText),
      sharedStudentCount: safeCount(schedule.sharedStudentCount),
    },
    review: {
      flagCategories: safeTextList((student?.flags || []).map((flag) => flag?.category), safeText),
      conflicts: projectConflicts(sourceConflicts, safeText),
    },
    provenance: projectProvenance(provenance, safeText),
  };
}

export function buildRedactedStudentContext(student = {}, { generatedAt = new Date().toISOString() } = {}) {
  const safeText = buildSafeText(student);
  return buildStudentProjection(student, generatedAt, safeText);
}

function issueActionCode(type = '') {
  const normalisedType = `${type || ''}`.trim().toUpperCase();
  if (normalisedType === 'TUTOR CONFLICT') return 'review_student_sources';
  if (['SHEETS ONLY', 'REGISTRY ONLY'].includes(normalisedType)) return 'review_student_identity';
  if (normalisedType.includes('PAUSE EXPECTATION')) return 'review_pause_expectation';
  if (normalisedType === 'PRACTICE NOTE DELIVERY FAILED') return 'manual_practice_follow_up';
  if (normalisedType === 'FINANCE DATA GAP') return 'fix_student_source_data';
  if (normalisedType.includes('STRIPE') || normalisedType.includes('PAYMENT') || normalisedType.includes('SUBSCRIPTION')) {
    return 'review_payment_state';
  }
  return 'manual_review';
}

function buildIssueEvidence(issue, studentContext, safeText) {
  const sourceStudent = studentContext || issue || {};
  const pauseSummary = issue?.pauseSummary || sourceStudent.pauseSummary || {};
  const pauseCoverage = issue?.pauseCoverageContext || sourceStudent.pauseCoverageContext || {};
  const practiceNote = issue?.practiceNote || {};
  const financeCoverage = issue?.financeCoverage || {};
  const schedule = sourceStudent.scheduleContext || {};
  const scheduleProvenance = sourceStudent.provenance?.sources?.scheduleContext || {};
  const stripeSnapshot = issue?.stripeSnapshot || {};

  return {
    recordPresence: {
      studentsSheet: Boolean(issue?.hasSheetRow ?? Object.keys(sourceStudent).length),
      studentRegistry: Boolean(issue?.hasRegistryEntry ?? sourceStudent.registryEntry ?? sourceStudent.registry),
    },
    lifecycle: {
      status: safeText(issue?.lifecycleStatus || sourceStudent.lifecycleStatus),
      confidence: safeText(issue?.lifecycleConfidence || sourceStudent.lifecycleConfidence),
    },
    payment: {
      mode: safeText(issue?.paymentMode || sourceStudent.paymentMode),
      expectation: safeText(issue?.paymentExpectation || sourceStudent.paymentExpectation),
      customerLinkRecorded: Boolean(issue?.stripeCustomerId || sourceStudent.stripeCustomerId),
      subscriptionLinkRecorded: Boolean(issue?.stripeSubscriptionId || sourceStudent.stripeSubscriptionId),
    },
    pause: {
      hasHistory: Boolean(pauseSummary.hasPauseHistory),
      currentlyPaused: Boolean(pauseSummary.currentlyPaused),
      upcomingPause: Boolean(pauseSummary.upcomingPause),
      matchConfidence: safeText(pauseSummary.matchConfidence),
      coverageStatus: safeText(pauseCoverage.status),
      coverageConfidence: safeText(pauseCoverage.confidence),
    },
    schedule: {
      status: safeText(schedule.status),
      confidence: safeText(schedule.confidence),
      freshness: safeText(scheduleProvenance.freshness),
      checkedAt: safeText(schedule.checkedAt || scheduleProvenance.checkedAt),
    },
    identity: {
      possibleIdentityCollision: Boolean(issue?.identityMismatchHint),
      sourceConflict: `${issue?.type || ''}`.trim().toUpperCase() === 'TUTOR CONFLICT',
    },
    practiceDelivery: {
      present: `${issue?.source || ''}`.trim().toLowerCase() === 'practice_delivery' || Boolean(issue?.practiceNote),
      lessonDate: safeText(practiceNote.lessonDate),
      deliveryStatus: safeText(practiceNote.emailSendStatus),
      manualFollowUpNeeded: `${issue?.source || ''}`.trim().toLowerCase() === 'practice_delivery'
        ? issue?.active !== false
        : Boolean(practiceNote.manualFollowUpNeeded),
    },
    financeCoverage: {
      present: `${issue?.source || ''}`.trim().toLowerCase() === 'finance_coverage' || Boolean(issue?.financeCoverage),
      flags: safeTextList(financeCoverage.flags, safeText),
      lessonKind: safeText(financeCoverage.lessonKind),
      confidence: safeText(financeCoverage.confidence),
    },
    stripeLive: {
      recordedEvidence: Object.keys(stripeSnapshot).length > 0,
      subscriptionStatus: safeText(stripeSnapshot.subscriptionStatus),
      pauseState: safeText(stripeSnapshot.pauseState),
      activelyBilling: optionalBoolean(stripeSnapshot.activelyBilling),
      latestInvoiceStatus: safeText(stripeSnapshot.latestInvoiceStatus),
      retryAttemptCount: safeCount(stripeSnapshot.latestInvoiceAttemptCount),
      nextPaymentAttemptAt: safeText(stripeSnapshot.nextPaymentAttemptAt),
      latestDeclineCode: safeText(stripeSnapshot.latestDeclineCode),
      latestPaymentIntentStatus: safeText(stripeSnapshot.latestPaymentIntentStatus),
    },
  };
}

function buildAmbiguityCodes({ issue, queueRow, detectorEvaluated, currentPresent, studentContext }, safeText) {
  const codes = [];
  const queuePresent = optionalBoolean(queueRow?.sourcePresent);
  const source = `${issue?.source || queueRow?.source || ''}`.trim().toLowerCase();

  if (!detectorEvaluated) codes.push(source === 'stripe_live' ? 'stripe_live_not_refreshed' : 'detector_not_evaluated');
  if (detectorEvaluated && currentPresent && !queueRow) codes.push('current_issue_not_recorded_in_queue');
  if (detectorEvaluated && currentPresent !== queuePresent && queuePresent !== null) {
    codes.push('queue_presence_disagrees_with_detector');
  }
  if (issue?.identityMismatchHint) codes.push('possible_identity_collision');
  if ((studentContext?.provenance?.conflicts || []).length > 0) codes.push('student_source_conflict');
  if (studentContext?.provenance?.sources?.scheduleContext?.freshness === 'stale') codes.push('schedule_cache_stale');
  if (studentContext?.lifecycleConfidence === 'low') codes.push('low_lifecycle_confidence');
  if (studentContext?.pauseSummary?.matchConfidence === 'low') codes.push('low_pause_match_confidence');

  return safeTextList(codes, safeText);
}

export function buildRedactedIssueContext({
  issue = {},
  queueRow = null,
  studentContext = null,
  detectorEvaluated = true,
  generatedAt = new Date().toISOString(),
} = {}) {
  const safeText = buildSafeText(issue, queueRow, studentContext);
  const source = safeText(issue?.source || queueRow?.source);
  const evaluated = source === 'stripe_live' ? false : Boolean(detectorEvaluated);
  const hasCurrentIssue = Boolean(issue && Object.keys(issue).length);
  const currentPresent = evaluated ? hasCurrentIssue && issue?.active !== false : null;

  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'issue_context',
    subject: 'selected_issue',
    generatedAt: safeText(generatedAt),
    issue: {
      type: safeText(issue?.type || queueRow?.issueType),
      source,
      severity: safeText(issue?.severity || queueRow?.severity),
      systemsAffected: safeTextList(issue?.systemsAffected, safeText, 8),
      summary: safeText(issue?.summary || queueRow?.summary),
      recommendedAction: safeText(issue?.recommendedAction || queueRow?.recommendedAction),
      actionCode: issueActionCode(issue?.type || queueRow?.issueType),
    },
    detector: {
      evaluated,
      currentPresent,
    },
    queue: {
      recorded: Boolean(queueRow),
      status: safeText(queueRow?.status),
      recordedSourcePresent: optionalBoolean(queueRow?.sourcePresent),
      lastSeenAt: safeText(queueRow?.lastSeenAt),
      updatedAt: safeText(queueRow?.updatedAt),
    },
    evidence: buildIssueEvidence(issue, studentContext, safeText),
    ambiguityCodes: buildAmbiguityCodes({
      issue,
      queueRow,
      detectorEvaluated: evaluated,
      currentPresent,
      studentContext,
    }, safeText),
    student: studentContext ? buildStudentProjection(studentContext, generatedAt, safeText) : null,
  };
}
