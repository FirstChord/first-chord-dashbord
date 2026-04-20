import {
  buildBillingProfilePayload,
  buildCalendarEventPayload,
  buildCalendarEventSearchPayload,
  findMatchingCalendarEvent,
  formatMmsErrorBody,
  parseNoteFields,
} from './mms-helpers.mjs';

const MMS_BASE_URL = process.env.MMS_BASE_URL || 'https://api.mymusicstaff.com/v1';

function getMmsHeaders() {
  const token = process.env.MMS_BEARER_TOKEN;

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

function normaliseWaitingStudent(student) {
  const family = student.Family || {};
  const parent = (family.Parents || [])[0] || {};
  const parentEmail = parent.Email || {};
  const dateStarted = parseMmsDate(student.DateStarted);
  const ageInDays = dateStarted ? daysSince(dateStarted) : null;

  return {
    mmsId: student.ID || '',
    firstName: student.FirstName || '',
    lastName: student.LastName || '',
    fullName: `${student.FirstName || ''} ${student.LastName || ''}`.trim(),
    parentFirstName: parent.FirstName || '',
    parentLastName: parent.LastName || '',
    parentName: parent.FormalName || `${parent.FirstName || ''} ${parent.LastName || ''}`.trim(),
    parentEmail: parentEmail.EmailAddress || '',
    dateStarted: dateStarted ? dateStarted.toISOString() : '',
    ageInDays,
  };
}

export async function getWaitingStudents({ maxAgeDays = 120 } = {}) {
  const response = await fetch(`${MMS_BASE_URL}/search/students?offset=0&limit=100&fields=Family&orderby=-DateStarted`, {
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
  const response = await fetch(`${MMS_BASE_URL}/students/${mmsId}?fields=Family,StudentGroups,AccessStatus,BillingProfiles,BlockedRecipientType`, {
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
  const response = await fetch(`${MMS_BASE_URL}/search/calendar/events`, {
    method: 'POST',
    headers: getMmsHeaders(),
    body: JSON.stringify(
      buildCalendarEventSearchPayload({
        studentId,
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

export async function activateStudent({ studentId }) {
  const student = await getStudentRecord(studentId);

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
    return match;
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
  teacherId,
  lessonDate,
  lessonTime,
  durationMinutes = 30,
  eventCategoryId = process.env.MMS_FIRST_LESSON_EVENT_CATEGORY_ID || '',
  billingProfile = null,
  isRecurring = true,
}) {
  const existingEvents = await searchCalendarEvents({
    studentId,
    teacherId,
    lessonDate,
  });
  const existingMatch = findMatchingCalendarEvent({
    events: existingEvents,
    studentId,
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
    studentId,
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
