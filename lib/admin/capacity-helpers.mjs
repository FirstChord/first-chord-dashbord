const DEFAULT_TIME_ZONE = 'Europe/London';

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatWeekday(value) {
  const date = parseDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}

function formatTime(value) {
  const date = parseDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}

function getEventCategory(event = {}) {
  return event.EventCategory?.Name || event.EventCategoryName || '';
}

function getTeacherName(event = {}) {
  return event.Teacher?.DisplayName
    || event.Teacher?.Name
    || event.TeacherName
    || event.OriginalTeacher?.DisplayName
    || event.OriginalTeacher?.Name
    || '';
}

export function isFreeCalendarEvent(event = {}) {
  return getEventCategory(event).trim().toLowerCase() === 'free';
}

export function normaliseFreeCalendarSlot(event = {}) {
  return {
    eventId: event.ID || '',
    startAt: event.StartDate || '',
    weekday: formatWeekday(event.StartDate),
    startTime: formatTime(event.StartDate),
    durationMinutes: event.Duration ? String(event.Duration) : '',
    teacherId: event.TeacherID || event.OriginalTeacherID || '',
    teacherName: getTeacherName(event),
    eventCategory: getEventCategory(event),
    studentCount: Array.isArray(event.Students)
      ? event.Students.length
      : Array.isArray(event.StudentIDs)
        ? event.StudentIDs.length
        : 0,
  };
}

export function buildFreeSlotSummary(slots = []) {
  const weeklySlotKeys = new Map();
  const byWeekday = new Map();

  for (const slot of slots) {
    const teacherKey = slot.teacherName || slot.teacherId || 'Unknown tutor';
    const weekdayKey = slot.weekday || 'Unknown day';
    const weeklyKey = [
      teacherKey,
      weekdayKey,
      slot.startTime || '',
      slot.durationMinutes || '',
    ].join('::');

    if (!weeklySlotKeys.has(weeklyKey)) {
      weeklySlotKeys.set(weeklyKey, {
        teacherName: teacherKey,
        weekday: weekdayKey,
        startTime: slot.startTime || '',
        durationMinutes: slot.durationMinutes || '',
        occurrenceCount: 0,
      });
    }

    weeklySlotKeys.get(weeklyKey).occurrenceCount += 1;
  }

  const weeklySlots = [...weeklySlotKeys.values()];
  const byTeacher = new Map();

  for (const slot of weeklySlots) {
    byTeacher.set(slot.teacherName, (byTeacher.get(slot.teacherName) || 0) + 1);
    byWeekday.set(slot.weekday, (byWeekday.get(slot.weekday) || 0) + 1);
  }

  return {
    totalEvents: slots.length,
    totalWeeklySlots: weeklySlots.length,
    tutorCount: byTeacher.size,
    byTeacher: [...byTeacher.entries()]
      .map(([teacherName, weeklySlotCount]) => ({ teacherName, weeklySlotCount }))
      .sort((a, b) => b.weeklySlotCount - a.weeklySlotCount || a.teacherName.localeCompare(b.teacherName)),
    byWeekday: [...byWeekday.entries()].map(([weekday, weeklySlotCount]) => ({ weekday, weeklySlotCount })),
    weeklySlots: weeklySlots.sort((a, b) => (
      a.teacherName.localeCompare(b.teacherName)
      || a.weekday.localeCompare(b.weekday)
      || a.startTime.localeCompare(b.startTime)
    )),
  };
}

export function buildScheduleCacheSummary(scheduleRows = [], { staleAfterDays = 21 } = {}) {
  const now = Date.now();
  const staleAfterMs = staleAfterDays * 24 * 60 * 60 * 1000;
  const sharedSlots = new Map();
  let found = 0;
  let missing = 0;
  let error = 0;
  let stale = 0;
  let missingTeacher = 0;
  let missingDuration = 0;
  let lowConfidence = 0;

  for (const row of scheduleRows) {
    if (row.status === 'found') found += 1;
    else if (row.status === 'missing') missing += 1;
    else if (row.status === 'error') error += 1;

    const checkedAt = parseDate(row.checkedAt);
    if (!checkedAt || now - checkedAt.getTime() > staleAfterMs) {
      stale += 1;
    }

    if (row.status === 'found' && !row.teacherId) missingTeacher += 1;
    if (row.status === 'found' && !row.durationMinutes) missingDuration += 1;
    if (row.confidence === 'low') lowConfidence += 1;

    if (row.status === 'found' && row.teacherId && row.nextLessonAt && row.durationMinutes) {
      const key = [row.teacherId, row.nextLessonAt, row.durationMinutes].join('::');
      const list = sharedSlots.get(key) || [];
      list.push(row);
      sharedSlots.set(key, list);
    }
  }

  const sharedSlotGroups = [...sharedSlots.values()].filter((rows) => rows.length > 1);

  return {
    totalCached: scheduleRows.length,
    found,
    missing,
    error,
    stale,
    lowConfidence,
    missingTeacher,
    missingDuration,
    sharedSlotGroups: sharedSlotGroups.length,
    sharedStudents: sharedSlotGroups.reduce((total, rows) => total + rows.length, 0),
  };
}
