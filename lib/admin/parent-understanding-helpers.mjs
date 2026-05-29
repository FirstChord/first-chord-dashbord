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

function scoreArea(area = {}) {
  if (Number.isInteger(area.score)) {
    return Math.max(0, Math.min(2, area.score));
  }
  return scoreUnderstandingValue(area.understands);
}

export function calculateUnderstandingScore(record = {}) {
  const understanding = record.understanding || {};
  const breakdown = {};

  for (const area of UNDERSTANDING_AREAS) {
    breakdown[area.key] = scoreArea(understanding[area.key]);
  }

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  let label = 'needs_active_follow_up';
  let labelText = 'Needs active follow-up';

  if (total >= 7) {
    label = 'clear';
    labelText = 'Clear understanding';
  } else if (total >= 5) {
    label = 'mostly_clear';
    labelText = 'Mostly clear, minor gaps';
  } else if (total >= 3) {
    label = 'several_gaps';
    labelText = 'Several gaps, follow-up useful';
  }

  return {
    total,
    max: 8,
    label,
    labelText,
    breakdown,
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

  if (scoreArea(understanding.cancellations) < 2) {
    addSignal(signals, 'Cancellation/holiday policy gap');
  }
  if (scoreArea(understanding.dashboardSoundslice) < 2 || understanding.dashboardSoundslice?.needsAccessHelp) {
    addSignal(signals, 'Dashboard or Soundslice access gap');
  }
  if (
    scoreArea(understanding.practiceNotes) < 2
    || understanding.practiceNotes?.isReceiving === 'no'
    || understanding.practiceNotes?.emailConfirmed === 'needs_updating'
  ) {
    addSignal(signals, 'Practice notes delivery gap');
  }
  if (scoreArea(understanding.showcases) < 2) {
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
  const feedback = record.feedback || {};
  const communication = record.communication || {};
  const parts = [
    `${parentName} check-in for ${studentName}: ${score.total}/8 (${score.labelText.toLowerCase()}).`,
    areaSummary(score.breakdown.cancellations, 'Cancellations/holidays are understood.', 'Cancellations/holidays need clarification.'),
    areaSummary(score.breakdown.dashboardSoundslice, 'Dashboard/Soundslice access is understood.', 'Dashboard/Soundslice should be followed up.'),
    areaSummary(score.breakdown.practiceNotes, 'Practice notes are understood.', 'Practice note delivery or understanding needs checking.'),
    areaSummary(score.breakdown.showcases, 'Showcases are understood.', 'Showcase information should be recapped.'),
  ];

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
