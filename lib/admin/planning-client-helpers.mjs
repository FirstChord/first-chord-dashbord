// Pure, framework-free helpers for the admin planning surface — extracted from
// AdminPlanningPageClient.js so they can be unit-tested and the component stays a view.
// Cluster 1: date/format helpers + pause-date parsing + pause prefill-URL and parent
// confirmation message. No React, no hooks — same inputs always produce the same output.

const PAYMENT_PAUSE_PWA_URL = process.env.NEXT_PUBLIC_PAYMENT_PAUSE_PWA_URL || 'https://payment-pause-pwa.web.app/';

const SHORT_MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function cardClasses(extra = '') {
  return `rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] ${extra}`;
}

export function formatDateTime(value) {
  if (!value) {
    return 'Not yet';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortPreview(value = '', max = 150) {
  const text = `${value || ''}`.trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}...`;
}

export function formatTargetDate(value = '') {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatFriendlyPauseDate(value = '') {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function firstName(value = '') {
  return `${value || ''}`.trim().split(/\s+/u).filter(Boolean)[0] || '';
}

// Adult students are usually recorded as their own contact — the parent fields echo
// the student's own name (e.g. parent "Sian Malyin" for student "Sian Malyin").
// Treat "no parent" OR "parent name == student name" as the student being their own
// contact, so messages address them directly ("your lesson") not third-person.
export function isStudentOwnContact(student = {}) {
  const norm = (value) => `${value || ''}`.trim().toLowerCase().replace(/\s+/gu, ' ');
  const parentFirst = firstName(student.parentFirstName) || firstName(student.parentLastName);
  if (!parentFirst) return true;

  const studentFull = norm(student.fullName);
  const parentFull = norm([student.parentFirstName, student.parentLastName].filter(Boolean).join(' '));
  if (parentFull && parentFull === studentFull) return true;

  const studentWords = `${student.fullName || ''}`.trim().split(/\s+/u).filter(Boolean);
  const studentLast = norm(studentWords.length > 1 ? studentWords[studentWords.length - 1] : '');
  const pFirst = norm(parentFirst);
  const sFirst = norm(firstName(student.fullName));
  const pLast = norm(student.parentLastName);
  if (sFirst && pFirst === sFirst && (!pLast || pLast === studentLast)) return true;

  return false;
}

export function formatDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDaysToDateInput(value = '', days = 0) {
  const match = `${value || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return value;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  parsed.setDate(parsed.getDate() + days);
  return formatDateInput(parsed);
}

export function parseReadablePlanningDate(value = '') {
  const match = `${value || ''}`.trim().match(/(?:mon|tue|wed|thu|fri|sat|sun),?\s*(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{4})/iu);
  if (!match) return '';
  const month = SHORT_MONTH_INDEX[match[2].toLowerCase()];
  if (typeof month !== 'number') return '';
  const parsed = new Date(Number(match[3]), month, Number(match[1]));
  return Number.isNaN(parsed.getTime()) ? '' : formatDateInput(parsed);
}

export function matchIsoPlanningDate(text = '', labels = []) {
  for (const label of labels) {
    const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:?\\s*(\\d{4}-\\d{2}-\\d{2})`, 'iu');
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

export function extractPauseDatesFromPlanningItem(item = {}) {
  const text = [item.title, item.notes, item.nextAction].filter(Boolean).join('\n');
  const startDate = matchIsoPlanningDate(text, [
    'Lesson date',
    'First lesson to pause date',
    'First pause date',
    'Start date',
  ]);
  const endDate = matchIsoPlanningDate(text, [
    'Returning from date',
    'Return date',
    'End date',
  ]);

  if (startDate) {
    return {
      startDate,
      endDate: endDate || startDate,
    };
  }

  const singleMatch = text.match(/\blesson on\s+([A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2,4}\s+\d{4})/u)
    || text.match(/\bLesson to pause:\s*([A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2,4}\s+\d{4})/u);
  if (singleMatch?.[1]) {
    const parsed = parseReadablePlanningDate(singleMatch[1]);
    return parsed ? { startDate: parsed, endDate: parsed } : { startDate: '', endDate: '' };
  }

  const rangeMatch = text.match(/\bfrom\s+([A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2,4}\s+\d{4});\s*returning\s+([A-Z][a-z]{2},?\s+\d{1,2}\s+[A-Z][a-z]{2,4}\s+\d{4})/u);
  if (rangeMatch?.[1] && rangeMatch?.[2]) {
    return {
      startDate: parseReadablePlanningDate(rangeMatch[1]),
      endDate: parseReadablePlanningDate(rangeMatch[2]),
    };
  }

  return { startDate: '', endDate: '' };
}

export function buildPaymentPausePrefillUrl({ item = {}, student = null } = {}) {
  if (!student?.mmsId) return '';
  const { startDate, endDate } = extractPauseDatesFromPlanningItem(item);
  if (!startDate || !endDate) return '';

  // Single-lesson pause: one clean window that comfortably covers the missed lesson —
  //   start  = the planning due date (the day you action it), not the lesson day
  //   resume = a few days after the paused lesson
  // Away-period pause:
  //   start  = the day we're actually doing the pause (action day), so billing pauses from now
  //   resume = a couple of days before the return lesson, so billing is active again by then
  const isSingleLesson = endDate === startDate;
  const dueDate = `${item.targetDate || ''}`.match(/^\d{4}-\d{2}-\d{2}$/u) ? item.targetDate : '';
  const today = formatDateInput(new Date());
  const pauseToolStartDate = isSingleLesson
    ? (dueDate && dueDate <= startDate ? dueDate : startDate)
    : (dueDate || today);
  const pauseToolEndDate = isSingleLesson
    ? addDaysToDateInput(startDate, 3)
    : addDaysToDateInput(endDate, -2);

  const parentName = [
    student.parentFirstName || '',
    student.parentLastName || '',
  ].filter(Boolean).join(' ').trim();
  const url = new URL(PAYMENT_PAUSE_PWA_URL);
  const params = {
    source: 'dashboard-planning',
    planningId: item.planningId || '',
    studentName: student.fullName || '',
    email: student.email || '',
    startDate: pauseToolStartDate,
    endDate: pauseToolEndDate,
    reason: item.notes?.toLowerCase().includes('teacher') ? 'Teacher Holiday' : 'Student Holiday',
    mmsId: student.mmsId || '',
    customerId: student.stripeCustomerId || '',
    subscriptionId: student.stripeSubscriptionId || '',
    tutor: student.tutor || '',
    parentName,
  };

  Object.entries(params).forEach(([key, value]) => {
    if (`${value || ''}`.trim()) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

export function buildPauseConfirmationMessage({ item = {}, student = null } = {}) {
  if (!student) return '';
  const { startDate, endDate } = extractPauseDatesFromPlanningItem(item);
  if (!startDate || !endDate) return '';

  const studentFirst = firstName(student.fullName) || student.fullName || '';
  const studentName = studentFirst || 'the lesson';
  const tutorFirst = firstName(student.tutor);
  const startLabel = formatFriendlyPauseDate(startDate);
  const endLabel = formatFriendlyPauseDate(endDate);

  // Adult learners are their own contact (no parent, or parent fields echo the
  // student's own name) — address them directly ("you") not third-person ("they").
  const parentFirst = firstName(student.parentFirstName) || firstName(student.parentLastName);
  if (isStudentOwnContact(student)) {
    const greetingName = studentFirst || 'there';
    if (startDate === endDate) {
      return `Hi ${greetingName}, just confirming we have paused payment for your lesson on ${startLabel}. Thanks!`;
    }
    const adultReturn = tutorFirst
      ? `${tutorFirst} will next see you on ${endLabel} and payment will continue as normal from then.`
      : `You're back on ${endLabel} and payment will continue as normal from then.`;
    return `Hi ${greetingName}, just confirming we have paused your payment from ${startLabel}. ${adultReturn} Thanks!`;
  }

  const parentName = parentFirst;
  if (startDate === endDate) {
    return `Hi ${parentName}, just confirming we have paused payment for ${studentName}'s lesson on ${startLabel}. Thanks!`;
  }

  const parentReturn = tutorFirst
    ? `${tutorFirst} will next see ${studentName} on ${endLabel} and payment will continue as normal from then.`
    : `${studentName} is back on ${endLabel} and payment will continue as normal from then.`;
  return `Hi ${parentName}, just confirming we have paused payment for ${studentName} from ${startLabel}. ${parentReturn} Thanks!`;
}
