// Changing any price below? Bump PRICE_ASSUMPTIONS_VERSION in finance-assumptions.mjs
// so the Finance_Snapshot series records the basis change.
const ONE_TO_ONE_WEEKLY_PRICES = new Map([
  [30, 25],
  [45, 33],
  [60, 41.5],
]);

const GROUP_WEEKLY_PRICE = 20;
const ORCHESTRA_MONTHLY_PRICE = 42.5;
const WEEKS_PER_MONTH = 52 / 12;

function normalise(value) {
  return `${value || ''}`.trim().toLowerCase();
}

function toNumber(value) {
  const parsed = Number.parseFloat(`${value || ''}`.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return `£${value.toFixed(2).replace(/\.00$/, '')}`;
}

function detectLessonKind(student = {}) {
  const instrument = normalise(student.instrument);
  const lessonType = normalise(student.lessonType);
  const hasGroupMarker = Boolean(student.billingGroupId || student.groupPartnerMmsId);
  const sharedStudentCount = Number(student.scheduleContext?.sharedStudentCount || 0);

  if (instrument.includes('ukulele orchestra')) {
    return 'orchestra';
  }

  if (lessonType === 'sibling_group' || hasGroupMarker || sharedStudentCount > 1) {
    return 'group';
  }

  return 'one_to_one';
}

export function derivePaymentValueContext(student = {}) {
  const scheduleContext = student.scheduleContext || {};
  const duration = toNumber(scheduleContext.durationMinutes) || toNumber(student.lessonLength);
  const lessonKind = detectLessonKind(student);
  const reasons = [];
  const warnings = [];
  let weeklyValue = null;
  let monthlyValue = null;
  let confidence = 'medium';

  if (lessonKind === 'orchestra') {
    monthlyValue = ORCHESTRA_MONTHLY_PRICE;
    weeklyValue = monthlyValue * 12 / 52;
    confidence = 'high';
    reasons.push('Instrument is Adult Ukulele Orchestra.');
    reasons.push('Orchestra value uses the monthly subscription price.');
  } else if (lessonKind === 'group') {
    weeklyValue = GROUP_WEEKLY_PRICE;
    monthlyValue = weeklyValue * WEEKS_PER_MONTH;
    confidence = duration === 45 ? 'high' : 'medium';
    if (scheduleContext.sharedStudentCount > 1) {
      reasons.push(`Cached MMS schedule shows ${scheduleContext.sharedStudentCount} students sharing this lesson slot.`);
    } else {
      reasons.push('Student is marked as part of a group lesson.');
    }
    reasons.push('Group lesson value is priced per student.');
    if (duration && duration !== 45) {
      warnings.push('Group price assumes a 45 minute group lesson, but the cached duration is different.');
    }
  } else if (ONE_TO_ONE_WEEKLY_PRICES.has(duration)) {
    weeklyValue = ONE_TO_ONE_WEEKLY_PRICES.get(duration);
    monthlyValue = weeklyValue * WEEKS_PER_MONTH;
    confidence = scheduleContext.status === 'found' ? 'high' : 'medium';
    reasons.push(`${duration} minute one-to-one lesson price.`);
  } else {
    confidence = 'low';
    warnings.push('Could not match lesson duration to the current price table.');
  }

  if (!scheduleContext.status) {
    warnings.push('No cached schedule context was available; value uses sheet fields only.');
    confidence = confidence === 'high' ? 'medium' : confidence;
  } else if (scheduleContext.status !== 'found') {
    warnings.push('Cached schedule context has no upcoming MMS lesson; value may be stale.');
    confidence = confidence === 'high' ? 'medium' : confidence;
  }

  if (student.paymentExpectation === 'inactive_or_stopped') {
    warnings.push('Student is marked inactive or stopped; value is baseline only.');
  }

  if (student.paymentExpectation === 'stripe_paused_expected') {
    warnings.push('Student is marked paused expected; value is baseline only.');
  }

  return {
    lessonKind,
    durationMinutes: duration ? String(duration) : '',
    baselineWeeklyValue: weeklyValue,
    baselineMonthlyValue: monthlyValue,
    baselineWeeklyLabel: money(weeklyValue),
    baselineMonthlyLabel: money(monthlyValue),
    confidence,
    reasons,
    warnings,
  };
}
