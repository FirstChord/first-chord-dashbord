export const PLANNING_ITEM_TYPES = ['idea', 'initiative', 'action'];
export const PLANNING_STATUSES = ['inbox', 'active', 'waiting', 'done', 'parked'];
export const PLANNING_OWNERS = ['Unassigned', 'Finn', 'Tom'];
export const PLANNING_AREAS = [
  'admin',
  'tutor',
  'parent',
  'finance',
  'showcase',
  'tech',
  'marketing',
  'workflow',
  'other',
];
export const PLANNING_PROGRESS_TYPES = [
  'note',
  'action_completed',
  'decision',
  'status_change',
  'next_action_update',
];

const MONTH_INDEX = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const PLANNING_MEETING_DAYS = new Set([
  WEEKDAY_INDEX.monday,
  WEEKDAY_INDEX.thursday,
  WEEKDAY_INDEX.friday,
]);

const STATUS_LABELS = {
  inbox: 'Inbox',
  active: 'Active',
  waiting: 'Waiting',
  done: 'Done',
  parked: 'Parked',
};

const TYPE_LABELS = {
  idea: 'Idea',
  initiative: 'Initiative',
  action: 'Action',
};

const AREA_LABELS = {
  admin: 'Admin',
  tutor: 'Tutor',
  parent: 'Parent',
  finance: 'Finance',
  showcase: 'Showcase',
  tech: 'Tech',
  marketing: 'Marketing',
  workflow: 'Workflow',
  other: 'Other',
};

const MOMENTUM_LABELS = {
  inbox: 'Inbox',
  moving: 'Moving',
  steady: 'Steady',
  no_next_action: 'No next action',
  stalled: 'Stalled',
  done: 'Done',
  parked: 'Parked',
};

function normaliseEnum(value, validValues, fallback) {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return validValues.includes(normalised) ? normalised : fallback;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateInputValue(value = '') {
  const match = `${value || ''}`.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) {
    return null;
  }
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUkNumericDate(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatReadableDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function parseFlexibleDate(value = '') {
  const text = `${value || ''}`.trim();
  if (!text) {
    return null;
  }

  const dateOnly = parseDateInputValue(text.slice(0, 10));
  if (dateOnly) {
    return dateOnly;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateFromMonthDay({ day, month, now }) {
  const year = now.getFullYear();
  let parsed = new Date(year, month, day);
  if (parsed < startOfLocalDay(now)) {
    parsed = new Date(year + 1, month, day);
  }
  return parsed;
}

function inferEventDateFromText(rawText = '', now = new Date()) {
  const text = `${rawText || ''}`.toLowerCase();
  const today = startOfLocalDay(now);

  if (/\btoday\b/u.test(text)) {
    return today;
  }
  if (/\btomorrow\b/u.test(text)) {
    return addDays(today, 1);
  }

  const numericDate = text.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/u);
  if (numericDate) {
    const day = Number(numericDate[1]);
    const month = Number(numericDate[2]) - 1;
    const explicitYear = numericDate[3] ? Number(numericDate[3]) : null;
    const year = explicitYear
      ? explicitYear < 100 ? 2000 + explicitYear : explicitYear
      : now.getFullYear();
    let parsed = new Date(year, month, day);
    if (!explicitYear && parsed < today) {
      parsed = new Date(year + 1, month, day);
    }
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const monthDay = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/u)
    || text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/u);
  if (monthDay) {
    const firstIsMonth = Number.isNaN(Number(monthDay[1]));
    const month = MONTH_INDEX[firstIsMonth ? monthDay[1] : monthDay[2]];
    const day = Number(firstIsMonth ? monthDay[2] : monthDay[1]);
    if (typeof month === 'number' && day > 0) {
      return dateFromMonthDay({ day, month, now });
    }
  }

  const weekdayMatch = text.match(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/u);
  if (weekdayMatch) {
    const target = WEEKDAY_INDEX[weekdayMatch[2]];
    const current = today.getDay();
    let delta = (target - current + 7) % 7;
    if (delta === 0 || weekdayMatch[1]) {
      delta += 7;
    }
    return addDays(today, delta);
  }

  return null;
}

export function inferPlanningTargetDateFromText(rawText = '', now = new Date()) {
  const eventDate = inferEventDateFromText(rawText, now);
  if (!eventDate) {
    return '';
  }

  const text = `${rawText || ''}`.toLowerCase();
  const isPauseReminder = /\bpaus(?:e|ed|ing)\b/u.test(text);
  const shouldBeDoneBefore = /\b(pause|away|off|cover|cancel lesson|no lesson|holiday)\b/u.test(text);
  let targetDate = shouldBeDoneBefore ? addDays(eventDate, -1) : eventDate;

  if (isPauseReminder) {
    for (let daysBefore = 2; daysBefore <= 5; daysBefore += 1) {
      const candidate = addDays(eventDate, -daysBefore);
      if (PLANNING_MEETING_DAYS.has(candidate.getDay())) {
        targetDate = candidate;
        break;
      }
    }
  }

  return formatDateInput(targetDate);
}

export function buildStructuredPausePlanningDraft({
  studentName = '',
  pauseType = 'single',
  lessonDate = '',
  firstPauseDate = '',
  returnDate = '',
  extraNote = '',
  now = new Date(),
} = {}) {
  const type = pauseType === 'range' ? 'range' : 'single';
  const studentLabel = `${studentName || ''}`.trim() || 'student';
  const trimmedNote = `${extraNote || ''}`.trim();

  const firstDate = parseDateInputValue(type === 'range' ? firstPauseDate : lessonDate);
  const backDate = type === 'range' ? parseDateInputValue(returnDate) : null;
  const missingFields = [];

  if (!firstDate) {
    missingFields.push(type === 'range' ? 'first lesson to pause' : 'lesson date');
  }
  if (type === 'range' && !backDate) {
    missingFields.push('returning from date');
  }

  if (missingFields.length) {
    return {
      isComplete: false,
      missingFields,
      title: '',
      notes: '',
      nextAction: '',
      targetDate: '',
      progressNote: '',
    };
  }

  const targetDate = inferPlanningTargetDateFromText(
    `Pause ${studentLabel} for ${formatUkNumericDate(firstDate)}`,
    now,
  );

  if (type === 'single') {
    const readableLessonDate = formatReadableDate(firstDate);
    return {
      isComplete: true,
      missingFields: [],
      title: `Pause ${studentLabel} lesson on ${readableLessonDate}`,
    notes: [
      `Pause type: single lesson.`,
      `Lesson to pause: ${readableLessonDate}.`,
      `Lesson date: ${lessonDate}.`,
      trimmedNote ? `Extra note: ${trimmedNote}` : '',
    ].filter(Boolean).join('\n'),
      nextAction: 'Run pause tool for this lesson, then confirm the payment pause message has been sent.',
      targetDate,
      progressNote: 'Captured with structured pause helper.',
    };
  }

  const readableFirstDate = formatReadableDate(firstDate);
  const readableReturnDate = formatReadableDate(backDate);
  return {
    isComplete: true,
    missingFields: [],
    title: `Pause ${studentLabel} from ${readableFirstDate}; returning ${readableReturnDate}`,
    notes: [
      `Pause type: away period.`,
      `First lesson to pause: ${readableFirstDate}.`,
      `First lesson to pause date: ${firstPauseDate}.`,
      `Returning from: ${readableReturnDate}.`,
      `Returning from date: ${returnDate}.`,
      `Use the return date as the first lesson/date they are expected back, not the last lesson to pause.`,
      trimmedNote ? `Extra note: ${trimmedNote}` : '',
    ].filter(Boolean).join('\n'),
    nextAction: 'Run pause tool for the missed lessons in this period, then confirm the payment pause message has been sent.',
    targetDate,
    progressNote: 'Captured with structured pause helper.',
  };
}

export function buildPauseLessonDateSuggestions(scheduleContext = null, {
  now = new Date(),
  count = 6,
  startDate = '',
} = {}) {
  if (!scheduleContext || scheduleContext.status !== 'found') {
    return [];
  }

  let nextLesson = parseFlexibleDate(scheduleContext.nextLessonAt);
  if (!nextLesson) {
    return [];
  }

  const requestedStart = parseDateInputValue(startDate);

  const today = startOfLocalDay(now);
  nextLesson = startOfLocalDay(nextLesson);

  while (nextLesson < today) {
    nextLesson = addDays(nextLesson, 7);
  }

  if (requestedStart) {
    nextLesson = startOfLocalDay(requestedStart);
  }

  const limitedCount = Math.max(1, Math.min(Number(count) || 6, 10));
  return Array.from({ length: limitedCount }, (_, index) => {
    const date = addDays(nextLesson, index * 7);
    const dateValue = formatDateInput(date);
    return {
      date: dateValue,
      label: formatReadableDate(date),
      lessonLabel: [
        formatReadableDate(date),
        scheduleContext.usualTime || '',
        scheduleContext.teacherName ? `with ${scheduleContext.teacherName}` : '',
      ].filter(Boolean).join(' '),
    };
  });
}

export function normalisePlanningItemType(value) {
  return normaliseEnum(value, PLANNING_ITEM_TYPES, 'idea');
}

export function normalisePlanningStatus(value) {
  return normaliseEnum(value, PLANNING_STATUSES, 'inbox');
}

export function normalisePlanningArea(value) {
  return normaliseEnum(value, PLANNING_AREAS, 'other');
}

export function normalisePlanningOwner(value) {
  const trimmed = `${value || ''}`.trim();
  return PLANNING_OWNERS.includes(trimmed) ? trimmed : 'Unassigned';
}

export function normalisePlanningProgressType(value) {
  return normaliseEnum(value, PLANNING_PROGRESS_TYPES, 'note');
}

export function labelPlanningStatus(value) {
  return STATUS_LABELS[normalisePlanningStatus(value)] || 'Inbox';
}

export function labelPlanningType(value) {
  return TYPE_LABELS[normalisePlanningItemType(value)] || 'Idea';
}

export function labelPlanningArea(value) {
  return AREA_LABELS[normalisePlanningArea(value)] || 'Other';
}

export function labelPlanningMomentum(value) {
  return MOMENTUM_LABELS[value] || 'Steady';
}

export function normalisePlanningItem(row = {}) {
  return {
    planningId: `${row.planningId || ''}`.trim(),
    title: `${row.title || ''}`.trim(),
    notes: `${row.notes || ''}`.trim(),
    itemType: normalisePlanningItemType(row.itemType),
    owner: normalisePlanningOwner(row.owner),
    status: normalisePlanningStatus(row.status),
    area: normalisePlanningArea(row.area),
    linkedWorkflowId: `${row.linkedWorkflowId || ''}`.trim(),
    linkedStudentId: `${row.linkedStudentId || ''}`.trim(),
    linkedTutorId: `${row.linkedTutorId || ''}`.trim(),
    parentPlanningId: `${row.parentPlanningId || ''}`.trim(),
    outcome: `${row.outcome || ''}`.trim(),
    nextAction: `${row.nextAction || ''}`.trim(),
    targetDate: `${row.targetDate || ''}`.trim(),
    createdAt: `${row.createdAt || ''}`.trim(),
    updatedAt: `${row.updatedAt || ''}`.trim(),
    createdBy: `${row.createdBy || ''}`.trim(),
    lastUpdatedBy: `${row.lastUpdatedBy || ''}`.trim(),
  };
}

export function normalisePlanningProgress(row = {}) {
  return {
    progressId: `${row.progressId || ''}`.trim(),
    planningId: `${row.planningId || ''}`.trim(),
    progressNote: `${row.progressNote || ''}`.trim(),
    progressType: normalisePlanningProgressType(row.progressType),
    createdAt: `${row.createdAt || ''}`.trim(),
    createdBy: `${row.createdBy || ''}`.trim(),
  };
}

function parseDateMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function ageDaysSince(value, now = new Date()) {
  const parsed = parseDateMs(value);
  if (!parsed) {
    return null;
  }
  return Math.floor((now.getTime() - parsed) / 86_400_000);
}

export function derivePlanningMomentum(item = {}, progress = [], now = new Date()) {
  const status = normalisePlanningStatus(item.status);
  const itemType = normalisePlanningItemType(item.itemType);

  if (status === 'done') {
    return 'done';
  }
  if (status === 'parked') {
    return 'parked';
  }
  if (status === 'inbox' && itemType === 'idea') {
    return 'inbox';
  }

  const latestProgress = [...progress]
    .filter((entry) => entry.planningId === item.planningId)
    .sort((a, b) => parseDateMs(b.createdAt) - parseDateMs(a.createdAt))[0] || null;
  const latestActivityAt = [item.updatedAt, latestProgress?.createdAt]
    .filter(Boolean)
    .sort((a, b) => parseDateMs(b) - parseDateMs(a))[0] || '';
  const activityAgeDays = ageDaysSince(latestActivityAt, now);
  const needsNextAction = ['initiative', 'action'].includes(itemType) && !`${item.nextAction || ''}`.trim();

  if (needsNextAction) {
    return 'no_next_action';
  }
  if (typeof activityAgeDays === 'number' && activityAgeDays <= 7) {
    return 'moving';
  }
  if (['active', 'waiting'].includes(status) && (activityAgeDays === null || activityAgeDays >= 14)) {
    return 'stalled';
  }
  return 'steady';
}

export function attachPlanningProgress(items = [], progressRows = [], now = new Date()) {
  const normalisedProgress = progressRows.map(normalisePlanningProgress);
  const progressByPlanningId = new Map();

  for (const entry of normalisedProgress) {
    if (!entry.planningId) {
      continue;
    }
    const entries = progressByPlanningId.get(entry.planningId) || [];
    entries.push(entry);
    progressByPlanningId.set(entry.planningId, entries);
  }

  return items.map((itemRow) => {
    const item = normalisePlanningItem(itemRow);
    const progress = (progressByPlanningId.get(item.planningId) || [])
      .sort((a, b) => parseDateMs(b.createdAt) - parseDateMs(a.createdAt));
    const momentum = derivePlanningMomentum(item, progress, now);

    return {
      ...item,
      statusLabel: labelPlanningStatus(item.status),
      itemTypeLabel: labelPlanningType(item.itemType),
      areaLabel: labelPlanningArea(item.area),
      momentum,
      momentumLabel: labelPlanningMomentum(momentum),
      progress,
      latestProgress: progress[0] || null,
    };
  });
}

function isDateInput(value = '') {
  return /^\d{4}-\d{2}-\d{2}$/.test(`${value || ''}`.trim());
}

export function buildPlanningDueSummary(items = [], now = new Date()) {
  const today = formatDateInput(startOfLocalDay(now));
  const activeDatedItems = items
    .map(normalisePlanningItem)
    .filter((item) => !['done', 'parked'].includes(item.status) && isDateInput(item.targetDate));
  const dueTodayItems = activeDatedItems.filter((item) => item.targetDate === today);
  const overdueItems = activeDatedItems.filter((item) => item.targetDate < today);
  const dueNowItems = [...overdueItems, ...dueTodayItems].sort((a, b) => (
    a.targetDate.localeCompare(b.targetDate)
    || a.title.localeCompare(b.title)
  ));

  return {
    today,
    dueToday: dueTodayItems.length,
    overdue: overdueItems.length,
    dueNow: dueNowItems.length,
    firstDueItem: dueNowItems[0] || null,
    dueNowTitles: dueNowItems.slice(0, 3).map((item) => item.title).filter(Boolean),
  };
}

export function buildPlanningSummary(items = [], now = new Date()) {
  const activeItems = items.filter((item) => !['done', 'parked'].includes(item.status));
  const initiatives = items.filter((item) => item.itemType === 'initiative');
  const noNextAction = activeItems.filter((item) => item.momentum === 'no_next_action').length;
  const stalled = activeItems.filter((item) => item.momentum === 'stalled').length;
  const dueSummary = buildPlanningDueSummary(items, now);

  return {
    total: items.length,
    open: activeItems.length,
    inbox: items.filter((item) => item.status === 'inbox').length,
    active: items.filter((item) => item.status === 'active').length,
    waiting: items.filter((item) => item.status === 'waiting').length,
    done: items.filter((item) => item.status === 'done').length,
    parked: items.filter((item) => item.status === 'parked').length,
    initiatives: initiatives.length,
    activeInitiatives: initiatives.filter((item) => item.status === 'active').length,
    moving: activeItems.filter((item) => item.momentum === 'moving').length,
    stalled,
    noNextAction,
    needsAttention: noNextAction + stalled,
    dueToday: dueSummary.dueToday,
    overdue: dueSummary.overdue,
    dueNow: dueSummary.dueNow,
    dueNowTitles: dueSummary.dueNowTitles,
  };
}
