import {
  buildBillingProfilePayload,
  buildCalendarEventPayload,
  buildCalendarEventSearchPayload,
  findMatchingCalendarEvent,
  formatMmsErrorBody,
  parseNoteFields,
} from './mms-helpers.mjs';
import { deriveScheduleContextFromMms } from './schedule-context-helpers.mjs';
import { isFreeCalendarEvent, normaliseFreeCalendarSlot, parseAvailabilityDays, parseAvailabilityTimes } from './capacity-helpers.mjs';
import { normaliseInstrument } from './fc-helpers.mjs';
import { getMmsBearerToken } from '../mms-token.js';
import {
  buildAttendanceSearchEndDate,
  buildPracticeNoteAttendancePayload,
  buildPracticeNoteEmailRecipients,
  describePracticeNoteAttendanceSelection,
  formatPracticeNoteHtml,
  listPracticeNoteAttendanceCandidates,
  selectPracticeNoteAttendanceTarget,
} from './practice-notes-mms-helpers.mjs';
import {
  assertPracticeNotesEmailConfigured,
  sendPracticeNoteEmail,
} from './practice-notes-email.js';

const MMS_BASE_URL = process.env.MMS_BASE_URL || 'https://api.mymusicstaff.com/v1';
const FREE_CALENDAR_SLOT_CACHE_TTL_MS = 10 * 60 * 1000;
const freeCalendarSlotCache = new Map();

function getMmsHeaders() {
  const token = getMmsBearerToken();

  if (!token) {
    throw new Error('MMS_BEARER_TOKEN is not configured');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    'x-schoolbox-version': 'main',
  };
}

function daysSince(date) {
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function parseMmsDate(dateString) {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseWaitingInstruments(note = '') {
  const parsed = parseNoteFields(note);
  const rawInstrument = parsed.instrument || '';
  if (!rawInstrument) return { rawInstrument: '', instruments: [], parsed };

  const instruments = rawInstrument
    .split(/,|&|\band\b/iu)
    .map((entry) => normaliseInstrument(entry).trim())
    .filter(Boolean);

  return {
    rawInstrument,
    instruments: [...new Set(instruments)],
    parsed,
  };
}

function normaliseWaitingStudent(student) {
  const family = student.Family || {};
  const parent = (family.Parents || [])[0] || {};
  const parentEmail = parent.Email || {};
  const parentTelephone =
    parent.MobileTelephone?.TelephoneNumber ||
    parent.HomeTelephone?.TelephoneNumber ||
    parent.WorkTelephone?.TelephoneNumber ||
    '';
  const studentTelephone = student.Telephone?.TelephoneNumber || '';
  const dateStarted = parseMmsDate(student.DateStarted);
  const ageInDays = dateStarted ? daysSince(dateStarted) : null;
  const instrumentContext = parseWaitingInstruments(student.Note || '');

  return {
    mmsId: student.ID || '',
    firstName: student.FirstName || '',
    lastName: student.LastName || '',
    fullName: `${student.FirstName || ''} ${student.LastName || ''}`.trim(),
    parentFirstName: parent.FirstName || '',
    parentLastName: parent.LastName || '',
    parentName: parent.FormalName || `${parent.FirstName || ''} ${parent.LastName || ''}`.trim(),
    parentEmail: parentEmail.EmailAddress || '',
    parentTelephone,
    studentTelephone,
    contactNumber: studentTelephone || parentTelephone,
    dateStarted: dateStarted ? dateStarted.toISOString() : '',
    ageInDays,
    note: student.Note || '',
    parsedNote: instrumentContext.parsed || {},
    instrumentRaw: instrumentContext.rawInstrument,
    instruments: instrumentContext.instruments,
    availabilityDays: parseAvailabilityDays(instrumentContext.parsed?.preferredDays || ''),
    availabilityTimes: parseAvailabilityTimes(instrumentContext.parsed?.preferredTimes || ''),
  };
}

export async function getWaitingStudents({ maxAgeDays = 120 } = {}) {
  const response = await fetch(`${MMS_BASE_URL}/search/students?offset=0&limit=100&fields=Family,StudentGroups,SubjectTypes&orderby=-DateStarted`, {
    method: 'POST',
    headers: getMmsHeaders(),
    body: JSON.stringify({
      IDs: [],
      SearchText: '',
      FirstName: null,
      LastName: null,
      EmailAddress: null,
      Statuses: ['Waiting'],
      StudentGroupIDs: [],
      TeacherIDs: [],
      FamilyIDs: [],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`MMS waiting list request failed: ${response.status}`);
  }

  const payload = await response.json();
  const cutoff = maxAgeDays ? Date.now() - maxAgeDays * 24 * 60 * 60 * 1000 : null;

  return (payload.ItemSubset || [])
    .map(normaliseWaitingStudent)
    .filter((student) => {
      if (!cutoff || !student.dateStarted) return true;
      return new Date(student.dateStarted).getTime() >= cutoff;
    });
}

export async function checkMmsHealth() {
  const response = await fetch(`${MMS_BASE_URL}/search/students?offset=0&limit=1`, {
    method: 'POST',
    headers: getMmsHeaders(),
    body: JSON.stringify({
      IDs: [],
      SearchText: '',
      FirstName: null,
      LastName: null,
      EmailAddress: null,
      Statuses: [],
      StudentGroupIDs: [],
      TeacherIDs: [],
      FamilyIDs: [],
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`MMS health request failed: ${response.status}`);
  }

  return {
    status: 'Healthy',
    detail: 'MMS API credentials are responding.',
    checkedAt: new Date().toISOString(),
  };
}

export async function getStudentDetails(mmsId) {
  const response = await fetch(`${MMS_BASE_URL}/students/${mmsId}?fields=Family`, {
    headers: getMmsHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`MMS student details request failed: ${response.status}`);
  }

  const data = await response.json();
  const family = data.Family || {};
  const parent = (family.Parents || [])[0] || {};
  const parentEmail = parent.Email || {};
  const note = data.Note || '';
  const parsed = parseNoteFields(note);
  const parentTelephone =
    parent.MobileTelephone?.TelephoneNumber ||
    parent.HomeTelephone?.TelephoneNumber ||
    parent.WorkTelephone?.TelephoneNumber ||
    '';

  return {
    mmsId: data.ID || '',
    status: data.Status || '',
    firstName: data.FirstName || '',
    lastName: data.LastName || '',
    fullName: `${data.FirstName || ''} ${data.LastName || ''}`.trim(),
    studentEmail: data.Email?.EmailAddress || '',
    studentTelephone: data.Telephone?.TelephoneNumber || '',
    parentFirstName: parent.FirstName || '',
    parentLastName: parent.LastName || '',
    parentName: parent.FormalName || `${parent.FirstName || ''} ${parent.LastName || ''}`.trim(),
    parentEmail: parentEmail.EmailAddress || '',
    parentTelephone,
    dateStarted: data.DateStarted || '',
    note,
    parsed,
  };
}

async function getStudentRecord(mmsId) {
  const response = await fetch(`${MMS_BASE_URL}/students/${mmsId}?fields=Family,StudentGroups,AccessStatus,BillingProfiles,BlockedRecipientType,NextEventDate`, {
    headers: getMmsHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`MMS student record request failed: ${response.status}`);
  }

  return response.json();
}

async function parseMmsResponse(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function searchCalendarEvents({ studentId, teacherId, lessonDate }) {
  const studentIds = Array.isArray(studentId) ? studentId.filter(Boolean) : studentId ? [studentId] : [];
  const response = await fetch(`${MMS_BASE_URL}/search/calendar/events`, {
    method: 'POST',
    headers: getMmsHeaders(),
    body: JSON.stringify(
      buildCalendarEventSearchPayload({
        studentIds,
        teacherId,
        lessonDate,
      }),
    ),
    cache: 'no-store',
  });

  const responseBody = await parseMmsResponse(response);

  if (!response.ok) {
    const details = formatMmsErrorBody(responseBody);
    throw new Error(`MMS calendar event search failed: ${response.status}${details ? ` - ${details}` : ''}`);
  }

  return responseBody?.ItemSubset || [];
}

async function searchCalendarEventsInRange({ studentId, teacherId = '', startDate, endDate, limit = 100 }) {
  const studentIds = Array.isArray(studentId) ? studentId.filter(Boolean) : studentId ? [studentId] : [];
  const response = await fetch(`${MMS_BASE_URL}/search/calendar/events?offset=0&limit=${limit}`, {
    method: 'POST',
    headers: getMmsHeaders(),
    body: JSON.stringify({
      ...buildCalendarEventSearchPayload({
        studentIds,
        teacherId,
        lessonDate: startDate,
      }),
      EndDate: endDate,
    }),
    cache: 'no-store',
  });

  const responseBody = await parseMmsResponse(response);

  if (!response.ok) {
    const details = formatMmsErrorBody(responseBody);
    throw new Error(`MMS calendar event search failed: ${response.status}${details ? ` - ${details}` : ''}`);
  }

  return responseBody?.ItemSubset || [];
}

async function searchStudentAttendance({ studentId, endDate = formatDate(new Date()), limit = 25 } = {}) {
  const response = await fetch(`${MMS_BASE_URL}/search/attendance?offset=0&limit=${limit}&fields=Charge,Payment&orderby=-EventStartDate`, {
    method: 'POST',
    headers: getMmsHeaders(),
    body: JSON.stringify({
      StartDate: null,
      EndDate: endDate,
      EventIDs: [],
      EventSeriesIDs: null,
      EventCategoryIDs: [],
      OriginalTeacherIDs: [],
      StudentIDs: [studentId],
      TeacherIDs: [],
      HasVisibleLessonNotes: null,
      Statuses: [],
      IDs: [],
      StartTime: null,
      EndTime: null,
      HasAttachments: null,
    }),
    cache: 'no-store',
  });

  const responseBody = await parseMmsResponse(response);

  if (!response.ok) {
    const details = formatMmsErrorBody(responseBody);
    throw new Error(`MMS attendance search failed: ${response.status}${details ? ` - ${details}` : ''}`);
  }

  return responseBody?.ItemSubset || [];
}

function formatDate(value) {
  return value.toISOString().slice(0, 10);
}

function addDaysToInputDate(date, days) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  parsed.setDate(parsed.getDate() + days);
  return formatDate(parsed);
}

export async function getMmsStudentScheduleContext({ mmsId, lookaheadDays = 60 } = {}) {
  if (!mmsId) {
    throw new Error('MMS ID is required for schedule refresh');
  }

  const checkedAt = new Date().toISOString();
  const start = new Date();
  const end = new Date(start.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
  const [student, events] = await Promise.all([
    getStudentRecord(mmsId),
    searchCalendarEventsInRange({
      studentId: mmsId,
      startDate: formatDate(start),
      endDate: formatDate(end),
    }),
  ]);

  return deriveScheduleContextFromMms({
    student,
    events,
    checkedAt,
    lookaheadDays,
  });
}

async function fetchMmsFreeCalendarSlots({ lookaheadDays = 30, limit = 500 } = {}) {
  const start = new Date();
  const end = new Date(start.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
  const events = await searchCalendarEventsInRange({
    startDate: formatDate(start),
    endDate: formatDate(end),
    limit,
  });

  return events
    .filter(isFreeCalendarEvent)
    .map(normaliseFreeCalendarSlot)
    .filter((slot) => slot.studentCount === 0)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function buildFreeCalendarSlotCacheKey({ lookaheadDays, limit }) {
  return `${lookaheadDays}:${limit}`;
}

export async function getMmsFreeCalendarSlotContext({
  lookaheadDays = 30,
  limit = 500,
  forceRefresh = false,
  ttlMs = FREE_CALENDAR_SLOT_CACHE_TTL_MS,
} = {}) {
  const cacheKey = buildFreeCalendarSlotCacheKey({ lookaheadDays, limit });
  const now = Date.now();
  const cached = freeCalendarSlotCache.get(cacheKey);

  if (!forceRefresh && cached && cached.expiresAtMs > now) {
    return {
      ...cached.value,
      fromCache: true,
      expiresAt: new Date(cached.expiresAtMs).toISOString(),
    };
  }

  const slots = await fetchMmsFreeCalendarSlots({ lookaheadDays, limit });
  const fetchedAt = new Date().toISOString();
  const expiresAtMs = now + ttlMs;
  const context = {
    slots,
    fetchedAt,
    expiresAt: new Date(expiresAtMs).toISOString(),
    fromCache: false,
    lookaheadDays,
    limit,
    source: 'mms_calendar_free',
  };

  freeCalendarSlotCache.set(cacheKey, {
    value: context,
    expiresAtMs,
  });

  return context;
}

export async function getMmsFreeCalendarSlots(options = {}) {
  const context = await getMmsFreeCalendarSlotContext(options);
  return context.slots;
}

export async function getMmsTutorCalendarEventsForDate({ teacherId, date, limit = 100 } = {}) {
  if (!teacherId) {
    throw new Error('MMS teacher ID is required');
  }
  if (!date) {
    throw new Error('Absence date is required');
  }

  const events = await searchCalendarEventsInRange({
    startDate: date,
    // MMS treats same-day StartDate/EndDate searches as empty for calendar events.
    endDate: addDaysToInputDate(date, 1),
    limit,
  });

  return events.filter((event) => event.TeacherID === teacherId || event.OriginalTeacherID === teacherId);
}

export async function getStudentOperationalState({
  studentId,
  teacherId = '',
  lessonDate = '',
  lessonTime = '',
} = {}) {
  const student = await getStudentRecord(studentId);
  const billingProfiles = teacherId ? await searchBillingProfiles({ studentId }) : [];
  const matchingBillingProfile = teacherId
    ? billingProfiles.find((profile) => profile.TeacherID === teacherId && profile.Active !== false) || null
    : null;

  let existingLesson = null;
  if (teacherId && lessonDate && lessonTime) {
    const existingEvents = await searchCalendarEvents({
      studentId,
      teacherId,
      lessonDate,
    });
    existingLesson = findMatchingCalendarEvent({
      events: existingEvents,
      studentId,
      teacherId,
      lessonDate,
      lessonTime,
    });
  }

  return {
    studentStatus: student.Status || '',
    isActive: student.Status === 'Active',
    billingProfile: matchingBillingProfile,
    existingLesson,
  };
}

export async function previewPracticeNoteMmsTestWrite({
  studentId,
  noteText,
  now = new Date(),
  targetAttendanceId = '',
} = {}) {
  if (!studentId) {
    throw new Error('studentId is required');
  }
  const noteHtml = formatPracticeNoteHtml(noteText);
  if (!noteHtml) {
    throw new Error('noteText is required');
  }

  const [student, attendanceRows] = await Promise.all([
    getStudentRecord(studentId),
    searchStudentAttendance({
      studentId,
      endDate: buildAttendanceSearchEndDate(now),
      limit: 25,
    }),
  ]);
  const candidateAttendances = listPracticeNoteAttendanceCandidates(attendanceRows, now);
  const targetAttendance = selectPracticeNoteAttendanceTarget(attendanceRows, now, { targetAttendanceId });
  if (!targetAttendance) {
    throw new Error(targetAttendanceId
      ? 'Requested MMS attendance record was not found for Test Studenty.'
      : 'No matching MMS attendance record found for Test Studenty.');
  }

  const recipients = buildPracticeNoteEmailRecipients(student);
  if (!recipients.length) {
    throw new Error('No email-capable MMS recipients found for Test Studenty.');
  }

  return {
    dryRun: true,
    student: {
      studentId: student.ID || studentId,
      name: student.FullName || `${student.FirstName || ''} ${student.LastName || ''}`.trim(),
      status: student.Status || '',
    },
    targetAttendance,
    targetSelection: describePracticeNoteAttendanceSelection({
      target: targetAttendance,
      candidates: candidateAttendances,
      targetAttendanceId,
    }),
    candidateAttendances,
    candidateCount: attendanceRows.length,
    recipients,
    attendancePayload: buildPracticeNoteAttendancePayload({
      attendance: targetAttendance,
      noteHtml,
    }),
  };
}

export async function executePracticeNoteMmsTestWrite({
  studentId,
  noteText,
  now = new Date(),
  targetAttendanceId = '',
} = {}) {
  const preview = await previewPracticeNoteMmsTestWrite({ studentId, noteText, now, targetAttendanceId });
  const emailConfig = assertPracticeNotesEmailConfigured();
  const { targetAttendance, attendancePayload } = preview;

  const attendanceResponse = await fetch(`${MMS_BASE_URL}/events/${targetAttendance.eventId}/attendance/${targetAttendance.attendanceId}`, {
    method: 'PUT',
    headers: getMmsHeaders(),
    body: JSON.stringify(attendancePayload),
    cache: 'no-store',
  });
  const attendanceResponseBody = await parseMmsResponse(attendanceResponse);
  if (!attendanceResponse.ok) {
    const details = formatMmsErrorBody(attendanceResponseBody);
    throw new Error(`MMS attendance note save failed: ${attendanceResponse.status}${details ? ` - ${details}` : ''}`);
  }

  let practiceNoteEmail;
  try {
    practiceNoteEmail = await sendPracticeNoteEmail({
      recipient: preview.recipients[0],
      studentName: preview.student.name,
      tutorName: targetAttendance.teacherName || '',
      noteText,
      config: emailConfig,
    });
  } catch (error) {
    practiceNoteEmail = {
      ok: false,
      channel: 'gmail',
      toEmail: preview.recipients[0]?.email || '',
      fromEmail: emailConfig.fromEmail,
      error: error.message || 'Practice note email failed.',
    };
  }

  return {
    ...preview,
    dryRun: false,
    attendanceSave: {
      ok: true,
      status: attendanceResponse.status,
      response: attendanceResponseBody,
    },
    practiceNoteEmail,
    emailNotes: practiceNoteEmail,
    partialSuccess: practiceNoteEmail.ok === false,
  };
}

export async function activateStudent({ studentId }) {
  const student = await getStudentRecord(studentId);

  if (student.Status === 'Active') {
    return {
      ...student,
      skipped: true,
      alreadyActive: true,
    };
  }

  const payload = {
    AdultStudentParentID: student.AdultStudentParentID || null,
    DateOfBirth: student.DateOfBirth || null,
    DateStarted: student.DateStarted || null,
    EmailAddress: student.Email?.EmailAddress || '',
    FaceTimeID: student.FaceTimeID || null,
    FirstName: student.FirstName || '',
    Gender: student.Gender || null,
    LastName: student.LastName || '',
    LocalSchool: student.LocalSchool || null,
    Note: student.Note || '',
    Referrer: student.Referrer || '',
    SendEmailReminders: student.SendEmailReminders ?? true,
    SendSMSReminders: student.SendSMSReminders ?? false,
    SkillLevel: student.SkillLevel || null,
    SkypeUsername: student.SkypeUsername || null,
    Status: 'Active',
    SubjectTypes: student.SubjectTypes || null,
    Telephone: {
      TelephoneNumber: student.Telephone?.TelephoneNumber || '',
      TextingAllowed: Boolean(student.Telephone?.TextingAllowed),
    },
  };

  const response = await fetch(`${MMS_BASE_URL}/students/${studentId}`, {
    method: 'PUT',
    headers: getMmsHeaders(),
    body: JSON.stringify(payload),
  });

  const responseBody = await parseMmsResponse(response);

  if (!response.ok) {
    const details = formatMmsErrorBody(responseBody);
    throw new Error(`MMS activate student failed: ${response.status}${details ? ` - ${details}` : ''}`);
  }

  return responseBody;
}

export async function markStudentInactive({ studentId }) {
  const student = await getStudentRecord(studentId);

  if (student.Status === 'Inactive') {
    return {
      ...student,
      skipped: true,
      alreadyInactive: true,
    };
  }

  const payload = {
    AdultStudentParentID: student.AdultStudentParentID || null,
    DateOfBirth: student.DateOfBirth || null,
    DateStarted: student.DateStarted || null,
    EmailAddress: student.Email?.EmailAddress || '',
    FaceTimeID: student.FaceTimeID || null,
    FirstName: student.FirstName || '',
    Gender: student.Gender || null,
    LastName: student.LastName || '',
    LocalSchool: student.LocalSchool || null,
    Note: student.Note || '',
    Referrer: student.Referrer || '',
    SendEmailReminders: student.SendEmailReminders ?? true,
    SendSMSReminders: student.SendSMSReminders ?? false,
    SkillLevel: student.SkillLevel || null,
    SkypeUsername: student.SkypeUsername || null,
    Status: 'Inactive',
    SubjectTypes: student.SubjectTypes || null,
    Telephone: {
      TelephoneNumber: student.Telephone?.TelephoneNumber || '',
      TextingAllowed: Boolean(student.Telephone?.TextingAllowed),
    },
  };

  const response = await fetch(`${MMS_BASE_URL}/students/${studentId}`, {
    method: 'PUT',
    headers: getMmsHeaders(),
    body: JSON.stringify(payload),
  });

  const responseBody = await parseMmsResponse(response);

  if (!response.ok) {
    const details = formatMmsErrorBody(responseBody);
    throw new Error(`MMS mark student inactive failed: ${response.status}${details ? ` - ${details}` : ''}`);
  }

  return responseBody;
}

async function searchBillingProfiles({ studentId }) {
  const response = await fetch(`${MMS_BASE_URL}//search/billingprofiles?fields=ScheduledMakeupMinutes`, {
    method: 'POST',
    headers: getMmsHeaders(),
    body: JSON.stringify({
      Active: true,
      SearchText: null,
      StudentIDs: [studentId],
      TeacherIDs: [],
    }),
    cache: 'no-store',
  });

  const responseBody = await parseMmsResponse(response);

  if (!response.ok) {
    const details = formatMmsErrorBody(responseBody);
    throw new Error(`MMS billing profile search failed: ${response.status}${details ? ` - ${details}` : ''}`);
  }

  return responseBody?.ItemSubset || [];
}

export async function ensureBillingProfile({
  studentId,
  teacherId,
  lessonDuration = 30,
  billingRate = Number(process.env.MMS_DEFAULT_BILLING_RATE || 30),
  eventCategoryId = process.env.MMS_BILLING_EVENT_CATEGORY_ID || 'ect_5cxpJ9',
}) {
  const existing = await searchBillingProfiles({ studentId });
  const match = existing.find((profile) => profile.TeacherID === teacherId && profile.Active !== false);

  if (match) {
    return {
      ...match,
      alreadyExists: true,
    };
  }

  const payload = buildBillingProfilePayload({
    studentId,
    teacherId,
    lessonDuration,
    billingRate,
    eventCategoryId,
  });

  const response = await fetch(`${MMS_BASE_URL}/billingprofiles`, {
    method: 'POST',
    headers: getMmsHeaders(),
    body: JSON.stringify(payload),
  });

  const responseBody = await parseMmsResponse(response);

  if (!response.ok) {
    const details = formatMmsErrorBody(responseBody);
    throw new Error(`MMS billing profile create failed: ${response.status}${details ? ` - ${details}` : ''}`);
  }

  return responseBody;
}

export async function createFirstLesson({
  studentId,
  studentIds = [],
  teacherId,
  lessonDate,
  lessonTime,
  durationMinutes = 30,
  eventCategoryId = process.env.MMS_FIRST_LESSON_EVENT_CATEGORY_ID || '',
  billingProfile = null,
  isRecurring = true,
}) {
  const resolvedStudentIds = studentIds.length ? studentIds : studentId ? [studentId] : [];
  const existingEvents = await searchCalendarEvents({
    studentId: resolvedStudentIds,
    teacherId,
    lessonDate,
  });
  const existingMatch = findMatchingCalendarEvent({
    events: existingEvents,
    studentIds: resolvedStudentIds,
    teacherId,
    lessonDate,
    lessonTime,
  });

  if (existingMatch) {
    return {
      ...existingMatch,
      duplicateSkipped: true,
    };
  }

  const payload = buildCalendarEventPayload({
    studentIds: resolvedStudentIds,
    teacherId,
    lessonDate,
    lessonTime,
    durationMinutes,
    eventCategoryId,
    billingProfile,
    isRecurring,
  });

  const response = await fetch(`${MMS_BASE_URL}/calendar/event`, {
    method: 'POST',
    headers: getMmsHeaders(),
    body: JSON.stringify(payload),
  });

  const responseBody = await parseMmsResponse(response);

  if (!response.ok) {
    const details = formatMmsErrorBody(responseBody);
    throw new Error(`MMS create lesson failed: ${response.status}${details ? ` - ${details}` : ''}`);
  }

  return responseBody;
}
