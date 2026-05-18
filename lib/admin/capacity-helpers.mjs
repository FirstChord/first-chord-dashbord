const DEFAULT_TIME_ZONE = 'Europe/London';
const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function parseMmsCalendarWallClock(value) {
  const match = `${value || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const weekdayDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return {
    weekdayDate,
    time: `${hour}:${minute}`,
  };
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatWeekday(value) {
  const wallClock = parseMmsCalendarWallClock(value);
  if (wallClock) {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(wallClock.weekdayDate);
  }

  const date = parseDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(date);
}

function formatTime(value) {
  const wallClock = parseMmsCalendarWallClock(value);
  if (wallClock) return wallClock.time;

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
      slot.teacherId || teacherKey,
      teacherKey,
      weekdayKey,
      slot.startTime || '',
      slot.durationMinutes || '',
    ].join('::');

    if (!weeklySlotKeys.has(weeklyKey)) {
      weeklySlotKeys.set(weeklyKey, {
        teacherId: slot.teacherId || '',
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

function normaliseInstrumentKey(value = '') {
  return `${value || ''}`.trim().toLowerCase();
}

function buildTutorLookup(tutors = []) {
  const byTeacherId = new Map();
  const byName = new Map();

  for (const tutor of tutors) {
    const record = {
      teacherId: tutor.teacherId || '',
      teacherName: tutor.fullName || tutor.teacherName || '',
      instruments: (tutor.instruments || []).map(normaliseInstrumentKey).filter(Boolean),
    };
    if (record.teacherId) byTeacherId.set(record.teacherId, record);
    if (record.teacherName) byName.set(record.teacherName.toLowerCase(), record);
  }

  return { byTeacherId, byName };
}

function findTutorForSlot(slot, tutorLookup) {
  if (slot.teacherId && tutorLookup.byTeacherId.has(slot.teacherId)) {
    return tutorLookup.byTeacherId.get(slot.teacherId);
  }

  const teacherName = `${slot.teacherName || ''}`.toLowerCase();
  return tutorLookup.byName.get(teacherName) || null;
}

function sortByWeekdayThenTime(a, b) {
  const weekdayDiff = WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday);
  if (weekdayDiff) return weekdayDiff;
  return a.startTime.localeCompare(b.startTime)
    || a.teacherName.localeCompare(b.teacherName)
    || a.durationMinutes.localeCompare(b.durationMinutes);
}

function groupMatchesByDay(matches = [], maxDays = 3) {
  const byDay = new Map();

  for (const match of matches.sort(sortByWeekdayThenTime)) {
    if (!byDay.has(match.weekday)) {
      byDay.set(match.weekday, new Map());
    }

    const tutorKey = match.teacherName || match.teacherId || 'Unknown tutor';
    const dayTutors = byDay.get(match.weekday);
    if (!dayTutors.has(tutorKey)) {
      dayTutors.set(tutorKey, {
        teacherId: match.teacherId,
        teacherName: tutorKey,
        matchedInstruments: [],
        slots: [],
      });
    }

    const tutorGroup = dayTutors.get(tutorKey);
    tutorGroup.matchedInstruments = [
      ...new Set([...tutorGroup.matchedInstruments, ...match.matchedInstruments]),
    ];
    tutorGroup.slots.push({
      startTime: match.startTime,
      durationMinutes: match.durationMinutes,
      occurrenceCount: match.occurrenceCount,
    });
  }

  return [...byDay.entries()]
    .slice(0, maxDays)
    .map(([weekday, tutorMap]) => ({
      weekday,
      tutors: [...tutorMap.values()].map((tutor) => ({
        ...tutor,
        slots: tutor.slots.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      })),
    }));
}

export function buildWaitingCapacityMatches({
  waitingStudents = [],
  freeSlots = [],
  tutors = [],
  maxDays = 5,
} = {}) {
  const weeklySlots = buildFreeSlotSummary(freeSlots).weeklySlots;
  const tutorLookup = buildTutorLookup(tutors);

  return waitingStudents.map((student) => {
    const wantedInstruments = (student.instruments || [])
      .map(normaliseInstrumentKey)
      .filter(Boolean);

    if (!wantedInstruments.length) {
      return {
        ...student,
        capacityMatchStatus: 'instrument_unknown',
        capacityMatchReason: 'Instrument could not be parsed from the MMS sign-up note.',
        capacityMatches: [],
        capacityMatchDays: [],
      };
    }

    const matches = weeklySlots
      .map((slot) => ({
        ...slot,
        tutor: findTutorForSlot(slot, tutorLookup),
      }))
      .filter((slot) => slot.tutor?.instruments.some((instrument) => wantedInstruments.includes(instrument)))
      .map((slot) => ({
        teacherId: slot.teacherId,
        teacherName: slot.teacherName,
        weekday: slot.weekday,
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
        occurrenceCount: slot.occurrenceCount,
        matchedInstruments: slot.tutor.instruments
          .filter((instrument) => wantedInstruments.includes(instrument)),
      }))
      .sort(sortByWeekdayThenTime);
    const capacityMatchDays = groupMatchesByDay(matches, maxDays);

    return {
      ...student,
      capacityMatchStatus: matches.length ? 'matched' : 'no_match',
      capacityMatchReason: matches.length
        ? 'Matched by parsed waiting-list instrument and tutor instrument coverage.'
        : 'No current MMS Free slots match the parsed waiting-list instrument.',
      capacityMatches: matches,
      capacityMatchDays,
    };
  });
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
