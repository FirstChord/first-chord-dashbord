import { ADMIN_TUTORS } from './tutors-data.js';
import { getTutorLifecycleRows } from './sheets.js';

export { ADMIN_TUTORS } from './tutors-data.js';

export function getAllTutorOptions() {
  return Object.entries(ADMIN_TUTORS).map(([shortName, tutor]) => ({
    shortName,
    fullName: tutor.fullName,
    teacherId: tutor.teacherId,
    instruments: tutor.instruments,
  }));
}

export function normaliseTutorLifecycleStatus(value = '') {
  const status = `${value || ''}`.trim().toLowerCase();
  return ['active', 'leaving', 'retired'].includes(status) ? status : 'active';
}

// The generated tutor list is the durable identity layer. Lifecycle rows only
// overlay operational availability; missing rows deliberately mean active so
// existing tutors keep working before the first lifecycle record is written.
export async function getTutorOptionsWithLifecycle() {
  const [tutors, lifecycleRows] = await Promise.all([
    getAllTutorOptions(),
    getTutorLifecycleRows(),
  ]);
  const lifecycleByTeacherId = new Map(
    lifecycleRows.filter((row) => row.teacherId).map((row) => [row.teacherId, row]),
  );

  return tutors.map((tutor) => {
    const lifecycle = lifecycleByTeacherId.get(tutor.teacherId) || {};
    return {
      ...tutor,
      lifecycleStatus: normaliseTutorLifecycleStatus(lifecycle.status),
      finalTeachingDate: lifecycle.finalTeachingDate || '',
      retiredAt: lifecycle.retiredAt || '',
      replacementTutorShortName: lifecycle.replacementTutorShortName || '',
      lifecycleNote: lifecycle.note || '',
      lifecycleCreatedAt: lifecycle.createdAt || '',
      lifecycleUpdatedAt: lifecycle.updatedAt || '',
    };
  });
}

export async function getActiveTutorOptions() {
  const tutors = await getTutorOptionsWithLifecycle();
  return tutors.filter((tutor) => tutor.lifecycleStatus !== 'retired');
}

export function getTutorFullNameByShortName(shortName) {
  return ADMIN_TUTORS[shortName]?.fullName || '';
}

export function getTutorShortNameByFullName(fullName) {
  const needle = `${fullName || ''}`.trim().toLowerCase();
  if (!needle) {
    return '';
  }

  return Object.entries(ADMIN_TUTORS).find(([, tutor]) => tutor.fullName.trim().toLowerCase() === needle)?.[0] || '';
}

export function getTutorsForInstrument(instrument) {
  const needle = (instrument || '').toLowerCase().trim();
  if (!needle) {
    return getAllTutorOptions();
  }

  return getAllTutorOptions().filter((tutor) => tutor.instruments.includes(needle));
}

export async function getActiveTutorsForInstrument(instrument) {
  const needle = (instrument || '').toLowerCase().trim();
  const tutors = await getActiveTutorOptions();
  if (!needle) return tutors;
  return tutors.filter((tutor) => tutor.instruments.includes(needle));
}
