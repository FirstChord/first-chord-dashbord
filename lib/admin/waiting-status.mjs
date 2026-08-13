/**
 * @fileoverview Pure waiting-list status vocabulary, visibility, and recovery rules shared by server and client.
 */

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
const ACTIVE_WAITING_STATUSES = new Set([
  'new',
  'contacted',
  'welcome_group_added',
  'welcome_call_booked',
  'call_completed',
  'onboarding_ready',
]);
const RESTORABLE_WAITING_STATUSES = new Set(['no_response', 'closed']);

export function normaliseWaitingStatus(value = '') {
  const normalised = `${value || ''}`.trim().toLowerCase();
  return VALID_STATUSES.has(normalised) ? normalised : 'new';
}

export function isActiveWaitingStatus(value = '') {
  return ACTIVE_WAITING_STATUSES.has(normaliseWaitingStatus(value));
}

export function getWaitingStatusLabel(value = '') {
  const status = normaliseWaitingStatus(value);
  return WAITING_STATUS_OPTIONS.find((option) => option.value === status)?.label || 'New';
}

export function getWaitingRestoreStatus(value = '') {
  return RESTORABLE_WAITING_STATUSES.has(normaliseWaitingStatus(value)) ? 'contacted' : '';
}

export function partitionWaitingStudents(students = []) {
  const activeStudents = [];
  const inactiveStudents = [];

  for (const student of students) {
    if (isActiveWaitingStatus(student?.waitingStatus)) {
      activeStudents.push(student);
    } else {
      inactiveStudents.push(student);
    }
  }

  return { activeStudents, inactiveStudents };
}
