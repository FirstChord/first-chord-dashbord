import { ADMIN_TUTORS } from './tutors-data.js';

export { ADMIN_TUTORS } from './tutors-data.js';

export function getAllTutorOptions() {
  return Object.entries(ADMIN_TUTORS).map(([shortName, tutor]) => ({
    shortName,
    fullName: tutor.fullName,
    teacherId: tutor.teacherId,
    instruments: tutor.instruments,
  }));
}

export function getTutorFullNameByShortName(shortName) {
  return ADMIN_TUTORS[shortName]?.fullName || '';
}

export function getTutorsForInstrument(instrument) {
  const needle = (instrument || '').toLowerCase().trim();
  if (!needle) {
    return getAllTutorOptions();
  }

  return getAllTutorOptions().filter((tutor) => tutor.instruments.includes(needle));
}
