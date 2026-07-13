// Read-only admin signal (student paths slice 7): which students have an
// active song and which don't. Pure — callers supply the roster and rows.
// "Eligible" = the student's instrument has at least one catalogue song, so
// a drums student is never counted as missing something we can't offer yet.
import { SONGS_CATALOGUE } from '../config/songs-catalogue.mjs';
import { getSongsForInstrument } from './catalogue-helpers.mjs';

// A song still in front of the student. 'done' and 'parked' don't count.
const ACTIVE_STATUSES = new Set(['assigned', 'working', 'ready']);

export function buildPathsSignal({ students = [], assignmentRows = [], catalogue = SONGS_CATALOGUE } = {}) {
  // Registry parses in file order and duplicates are last-match-wins.
  const roster = new Map();
  for (const student of students) {
    if (student?.mmsId && student.isTestStudent !== 'true') {
      roster.set(student.mmsId, student);
    }
  }

  const eligible = [...roster.values()].filter(
    (student) => getSongsForInstrument(student.instrument, catalogue).length > 0
  );

  const activeStudentIds = new Set(
    assignmentRows
      .filter((row) => ACTIVE_STATUSES.has(row.status))
      .map((row) => row.mmsId)
  );

  const withoutActive = eligible.filter((student) => !activeStudentIds.has(student.mmsId));

  const byTutorCounts = new Map();
  for (const student of withoutActive) {
    const tutor = student.tutor || 'Unassigned';
    byTutorCounts.set(tutor, (byTutorCounts.get(tutor) || 0) + 1);
  }
  const noActiveByTutor = [...byTutorCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    eligibleCount: eligible.length,
    withActiveCount: eligible.length - withoutActive.length,
    noActiveCount: withoutActive.length,
    noActiveByTutor,
  };
}
