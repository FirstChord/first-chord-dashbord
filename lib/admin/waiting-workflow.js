import { getWaitingStudents } from './mms.js';
import { getWaitingListStateRows, upsertWaitingListStateRow } from './sheets.js';

export const WAITING_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'welcome_group_added', label: 'Welcome group added' },
  { value: 'welcome_call_booked', label: 'Welcome call booked' },
  { value: 'call_completed', label: 'Call completed' },
  { value: 'onboarding_ready', label: 'Onboarding ready' },
  { value: 'onboarded', label: 'Onboarded' },
  { value: 'no_response', label: 'No response' },
  { value: 'closed', label: 'Closed' },
];

const VALID_STATUSES = new Set(WAITING_STATUS_OPTIONS.map((option) => option.value));

export function normaliseWaitingStatus(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return VALID_STATUSES.has(normalised) ? normalised : 'new';
}

export function buildWelcomeGroupMessage(student) {
  const parentFirstName = `${student?.parentFirstName || ''}`.trim() || 'there';

  return `Hey ${parentFirstName}! It’s Tom from First Chord Music School who just called. Thanks much for your interest in taking lessons with us! We are excited to chat and sort you out with a first lesson! 😃

Let’s organise a call to talk about your musical interests and goals so we can match you with the perfect tutor.

Could you let us know which of these times works for you for a welcome call? 📱

Our Welcome Call Times:
Tuesdays: 12:00 1:30pm
Fridays: 12:00-1:30pm
Sundays: 10:00-11:00am

Just let us know which day and time slot works best, and either Finn or Tom will give you a call then! We’ll aim to get you started with lessons right away.

Feel free to pop down any questions you have, and one of us will be sure to get back to you!

As we’re now working through our waiting list, please do let us know as soon as possible when you’d like your welcome call so we can prioritise getting you sorted.

I’ll also include a link to our welcome handbook which has more details about our teaching approach, homework, cancellation policies and more. 📖
firstchord.co.uk/handbook

We look forward to chatting soon and get your musical journey started! 🎸🎹🥁

Cheers!
Finn & Tom
First Chord Music School`;
}

export function buildOnboardedWaitingNote({
  existingNote = '',
  studentName = '',
  tutorName = '',
  lessonDate = '',
  lessonTime = '',
  lessonWarning = '',
  now = new Date().toISOString(),
} = {}) {
  const parts = [
    `Auto-closed by onboarding on ${now.slice(0, 10)}`,
    studentName ? `student: ${studentName}` : '',
    tutorName ? `tutor: ${tutorName}` : '',
    lessonDate || lessonTime ? `lesson: ${[lessonDate, lessonTime].filter(Boolean).join(' ')}` : '',
    lessonWarning ? `MMS follow-up needed: ${lessonWarning}` : '',
  ].filter(Boolean);
  const autoCloseLine = parts.join('; ');
  const trimmedExisting = `${existingNote || ''}`.trim();

  if (!trimmedExisting) {
    return autoCloseLine;
  }

  if (trimmedExisting.includes(autoCloseLine)) {
    return trimmedExisting;
  }

  return `${trimmedExisting}\n${autoCloseLine}`;
}

export async function getWaitingWorkflowStudents() {
  const [students, stateRows] = await Promise.all([
    getWaitingStudents(),
    getWaitingListStateRows(),
  ]);

  const stateByMmsId = new Map(stateRows.map((row) => [row.mmsId, row]));

  return students.map((student) => {
    const state = stateByMmsId.get(student.mmsId);
    return {
      ...student,
      waitingStatus: normaliseWaitingStatus(state?.status),
      waitingNote: state?.note || '',
      waitingUpdatedAt: state?.updatedAt || '',
      welcomeGroupMessage: buildWelcomeGroupMessage(student),
    };
  });
}

export async function markWaitingWorkflowStudentsOnboarded({
  students = [],
  tutorName = '',
  lessonDate = '',
  lessonTime = '',
  lessonWarning = '',
  now = new Date().toISOString(),
}) {
  const stateRows = await getWaitingListStateRows();
  const stateByMmsId = new Map(stateRows.map((row) => [row.mmsId, row]));
  const results = [];

  for (const student of students) {
    const mmsId = `${student?.mmsId || ''}`.trim();
    if (!mmsId) {
      continue;
    }

    const existingState = stateByMmsId.get(mmsId);
    const note = buildOnboardedWaitingNote({
      existingNote: existingState?.note || '',
      studentName: student.studentName || student.fullName || '',
      tutorName,
      lessonDate,
      lessonTime,
      lessonWarning,
      now,
    });

    await upsertWaitingListStateRow({
      mmsId,
      status: 'onboarded',
      note,
      parentName: existingState?.parentName || student.parentName || '',
      parentEmail: existingState?.parentEmail || student.parentEmail || '',
      dateStarted: existingState?.dateStarted || student.dateStarted || '',
      updatedAt: now,
    });

    results.push({
      mmsId,
      status: 'onboarded',
      note,
      updatedAt: now,
    });
  }

  return results;
}

export async function updateWaitingWorkflowState({
  mmsId,
  status,
  note,
  parentName = '',
  parentEmail = '',
  dateStarted = '',
}) {
  const nextStatus = normaliseWaitingStatus(status);
  const nextNote = `${note || ''}`.trim();
  const updatedAt = new Date().toISOString();

  await upsertWaitingListStateRow({
    mmsId,
    status: nextStatus,
    note: nextNote,
    parentName,
    parentEmail,
    dateStarted,
    updatedAt,
  });

  return {
    mmsId,
    status: nextStatus,
    note: nextNote,
    updatedAt,
  };
}
