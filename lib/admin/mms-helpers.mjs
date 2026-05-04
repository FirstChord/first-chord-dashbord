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
  }

  return result;
}

export function parseLessonDateTime(date, time) {
  if (!date || !time) {
    throw new Error('Lesson date and time are required');
  }

  const combined = `${date}T${time}:00`;
  const parsed = new Date(combined);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Could not parse lesson date/time');
  }

  return parsed.toISOString();
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
