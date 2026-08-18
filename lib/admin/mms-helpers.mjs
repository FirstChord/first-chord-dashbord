/** @fileoverview Pure parsing and payload building for My Music Staff notes, lessons, calendar events, and billing profiles. */
export function parseNoteFields(noteText) {
  if (!noteText) return {};

  const skip = new Set(['(not provided)', '(not available)', 'not provided', 'n/a', '']);
  const result = {};

  for (const rawLine of noteText.split('\n')) {
    const line = rawLine.trim();
    if (!line.includes(':')) continue;

    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();

    if (skip.has(value.toLowerCase().trim())) continue;

    if (key.includes('instrument')) result.instrument = value;
    else if (key.includes('age') && key.includes('students')) result.age = value;
    else if (key.includes('background') || (key.includes('experience') && key.includes('music'))) result.experience = value;
    else if (key.includes('genre')) result.genres = value;
    else if (key.includes('song')) result.songs = value;
    else if (key.includes('day')) result.preferredDays = value;
    else if (key.includes('time')) result.preferredTimes = value;
  }

  return result;
}

export function parseLessonDateTime(date, time) {
  if (!date || !time) {
    throw new Error('Lesson date and time are required');
  }

  const dateMatch = `${date}`.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = `${time}`.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

  if (!dateMatch || !timeMatch) {
    throw new Error('Could not parse lesson date/time');
  }

  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() !== Number(month) - 1
    || parsed.getUTCDate() !== Number(day)
    || Number(hour) > 23
    || Number(minute) > 59
  ) {
    throw new Error('Could not parse lesson date/time');
  }

  return `${date}T${hour}:${minute}:00`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A pinned Free event is one occurrence of a weekly slot, so onboarding a student
// who starts later than the next free week has to be expressed as a whole-week
// bump from that occurrence. Anything beyond a term's worth of weeks is far more
// likely to be a mistyped date than a real plan.
export const MAX_FREE_SLOT_WEEK_OFFSET = 12;

function parseCalendarDateToUtcMs(value) {
  const match = `${value || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return null;

  const [, year, month, day] = match;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const parsed = new Date(ms);

  if (
    parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() !== Number(month) - 1
    || parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return ms;
}

export function addDaysToCalendarDate(date, days) {
  const ms = parseCalendarDateToUtcMs(date);
  if (ms === null) {
    throw new Error('Could not parse calendar date');
  }

  return new Date(ms + days * MS_PER_DAY).toISOString().slice(0, 10);
}

// Returns how many whole weeks after the pinned Free occurrence the chosen lesson
// date falls, or the reason it is not a repeat of that slot at all. Callers turn
// `reason` into their own wording, so keep this free of user-facing copy.
export function resolveFreeSlotWeekOffset({ slotDate = '', lessonDate = '' } = {}) {
  const slotMs = parseCalendarDateToUtcMs(slotDate);
  const lessonMs = parseCalendarDateToUtcMs(lessonDate);

  if (slotMs === null || lessonMs === null) {
    return { weekOffset: null, reason: 'unparsable' };
  }

  const diffDays = Math.round((lessonMs - slotMs) / MS_PER_DAY);

  if (diffDays < 0) return { weekOffset: null, reason: 'before_slot' };
  if (diffDays % 7 !== 0) return { weekOffset: null, reason: 'different_weekday' };

  const weekOffset = diffDays / 7;
  if (weekOffset > MAX_FREE_SLOT_WEEK_OFFSET) return { weekOffset: null, reason: 'too_far' };

  return { weekOffset, reason: 'ok' };
}

function getCalendarEventCategory(event = {}) {
  return `${event.EventCategory?.Name || event.EventCategoryName || ''}`.trim().toLowerCase();
}

function getCalendarEventTeacherId(event = {}) {
  return event.TeacherID || event.OriginalTeacherID || '';
}

function getCalendarEventStart(event = {}) {
  return `${event.StartDate || ''}`.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/u);
}

function countCalendarEventStudents(event = {}) {
  return [event.Students, event.StudentIDs, event.Attendances]
    .reduce((count, entries) => count + (Array.isArray(entries) ? entries.length : 0), 0);
}

// Picks the occurrence of a weekly Free slot that sits on the bumped lesson date.
// Confirming that occurrence is what makes a bump safe: the pinned event only
// proves the slot was free in its own week.
export function findFreeCalendarOccurrence({
  events = [],
  teacherId = '',
  startDateTime = '',
  durationMinutes = '',
} = {}) {
  if (!teacherId || !startDateTime) return null;

  return events.find((event) => {
    if (getCalendarEventCategory(event) !== 'free') return false;
    if (getCalendarEventTeacherId(event) !== teacherId) return false;

    const start = getCalendarEventStart(event);
    if (!start || `${start[1]}T${start[2]}` !== startDateTime) return false;
    if (Number(event.Duration) !== Number(durationMinutes)) return false;

    return countCalendarEventStudents(event) === 0;
  }) || null;
}

export function validateMmsFreeCalendarEvent({
  event = {},
  eventId = '',
  teacherId = '',
  lessonDate = '',
  lessonTime = '',
  durationMinutes = '',
} = {}) {
  if (!/^evt_[A-Za-z0-9_-]+$/u.test(eventId)) {
    throw new Error('The selected MMS Free event ID is invalid. Return to Waiting and choose the slot again.');
  }

  if (`${event.ID || ''}` !== eventId) {
    throw new Error('The selected MMS Free event no longer matches the event returned by MMS. Return to Waiting and choose the slot again.');
  }

  if (getCalendarEventCategory(event) !== 'free') {
    throw new Error('The selected MMS event is no longer marked Free. It will not be removed.');
  }

  const eventTeacherId = getCalendarEventTeacherId(event);
  if (!teacherId || eventTeacherId !== teacherId) {
    throw new Error('The selected MMS Free event no longer belongs to the selected tutor. It will not be removed.');
  }

  const targetStart = parseLessonDateTime(lessonDate, lessonTime);
  const eventStart = getCalendarEventStart(event);
  const slotDate = eventStart?.[1] || '';

  if (!eventStart || eventStart[2] !== targetStart.slice(11)) {
    throw new Error('The selected MMS Free event no longer matches the chosen lesson date and time. It will not be removed.');
  }

  const { weekOffset, reason } = resolveFreeSlotWeekOffset({ slotDate, lessonDate });

  if (reason === 'before_slot') {
    throw new Error(`The chosen first lesson date is before the selected MMS Free slot on ${slotDate}. Choose that date or a later week.`);
  }
  if (reason === 'different_weekday') {
    throw new Error(`The chosen first lesson date is not a whole number of weeks after the selected MMS Free slot on ${slotDate}. Bump the slot forward in whole weeks, or onboard without it.`);
  }
  if (reason === 'too_far') {
    throw new Error(`The chosen first lesson date is more than ${MAX_FREE_SLOT_WEEK_OFFSET} weeks after the selected MMS Free slot on ${slotDate}. Onboard without the slot and remove it in MMS.`);
  }
  if (reason !== 'ok') {
    throw new Error('The selected MMS Free event no longer matches the chosen lesson date and time. It will not be removed.');
  }

  if (Number(event.Duration) !== Number(durationMinutes)) {
    throw new Error('The selected MMS Free event no longer matches the chosen lesson length. It will not be removed.');
  }

  if (countCalendarEventStudents(event) > 0) {
    throw new Error('The selected MMS Free event now has a student attached. It will not be removed.');
  }

  return {
    eventId,
    teacherId: eventTeacherId,
    startDate: event.StartDate,
    durationMinutes: Number(event.Duration),
    seriesId: event.SeriesID || '',
    slotDate,
    weekOffset,
    lessonStartDateTime: targetStart,
  };
}

export function buildWeeklyRepeatDetails(lessonDate) {
  if (!lessonDate) {
    throw new Error('Lesson date is required to build recurring lesson details');
  }

  const parsed = new Date(`${lessonDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Could not parse recurring lesson date');
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const selectedDay = dayNames[parsed.getDay()];
  const daySelection = Object.fromEntries(dayNames.map((day) => [day, day === selectedDay]));

  return {
    DaySelection: daySelection,
    EndDate: null,
    Frequency: 'Weekly',
    Interval: 1,
    MonthType: 'Absolute',
  };
}

export function buildCalendarEventSearchPayload({
  studentId,
  studentIds = [],
  teacherId,
  lessonDate,
}) {
  const resolvedStudentIds = studentIds.length ? studentIds : studentId ? [studentId] : [];
  return {
    AllDay: null,
    AttendanceStatuses: [],
    EndDate: lessonDate,
    EndTime: null,
    EventCategoryIDs: [],
    EventIDs: [],
    EventLocationIDs: [],
    HideEmptyEvents: false,
    HideFullEvents: false,
    HideUnscheduledTeachersAndLocations: false,
    HoldTimeSlot: null,
    MakeUpCreditRequired: null,
    MaxDuration: null,
    MinDuration: null,
    OriginalTeacherIDs: [],
    SeriesIDs: [],
    ShowEventsWithSubstituteTeachersOnly: false,
    ShowMakeupEventsOnly: false,
    ShowOpenLessonSlots: false,
    StartDate: lessonDate,
    StartTime: null,
    StudentIDs: resolvedStudentIds,
    TeacherIDs: teacherId ? [teacherId] : [],
  };
}

export function findMatchingCalendarEvent({
  events = [],
  studentId,
  studentIds = [],
  teacherId,
  lessonDate,
  lessonTime,
}) {
  const targetStart = parseLessonDateTime(lessonDate, lessonTime).replace(/\.\d{3}Z$/, '');
  const targetStudentIds = studentIds.length ? studentIds : studentId ? [studentId] : [];

  return events.find((event) => {
    if (event.TeacherID !== teacherId && event.OriginalTeacherID !== teacherId) {
      return false;
    }

    if (event.StartDate !== targetStart) {
      return false;
    }

    const attendances = event.Attendances || [];
    return targetStudentIds.every((targetStudentId) =>
      attendances.some((attendance) => attendance.StudentID === targetStudentId),
    );
  }) || null;
}

export function formatMmsErrorBody(body) {
  if (!body) return '';
  if (typeof body === 'string') return body;

  if (body.ErrorMessage) return body.ErrorMessage;
  if (body.Message) return body.Message;

  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

export function buildBillingProfilePayload({
  studentId,
  teacherId,
  lessonDuration = 30,
  billingRate = 30,
  eventCategoryId = 'ect_5cxpJ9',
}) {
  return {
    BillingRate: Number(billingRate),
    DefaultBillingMode: 'PerLesson',
    EventCategoryID: eventCategoryId,
    LessonDuration: Number(lessonDuration),
    MakeUpMinutes: 0,
    StudentID: studentId,
    TeacherID: teacherId,
  };
}

export function buildCalendarEventPayload({
  studentId,
  studentIds = [],
  teacherId,
  lessonDate,
  lessonTime,
  durationMinutes = 30,
  eventCategoryId = '',
  billingProfile = null,
  isRecurring = true,
}) {
  const eventStartDate = parseLessonDateTime(lessonDate, lessonTime);
  const resolvedCategoryId = eventCategoryId || billingProfile?.EventCategoryID || null;
  const resolvedStudentIds = studentIds.length ? studentIds : studentId ? [studentId] : [];

  return {
    AllDay: false,
    StudentIDs: resolvedStudentIds,
    Description: '',
    DisplayDescriptionOnCalendar: false,
    Duration: Number(durationMinutes),
    EventCategoryID: resolvedCategoryId,
    EventLocationID: null,
    EventTaxIDs: [],
    HoldTimeSlot: false,
    IsPublic: true,
    MakeupRequired: false,
    MaximumNumberOfParticipants: Math.max(resolvedStudentIds.length, 0),
    OriginalTeacherID: teacherId,
    PricePerParticipant: null,
    PricePerParticipantType: 'ParticipantDefaultPrice',
    PrivateDescription: '',
    RepeatDetails: isRecurring ? buildWeeklyRepeatDetails(lessonDate) : null,
    StartDate: eventStartDate.replace(/\.\d{3}Z$/, ''),
    TeacherID: teacherId,
    biller: billingProfile,
  };
}
