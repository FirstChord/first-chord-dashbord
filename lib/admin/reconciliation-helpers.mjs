// L1 — pure temporal reconciliation core (read-only, deterministic, no I/O).
//
// Reconciles ONE episode's lesson instances against overlapping facts, per lesson, then
// aggregates upward. V1 scope: tutor_absence ↔ student_pause only. Each consequence
// (revenue / tutor cost / planning / communication) resolves by its OWN rule — there is
// no single cause-priority. Finance effects are expressed as NET-NEW: an overlap with a
// pre-existing student pause contributes 0, because the pause already accounts for it.
//
// Inputs are facts shaped by a (separate) adapter — this module does no pricing, no
// sheet/MMS access, and never writes. Same inputs always produce a deep-equal result.

export const OUTCOME = {
  NO_LESSON: 'no_lesson',
  COVERED: 'covered_by_other_tutor',
  NEEDS_CLARIFICATION: 'needs_clarification',
};

export const ACTION = {
  NONE: 'none',
  CONFIRM_PAUSE: 'confirm_pause',
  ARRANGE_COVER: 'arrange_cover',
  CLARIFY: 'clarify',
};

export const REASON = {
  REVENUE_ALREADY_NOT_BILLED: 'revenue_already_not_billed_by_student_pause',
  TUTOR_ALREADY_NOT_PAID: 'tutor_not_paid_lesson_not_delivered',
  PLANNING_ALREADY_HANDLED: 'planning_already_handled_by_existing_pause',
  COMMS_ALREADY_COVERED: 'dates_already_covered_by_student_pause',
  LOW_CONFIDENCE_MATCH: 'low_confidence_pause_match',
  CONFLICT_COVER_AND_PAUSE: 'conflict_cover_and_student_pause',
  INVALID_DECISION: 'invalid_or_missing_absence_decision',
};

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function round(n) {
  return Math.round(n * 100) / 100;
}

function num(value) {
  return Number.isFinite(value) ? value : 0;
}

// Pause History windows are inclusive of both ends (matches derivePauseCoverageContext).
function pauseCoversDate(window, dateStr) {
  const start = `${window.startDate || ''}`.slice(0, 10);
  const end = `${window.endDate || ''}`.slice(0, 10);
  const date = `${dateStr || ''}`.slice(0, 10);
  if (!start || !end || !date) return false;
  return date >= start && date <= end;
}

function isoWeekKey(dateStr) {
  const d = new Date(`${`${dateStr || ''}`.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3); // nearest Thursday
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const f = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - f + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / MS_PER_WEEK);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function emptyEffects() {
  return {
    revenue: { grossLost: 0, netNewLost: 0, ownedByCause: null, suppressed: [] },
    tutorCost: { netNewOriginalPaySaved: 0, netNewCoverPayAdded: 0, owningDecision: null, suppressed: [] },
    planning: { actionRequired: ACTION.NONE, owningCause: null, suppressedActions: [] },
    communication: { contributesDate: false, reasonCode: null },
  };
}

function reconcileInstance(instance, pauseWindows) {
  const date = `${instance.date || ''}`.slice(0, 10);
  const lessonValue = num(instance.lessonValue);
  const tutorPayAmount = num(instance.tutorPayAmount);
  const decision = `${instance.absence?.decision || ''}`.trim();
  const coverPayAmount = num(instance.absence?.coverPayAmount);

  const matchedPause = (pauseWindows || []).find((w) => pauseCoversDate(w, date)) || null;
  const pauseConfidence = matchedPause ? `${matchedPause.matchConfidence || 'high'}` : null;
  const highConfidencePause = matchedPause && pauseConfidence !== 'low';

  const causes = [
    { type: 'tutor_absence', decision, coverTutorId: instance.absence?.coverTutorId || '', sourceRef: instance.absence?.absenceRowRef || '' },
  ];
  if (matchedPause) {
    causes.push({ type: 'student_pause', sourceRef: matchedPause.sourceRef || '', effectiveFrom: matchedPause.startDate, effectiveTo: matchedPause.endDate, matchConfidence: pauseConfidence });
  }

  const effects = emptyEffects();
  const evidence = [];
  let outcome;
  let ambiguity = 'confirmed';

  const isCover = decision === 'cover';
  const isCancel = decision === 'cancel';

  if (!isCover && !isCancel) {
    // Missing / unknown absence decision — cannot resolve.
    outcome = OUTCOME.NEEDS_CLARIFICATION;
    ambiguity = 'needs_clarification';
    effects.planning.actionRequired = ACTION.CLARIFY;
    evidence.push({ fact: `absence decision '${decision || '(none)'}'`, sourceRef: instance.absence?.absenceRowRef || '', rule: REASON.INVALID_DECISION });
  } else if (matchedPause && isCover) {
    // Contradiction: a cover implies the lesson runs; a pause implies it doesn't.
    outcome = OUTCOME.NEEDS_CLARIFICATION;
    ambiguity = 'needs_clarification';
    effects.planning.actionRequired = ACTION.CLARIFY;
    evidence.push({ fact: 'cover arranged AND student pause cover this date', sourceRef: matchedPause.sourceRef || '', rule: REASON.CONFLICT_COVER_AND_PAUSE });
  } else if (matchedPause && !highConfidencePause) {
    // Low-confidence pause match: don't silently suppress the absence effect — resolve as
    // the absence alone but flag for a human (conservative).
    if (isCancel) {
      outcome = OUTCOME.NO_LESSON;
      effects.revenue = { grossLost: lessonValue, netNewLost: lessonValue, ownedByCause: 'tutor_absence', suppressed: [] };
      effects.tutorCost = { netNewOriginalPaySaved: tutorPayAmount, netNewCoverPayAdded: 0, owningDecision: 'cancel', suppressed: [] };
      effects.communication.contributesDate = true;
      effects.planning.actionRequired = ACTION.CLARIFY;
    } else {
      outcome = OUTCOME.COVERED;
      effects.tutorCost = { netNewOriginalPaySaved: tutorPayAmount, netNewCoverPayAdded: coverPayAmount, owningDecision: 'cover', suppressed: [] };
      effects.communication.contributesDate = true;
      effects.planning.actionRequired = ACTION.CLARIFY;
    }
    ambiguity = 'needs_clarification';
    evidence.push({ fact: 'student pause matched by low-confidence link', sourceRef: matchedPause.sourceRef || '', rule: REASON.LOW_CONFIDENCE_MATCH });
  } else if (matchedPause && isCancel) {
    // The real overlap: pause + cancel. The pre-existing pause already accounts for the
    // lesson not happening, so the absence episode adds NOTHING net-new.
    outcome = OUTCOME.NO_LESSON;
    effects.revenue = {
      grossLost: lessonValue,
      netNewLost: 0,
      ownedByCause: 'student_pause',
      suppressed: [{ cause: 'tutor_absence', reasonCode: REASON.REVENUE_ALREADY_NOT_BILLED }],
    };
    effects.tutorCost = {
      netNewOriginalPaySaved: 0,
      netNewCoverPayAdded: 0,
      owningDecision: 'cancel',
      suppressed: [{ cause: 'tutor_absence', reasonCode: REASON.TUTOR_ALREADY_NOT_PAID }],
    };
    effects.planning = { actionRequired: ACTION.NONE, owningCause: 'student_pause', suppressedActions: [{ action: ACTION.CONFIRM_PAUSE, reasonCode: REASON.PLANNING_ALREADY_HANDLED }] };
    effects.communication = { contributesDate: false, reasonCode: REASON.COMMS_ALREADY_COVERED };
    evidence.push({ fact: 'student pause already covers this date', sourceRef: matchedPause.sourceRef || '', rule: REASON.REVENUE_ALREADY_NOT_BILLED });
  } else if (isCancel) {
    // Absence cancel, no overlap → net-new no-lesson.
    outcome = OUTCOME.NO_LESSON;
    effects.revenue = { grossLost: lessonValue, netNewLost: lessonValue, ownedByCause: 'tutor_absence', suppressed: [] };
    effects.tutorCost = { netNewOriginalPaySaved: tutorPayAmount, netNewCoverPayAdded: 0, owningDecision: 'cancel', suppressed: [] };
    effects.planning = { actionRequired: ACTION.CONFIRM_PAUSE, owningCause: 'tutor_absence', suppressedActions: [] };
    effects.communication = { contributesDate: true, reasonCode: null };
    evidence.push({ fact: 'tutor absence cancel, no overlapping pause', sourceRef: instance.absence?.absenceRowRef || '', rule: 'absence_cancel_net_new' });
  } else {
    // Absence cover, no overlap → lesson runs with a cover tutor.
    outcome = OUTCOME.COVERED;
    effects.revenue = { grossLost: 0, netNewLost: 0, ownedByCause: null, suppressed: [] };
    effects.tutorCost = { netNewOriginalPaySaved: tutorPayAmount, netNewCoverPayAdded: coverPayAmount, owningDecision: 'cover', suppressed: [] };
    effects.planning = { actionRequired: ACTION.ARRANGE_COVER, owningCause: 'tutor_absence', suppressedActions: [] };
    effects.communication = { contributesDate: true, reasonCode: null };
    evidence.push({ fact: 'tutor absence cover, no overlapping pause', sourceRef: instance.absence?.absenceRowRef || '', rule: 'absence_cover_net_new' });
  }

  return {
    key: `${instance.eventId || `${instance.studentMmsId}|${date}|${instance.startTime || ''}`}:${instance.studentMmsId || ''}`,
    eventId: instance.eventId || '',
    slotKey: instance.eventId || `${instance.studentMmsId}|${date}|${instance.startTime || ''}`,
    studentMmsId: instance.studentMmsId || '',
    date,
    startTime: instance.startTime || '',
    lessonValue,
    lessonKind: instance.lessonKind || '',
    causes,
    outcome,
    ...effects,
    ambiguity,
    evidence,
  };
}

export function reconcileEpisode({ lessonInstances = [], pauseWindows = [], now = new Date() } = {}) {
  void now; // reserved for future effective-date logic; kept for signature stability
  const pauseByStudent = new Map();
  for (const w of pauseWindows) {
    const id = `${w.studentMmsId || ''}`;
    if (!id) continue;
    if (!pauseByStudent.has(id)) pauseByStudent.set(id, []);
    pauseByStudent.get(id).push(w);
  }

  const instances = lessonInstances.map((instance) =>
    reconcileInstance(instance, pauseByStudent.get(`${instance.studentMmsId || ''}`) || []),
  );

  // --- Finance: net-new only; tutor cost deduped per slot (group lesson paid once) ---
  const resolved = instances.filter((i) => i.outcome !== OUTCOME.NEEDS_CLARIFICATION);
  let netNewRevenueLost = 0;
  for (const i of resolved) netNewRevenueLost += i.revenue.netNewLost;

  const slotSeen = new Set();
  let netNewOriginalPaySaved = 0;
  let netNewCoverPayAdded = 0;
  for (const i of resolved) {
    if (slotSeen.has(i.slotKey)) continue; // one slot, one tutor-cost effect
    slotSeen.add(i.slotKey);
    netNewOriginalPaySaved += i.tutorCost.netNewOriginalPaySaved;
    netNewCoverPayAdded += i.tutorCost.netNewCoverPayAdded;
  }

  const notBillingStudentWeeks = new Set();
  for (const i of resolved) {
    if (i.revenue.netNewLost > 0) notBillingStudentWeeks.add(`${i.studentMmsId}|${isoWeekKey(i.date)}`);
  }

  const finance = {
    netNewRevenueLost: round(netNewRevenueLost),
    netNewOriginalPaySaved: round(netNewOriginalPaySaved),
    netNewCoverPayAdded: round(netNewCoverPayAdded),
    // Margin convention: lost revenue hurts margin; saved original pay helps; cover pay hurts.
    marginEffect: round(-netNewRevenueLost + netNewOriginalPaySaved - netNewCoverPayAdded),
    netNewNotBillingStudentWeeks: notBillingStudentWeeks.size,
  };

  // --- Family episodes: one per student ---
  const byStudent = new Map();
  for (const i of instances) {
    const id = i.studentMmsId || '(unknown)';
    if (!byStudent.has(id)) byStudent.set(id, []);
    byStudent.get(id).push(i);
  }
  const familyEpisodes = [...byStudent.entries()].map(([studentMmsId, items]) => {
    const dates = items.map((i) => i.date).filter(Boolean).sort();
    const netNewDates = items.filter((i) => i.communication.contributesDate).map((i) => i.date).sort();
    const remainingActions = [...new Set(items.map((i) => i.planning.actionRequired).filter((a) => a && a !== ACTION.NONE))];
    const suppressionReasons = [...new Set(items.flatMap((i) => [
      i.revenue.reasonCode,
      i.communication.reasonCode,
      ...i.revenue.suppressed.map((s) => s.reasonCode),
      ...i.planning.suppressedActions.map((s) => s.reasonCode),
    ].filter(Boolean)))];
    return {
      studentMmsId,
      window: { start: dates[0] || '', end: dates[dates.length - 1] || '' },
      affectedDates: dates,
      netNewDates,
      remainingActions,
      commsRequired: netNewDates.length > 0,
      needsClarification: items.some((i) => i.ambiguity === 'needs_clarification'),
      suppressionReasons,
    };
  });

  const unresolved = instances.filter((i) => i.ambiguity === 'needs_clarification');

  return { instances, finance, familyEpisodes, unresolved };
}
