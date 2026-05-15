const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function normaliseDate(value) {
  const parsed = new Date(value || '');
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/London',
  });
}

function sameUsualSlot(event, firstEvent) {
  if (!event || !firstEvent) return false;
  const eventStart = normaliseDate(event.StartDate);
  const firstStart = normaliseDate(firstEvent.StartDate);
  if (!eventStart || !firstStart) return false;

  return Boolean(
    event.SeriesID
    && firstEvent.SeriesID
    && event.SeriesID === firstEvent.SeriesID
    && formatTime(eventStart) === formatTime(firstStart)
    && Number(event.Duration || 0) === Number(firstEvent.Duration || 0)
    && (event.TeacherID || event.OriginalTeacherID || '') === (firstEvent.TeacherID || firstEvent.OriginalTeacherID || ''),
  );
}

function getTeacherName(event = {}) {
  return event.Teacher?.Name || event.TeacherName || '';
}

function getEventCategory(event = {}) {
  return event.EventCategory?.Name || event.EventCategoryName || '';
}

function getBillingProfile(student = {}) {
  return (student.BillingProfiles || []).find((profile) => profile.Active !== false) || null;
}

export function deriveScheduleContextFromMms({
  student = {},
  events = [],
  checkedAt = new Date().toISOString(),
  lookaheadDays = 60,
} = {}) {
  const sortedEvents = [...events]
    .filter((event) => normaliseDate(event.StartDate))
    .sort((a, b) => normaliseDate(a.StartDate).getTime() - normaliseDate(b.StartDate).getTime());
  const nextEvent = sortedEvents[0] || null;
  const billingProfile = getBillingProfile(student);
  const warnings = [];

  if (!student.ID) {
    return {
      mmsId: '',
      studentName: '',
      status: 'missing_identity',
      nextLessonAt: '',
      usualWeekday: '',
      usualTime: '',
      durationMinutes: '',
      teacherId: '',
      teacherName: '',
      eventCategory: '',
      seriesId: '',
      source: 'mms_calendar',
      confidence: 'low',
      warnings: ['No MMS student record was provided.'],
      checkedAt,
    };
  }

  if (!nextEvent) {
    if (student.NextEventDate) {
      warnings.push('MMS student record has NextEventDate, but calendar search did not return a matching upcoming event.');
    } else {
      warnings.push(`No upcoming MMS calendar events found in the next ${lookaheadDays} days.`);
    }

    return {
      mmsId: student.ID || '',
      studentName: student.FullName || [student.FirstName, student.LastName].filter(Boolean).join(' ').trim(),
      status: 'not_found',
      nextLessonAt: student.NextEventDate || '',
      usualWeekday: '',
      usualTime: '',
      durationMinutes: billingProfile?.LessonDuration ? String(billingProfile.LessonDuration) : '',
      teacherId: billingProfile?.TeacherID || '',
      teacherName: '',
      eventCategory: '',
      seriesId: '',
      source: 'mms_calendar',
      confidence: student.NextEventDate ? 'low' : 'low',
      warnings,
      checkedAt,
    };
  }

  const nextStart = normaliseDate(nextEvent.StartDate);
  const matchingSeriesEvents = sortedEvents.filter((event) => sameUsualSlot(event, nextEvent));
  const confidence = matchingSeriesEvents.length >= 2 ? 'high' : 'medium';

  if (matchingSeriesEvents.length < 2) {
    warnings.push('Only one upcoming event matched this slot, so the usual schedule is inferred from the next lesson.');
  }

  if (billingProfile?.TeacherID && billingProfile.TeacherID !== (nextEvent.TeacherID || nextEvent.OriginalTeacherID || '')) {
    warnings.push('Billing profile teacher does not match the next calendar event teacher.');
  }

  if (billingProfile?.LessonDuration && Number(billingProfile.LessonDuration) !== Number(nextEvent.Duration || 0)) {
    warnings.push('Billing profile lesson duration does not match the next calendar event duration.');
  }

  return {
    mmsId: student.ID || '',
    studentName: student.FullName || [student.FirstName, student.LastName].filter(Boolean).join(' ').trim(),
    status: 'found',
    nextLessonAt: nextEvent.StartDate || student.NextEventDate || '',
    usualWeekday: nextStart ? DAY_NAMES[nextStart.getDay()] : '',
    usualTime: nextStart ? formatTime(nextStart) : '',
    durationMinutes: nextEvent.Duration ? String(nextEvent.Duration) : billingProfile?.LessonDuration ? String(billingProfile.LessonDuration) : '',
    teacherId: nextEvent.TeacherID || nextEvent.OriginalTeacherID || billingProfile?.TeacherID || '',
    teacherName: getTeacherName(nextEvent),
    eventCategory: getEventCategory(nextEvent),
    seriesId: nextEvent.SeriesID || '',
    source: 'mms_calendar',
    confidence,
    warnings,
    checkedAt,
  };
}

function sharedSlotKey(row = {}) {
  if (row.status !== 'found' || !row.nextLessonAt || !row.teacherId) {
    return '';
  }

  return [
    row.teacherId,
    row.nextLessonAt,
    row.durationMinutes || '',
  ].join('::');
}

export function enrichScheduleContextsWithSharedSlots(scheduleRows = []) {
  const bySlot = new Map();

  for (const row of scheduleRows) {
    const key = sharedSlotKey(row);
    if (!key) continue;

    const list = bySlot.get(key) || [];
    list.push(row);
    bySlot.set(key, list);
  }

  return new Map(scheduleRows.map((row) => {
    const sharedRows = bySlot.get(sharedSlotKey(row)) || [];
    return [
      row.mmsId,
      {
        ...row,
        sharedStudentCount: sharedRows.length || 0,
        sharedStudentNames: sharedRows.map((entry) => entry.studentName).filter(Boolean),
        sharedStudentMmsIds: sharedRows.map((entry) => entry.mmsId).filter(Boolean),
      },
    ];
  }));
}
