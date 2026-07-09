export const PARENT_UNDERSTANDING_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'call_attempted', label: 'Call Attempted' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'message_sent', label: 'Message Sent' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'needs_follow_up', label: 'Needs Follow-Up' },
  { value: 'escalate_to_admin', label: 'Escalate to Admin' },
];

export const PARENT_UNDERSTANDING_LOOP_STATUS_OPTIONS = [
  { value: 'open_admin_follow_up_needed', label: 'Open - Admin Follow-Up Needed' },
  { value: 'partially_closed', label: 'Partially Closed' },
  { value: 'closed', label: 'Closed' },
  { value: 'open_waiting_for_parent', label: 'Open - Waiting for Parent' },
  { value: 'open_technical_issue', label: 'Open - Technical Issue' },
  { value: 'open_communication_issue', label: 'Open - Communication Issue' },
];

const STATUS_VALUES = new Set(PARENT_UNDERSTANDING_STATUS_OPTIONS.map((option) => option.value));
const LOOP_STATUS_VALUES = new Set(PARENT_UNDERSTANDING_LOOP_STATUS_OPTIONS.map((option) => option.value));

const UNDERSTANDING_AREAS = [
  { key: 'cancellations', label: 'Cancellations & holidays' },
  { key: 'dashboardSoundslice', label: 'Dashboard / Soundslice' },
  { key: 'practiceNotes', label: 'Practice notes' },
  { key: 'showcases', label: 'Student showcases' },
];

export function normaliseParentUnderstandingStatus(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return STATUS_VALUES.has(normalised) ? normalised : 'not_started';
}

export function normaliseParentUnderstandingLoopStatus(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return LOOP_STATUS_VALUES.has(normalised) ? normalised : 'open_admin_follow_up_needed';
}

export function scoreUnderstandingValue(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  if (normalised === 'yes') return 2;
  if (normalised === 'partial' || normalised === 'unsure' || normalised === 'sometimes') return 1;
  if (normalised === 'no' || normalised === 'not_receiving' || normalised === 'needs_updating') return 0;
  return 0;
}

function isAssessedUnderstandingValue(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return ['yes', 'partial', 'unsure', 'sometimes', 'no', 'not_receiving', 'needs_updating'].includes(normalised);
}

function scoreArea(area = {}) {
  if (Number.isInteger(area.score)) {
    return Math.max(0, Math.min(2, area.score));
  }
  return scoreUnderstandingValue(area.understands);
}

export function calculateUnderstandingScore(record = {}) {
  const understanding = record.understanding || {};
  const breakdown = {};
  let assessedAreas = 0;

  for (const area of UNDERSTANDING_AREAS) {
    breakdown[area.key] = scoreArea(understanding[area.key]);
    if (isAssessedUnderstandingValue(understanding[area.key]?.understands) || Number.isInteger(understanding[area.key]?.score)) {
      assessedAreas += 1;
    }
  }

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  let label = 'not_assessed';
  let labelText = 'Not assessed';

  if (assessedAreas > 0 && assessedAreas < UNDERSTANDING_AREAS.length) {
    label = 'partially_assessed';
    labelText = `${assessedAreas} of ${UNDERSTANDING_AREAS.length} areas checked`;
  } else if (assessedAreas === UNDERSTANDING_AREAS.length && total >= 7) {
    label = 'clear';
    labelText = 'Clear understanding';
  } else if (assessedAreas === UNDERSTANDING_AREAS.length && total >= 5) {
    label = 'mostly_clear';
    labelText = 'Mostly clear, minor gaps';
  } else if (assessedAreas === UNDERSTANDING_AREAS.length && total >= 3) {
    label = 'several_gaps';
    labelText = 'Several gaps, follow-up useful';
  } else if (assessedAreas === UNDERSTANDING_AREAS.length) {
    label = 'needs_active_follow_up';
    labelText = 'Needs active follow-up';
  }

  return {
    total,
    max: 8,
    label,
    labelText,
    breakdown,
    assessedAreas,
    isComplete: assessedAreas === UNDERSTANDING_AREAS.length,
  };
}

function addSignal(signals, signal) {
  if (signal && !signals.includes(signal)) {
    signals.push(signal);
  }
}

export function deriveParentUnderstandingRiskSignals(record = {}) {
  const signals = [];
  const understanding = record.understanding || {};
  const feedback = record.feedback || {};
  const communication = record.communication || {};

  if (isAssessedUnderstandingValue(understanding.cancellations?.understands) && scoreArea(understanding.cancellations) < 2) {
    addSignal(signals, 'Cancellation/holiday policy gap');
  }
  if (
    (isAssessedUnderstandingValue(understanding.dashboardSoundslice?.understands) && scoreArea(understanding.dashboardSoundslice) < 2)
    || understanding.dashboardSoundslice?.needsAccessHelp
  ) {
    addSignal(signals, 'Dashboard or Soundslice access gap');
  }
  if (
    (isAssessedUnderstandingValue(understanding.practiceNotes?.understands) && scoreArea(understanding.practiceNotes) < 2)
    || understanding.practiceNotes?.isReceiving === 'no'
    || understanding.practiceNotes?.emailConfirmed === 'needs_updating'
  ) {
    addSignal(signals, 'Practice notes delivery gap');
  }
  if (isAssessedUnderstandingValue(understanding.showcases?.understands) && scoreArea(understanding.showcases) < 2) {
    addSignal(signals, 'Showcase understanding gap');
  }
  if (communication.whatsappUnderstanding === 'no' || communication.whatsappUnderstanding === 'unsure') {
    addSignal(signals, 'WhatsApp group communication needs explaining');
  }
  if (communication.communityGroupStatus === 'not_in_group') {
    addSignal(signals, 'Community group status needs checking');
  }
  if (feedback.practiceAtHome === 'no' || feedback.practiceAtHome === 'sometimes' || feedback.practiceAtHome === 'not_often') {
    addSignal(signals, 'Practice engagement needs review');
  }
  if (feedback.tutorRelevance === 'needs_admin_review') {
    addSignal(signals, 'Tutor-related feedback needs admin review');
  }
  if (`${record.adminFollowUpNote || ''}`.trim()) {
    addSignal(signals, 'Admin follow-up noted');
  }

  return signals;
}

function areaSummary(score, clearText, gapText) {
  return score >= 2 ? clearText : gapText;
}

export function buildParentUnderstandingSummary(record = {}, studentContext = {}) {
  const score = calculateUnderstandingScore(record);
  const signals = deriveParentUnderstandingRiskSignals(record);
  const parentName = studentContext.parentName || 'Parent';
  const studentName = studentContext.studentName || 'the student';
  const understanding = record.understanding || {};
  const feedback = record.feedback || {};
  const communication = record.communication || {};
  const parts = [
    score.isComplete
      ? `${parentName} check-in for ${studentName}: ${score.total}/8 (${score.labelText.toLowerCase()}).`
      : `${parentName} check-in for ${studentName}: ${score.labelText.toLowerCase()}.`,
  ];

  for (const area of UNDERSTANDING_AREAS) {
    const value = understanding[area.key]?.understands;
    if (!isAssessedUnderstandingValue(value)) {
      continue;
    }
    const summaryCopy = {
      cancellations: ['Cancellations/holidays are understood.', 'Cancellations/holidays need clarification.'],
      dashboardSoundslice: ['Dashboard/Soundslice access is understood.', 'Dashboard/Soundslice should be followed up.'],
      practiceNotes: ['Practice notes are understood.', 'Practice note delivery or understanding needs checking.'],
      showcases: ['Showcases are understood.', 'Showcase information should be recapped.'],
    };
    const [clearText, gapText] = summaryCopy[area.key];
    parts.push(areaSummary(score.breakdown[area.key], clearText, gapText));
  }

  if (feedback.lessonFeedback) {
    parts.push(`Lesson feedback: ${feedback.lessonFeedback}`);
  }
  if (feedback.practiceAtHome && feedback.practiceAtHome !== 'unknown') {
    parts.push(`Practice at home: ${feedback.practiceAtHome}.`);
  }
  if (communication.whatsappUnderstanding) {
    parts.push(`WhatsApp understanding: ${communication.whatsappUnderstanding}.`);
  }
  if (communication.bestContactTime) {
    parts.push(`Best contact time: ${communication.bestContactTime}.`);
  }
  if (signals.length) {
    parts.push(`Follow-up signals: ${signals.join(', ')}.`);
  }

  return parts.join(' ');
}

export function parseParentUnderstandingDetails(detailsJson = '') {
  if (!detailsJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(detailsJson);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function serialiseParentUnderstandingDetails(details = {}) {
  return JSON.stringify(details || {});
}
