const DEFAULT_TIME_ZONE = 'Europe/London';

function parseMmsWallClock(value = '') {
  const match = `${value || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    sortKey: `${year}-${month}-${day}T${hour}:${minute}`,
  };
}

function formatTime(value = '') {
  const wallClock = parseMmsWallClock(value);
  if (wallClock) return wallClock.time;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DEFAULT_TIME_ZONE,
  }).format(parsed);
}

function studentIdsForEvent(event = {}) {
  const ids = new Set();
  if (event.StudentID) ids.add(event.StudentID);
  for (const id of event.StudentIDs || []) {
    if (id) ids.add(id);
  }
  for (const attendance of event.Attendances || []) {
    if (attendance.StudentID) ids.add(attendance.StudentID);
  }
  for (const student of event.Students || []) {
    if (student.ID) ids.add(student.ID);
  }
  return [...ids];
}

function studentNamesForEvent(event = {}) {
  const names = new Set();
  for (const student of event.Students || []) {
    const name = student.FullName || [student.FirstName, student.LastName].filter(Boolean).join(' ').trim();
    if (name) names.add(name);
  }
  for (const attendance of event.Attendances || []) {
    const name = attendance.StudentFullName
      || attendance.StudentName
      || attendance.Student?.Name
      || attendance.Student?.FullName
      || [attendance.Student?.FirstName, attendance.Student?.LastName].filter(Boolean).join(' ').trim();
    if (name) names.add(name);
  }
  if (event.Student?.Name) names.add(event.Student.Name);
  if (event.StudentName) names.add(event.StudentName);
  if (event.StudentFullName) names.add(event.StudentFullName);
  return [...names];
}

function eventCategoryName(event = {}) {
  return event.EventCategory?.Name
    || event.EventCategoryName
    || event.EventCategory
    || '';
}

function eventDuration(event = {}) {
  return Number(event.Duration || event.EventDuration || event.DurationMinutes || 0) || 0;
}

function normaliseAttendanceStatus(status = '') {
  return `${status || ''}`.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function buildAttendanceSummary(statuses = []) {
  const rawStatuses = [...new Set((statuses || []).filter(Boolean))];
  const normalised = rawStatuses.map(normaliseAttendanceStatus).filter(Boolean);

  if (normalised.length === 0 || normalised.every((status) => status === 'unrecorded')) {
    return {
      label: 'Expected',
      detail: 'Attendance not marked yet',
      tone: 'expected',
      expectedAbsent: false,
      absenceNotice: 'none',
      requiresPracticeVideo: false,
      statuses: rawStatuses,
    };
  }

  const withNotice = normalised.filter((status) => (
    status === 'absentnotice'
    || status === 'absentwithnotice'
    || status === 'absentmakeup'
  )).length;
  const withoutNotice = normalised.filter((status) => (
    status === 'absentnomakeup'
    || status === 'absentwithoutnotice'
    || status === 'noshow'
  )).length;
  const teacherAbsent = normalised.filter((status) => (
    status === 'teacherabsentmakeup'
    || status === 'teacherabsent'
  )).length;
  const present = normalised.filter((status) => (
    status === 'present'
    || status === 'attended'
    || status === 'completed'
  )).length;

  if (withNotice && withNotice === normalised.length) {
    return {
      label: 'Absent',
      detail: 'Notice given',
      tone: 'notice',
      expectedAbsent: true,
      absenceNotice: 'with_notice',
      requiresPracticeVideo: false,
      statuses: rawStatuses,
    };
  }

  if (withoutNotice && withoutNotice === normalised.length) {
    return {
      label: 'Absent',
      detail: 'No notice recorded',
      tone: 'absent',
      expectedAbsent: true,
      absenceNotice: 'without_notice',
      requiresPracticeVideo: false,
      statuses: rawStatuses,
    };
  }

  if (teacherAbsent && teacherAbsent === normalised.length) {
    return {
      label: 'Tutor absent',
      detail: 'Handled by admin',
      tone: 'teacher_absent',
      expectedAbsent: false,
      absenceNotice: 'none',
      requiresPracticeVideo: false,
      statuses: rawStatuses,
    };
  }

  if (present && present === normalised.length) {
    return {
      label: 'Marked present',
      detail: '',
      tone: 'present',
      expectedAbsent: false,
      absenceNotice: 'none',
      requiresPracticeVideo: false,
      statuses: rawStatuses,
    };
  }

  if (withNotice) {
    return {
      label: 'Some absent',
      detail: 'Notice given',
      tone: 'notice',
      expectedAbsent: true,
      absenceNotice: 'with_notice',
      requiresPracticeVideo: false,
      statuses: rawStatuses,
    };
  }

  if (withoutNotice) {
    return {
      label: 'Some absent',
      detail: 'No notice recorded',
      tone: 'absent',
      expectedAbsent: true,
      absenceNotice: 'without_notice',
      requiresPracticeVideo: false,
      statuses: rawStatuses,
    };
  }

  return {
    label: 'Status recorded',
    detail: rawStatuses.join(', '),
    tone: 'mixed',
    expectedAbsent: false,
    absenceNotice: 'unknown',
    requiresPracticeVideo: false,
    statuses: rawStatuses,
  };
}

export function normaliseTutorScheduleEvent(event = {}) {
  const studentIds = studentIdsForEvent(event);
  const studentNames = studentNamesForEvent(event);
  const wallClock = parseMmsWallClock(event.StartDate || event.EventStartDate || '');
  const attendanceStatuses = [...new Set((event.Attendances || []).map((attendance) => attendance.AttendanceStatus).filter(Boolean))];

  return {
    eventId: event.ID || event.EventID || '',
    startAt: event.StartDate || event.EventStartDate || '',
    lessonDate: wallClock?.date || '',
    lessonTime: formatTime(event.StartDate || event.EventStartDate || ''),
    sortKey: wallClock?.sortKey || event.StartDate || event.EventStartDate || '',
    durationMinutes: eventDuration(event),
    studentMmsIds: studentIds,
    studentNames,
    studentLabel: studentNames.join(', ') || 'Unknown student',
    studentCount: studentIds.length || studentNames.length || 0,
    teacherId: event.TeacherID || event.OriginalTeacherID || '',
    category: eventCategoryName(event),
    attendanceIds: (event.Attendances || []).map((attendance) => attendance.ID).filter(Boolean),
    attendanceStatuses,
    attendanceSummary: buildAttendanceSummary(attendanceStatuses),
    isFreeSlot: eventCategoryName(event).trim().toLowerCase() === 'free',
  };
}

export function buildTutorDaySchedule(events = []) {
  const lessons = (events || [])
    .map(normaliseTutorScheduleEvent)
    .filter((lesson) => lesson.eventId && !lesson.isFreeSlot)
    .sort((a, b) => (
      `${a.sortKey || ''}`.localeCompare(`${b.sortKey || ''}`)
      || `${a.studentLabel || ''}`.localeCompare(`${b.studentLabel || ''}`)
    ));

  return {
    lessons,
    lessonCount: lessons.length,
    studentCount: lessons.reduce((sum, lesson) => sum + Math.max(lesson.studentCount, 1), 0),
    firstLessonTime: lessons[0]?.lessonTime || '',
    lastLessonTime: lessons[lessons.length - 1]?.lessonTime || '',
  };
}
