import { ADMIN_TUTORS } from './admin/tutors-data.js';

function stripDiacritics(value = '') {
  return `${value}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normaliseTutorLookupKey(value = '') {
  return stripDiacritics(value).trim().toLowerCase();
}

export function getTutorDashboardOptions(tutors = ADMIN_TUTORS) {
  return Object.entries(tutors).map(([shortName, tutor]) => ({
    shortName,
    fullName: tutor.fullName || shortName,
    teacherId: tutor.teacherId || '',
    instruments: tutor.instruments || [],
  }));
}

export function getTutorDashboardOptionNames(tutors = ADMIN_TUTORS) {
  return getTutorDashboardOptions(tutors).map((tutor) => tutor.shortName);
}

export function buildTutorTeacherIdMap(tutors = ADMIN_TUTORS) {
  const map = {};

  for (const tutor of getTutorDashboardOptions(tutors)) {
    if (!tutor.teacherId) {
      continue;
    }

    const aliases = new Set([
      tutor.shortName,
      tutor.fullName,
      tutor.shortName.toLowerCase(),
      tutor.fullName.toLowerCase(),
      normaliseTutorLookupKey(tutor.shortName),
      normaliseTutorLookupKey(tutor.fullName),
    ]);

    for (const alias of aliases) {
      if (alias) {
        map[alias] = tutor.teacherId;
      }
    }
  }

  return map;
}

export function resolveTutorTeacherId(tutorName = '', tutors = ADMIN_TUTORS) {
  const map = buildTutorTeacherIdMap(tutors);
  return map[tutorName] || map[normaliseTutorLookupKey(tutorName)] || '';
}

// Ukulele Orchestra members are managed as a group, not as individual
// dashboard students, so keep them out of the tutor's student list.
export function excludeGroupOnlyStudents(students = []) {
  return (students || []).filter((student) => (
    `${student.instrument || ''}`.trim().toLowerCase() !== 'ukulele orchestra'
  ));
}

export function filterTutorStudentsBySearch(students = [], searchTerm = '') {
  const needle = `${searchTerm}`.trim().toLowerCase();
  if (!needle) {
    return students || [];
  }

  return (students || []).filter((student) => {
    const searchable = [
      student.name,
      student.first_name,
      student.last_name,
      student.FirstName,
      student.LastName,
      student.FullName,
      student.instrument,
    ].filter(Boolean).join(' ').toLowerCase();

    return searchable.includes(needle);
  });
}

// When the Lesson Focus box already shows the latest goals above the note, the
// note body's own "**Practice Goals:**" section is pure duplication. Remove it
// only when its content matches the focus text — a non-matching section (e.g.
// an MMS-fallback note) is never hidden.
export function stripDuplicatePracticeGoals(noteText = '', focusText = '') {
  const text = `${noteText || ''}`;
  const focus = `${focusText || ''}`.trim();
  if (!text || !focus) return text;

  const heading = /\*\*Practice Goals:?\*\*/i.exec(text);
  if (!heading) return text;

  const bodyStart = heading.index + heading[0].length;
  const nextHeading = text.slice(bodyStart).search(/\*\*[^*]+\*\*/);
  const bodyEnd = nextHeading === -1 ? text.length : bodyStart + nextHeading;

  const normalise = (value) => `${value}`.replace(/\s+/g, ' ').trim();
  if (normalise(text.slice(bodyStart, bodyEnd)) !== normalise(focus)) return text;

  return `${text.slice(0, heading.index)}${text.slice(bodyEnd)}`.trim();
}
