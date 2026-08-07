// What the school knows about teaching a song, gathered per song.
//
// Four lanes already record this and, until now, nothing read any of them
// back: Song_Assignments (who put it in front of whom), Song_Outcomes (the
// tutor's "how did it go?"), and Practice_Notes_Log song links (it came up in
// a real lesson). Writing without reading is why a tutor got nothing for
// capturing well; this is the read.
//
// Two boundaries are structural, not stylistic:
//
//   1. No student leaves this function. Outcome notes are written about a real
//      child in a real lesson ("they struggled with the stretch"), so a tutor
//      looking at a song sees counts and colleagues' words, never who it was
//      about. Callers cannot opt out — the shape has nowhere to put a student.
//   2. Per song only. `docs/policies/data-protection.md` forbids turning
//      tutor-linked outcomes into performance ranking, so tutors are ordered by
//      experience *of this song* (who to ask) and never totalled across songs.

const OUTCOME_KEYS = ['cruised', 'about_right', 'battle'];

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function newestFirst(a = '', b = '') {
  return `${b}`.localeCompare(`${a}`);
}

function emptyEntry(songId) {
  return {
    songId,
    tutors: [],
    studentCount: 0,
    outcomes: [],
    outcomeCounts: { cruised: 0, about_right: 0, battle: 0 },
    noteMentions: 0,
    lastTaughtAt: '',
  };
}

/**
 * Builds a songId -> teaching-history map. Every input is optional so a
 * partial read (one tab erroring) degrades to a thinner history rather than
 * no history at all.
 *
 * @param {object[]} assignmentRows  every student's Song_Assignments rows
 * @param {object[]} outcomeRows     Song_Outcomes rows
 * @param {object[]} practiceNotes   Practice_Notes_Log rows (songIds + tutorName only)
 * @param {string[]} excludeMmsIds   students to leave out (test students)
 * @param {number}   maxOutcomes     most recent outcome notes kept per song
 */
export function buildSongTeachingHistory({
  assignmentRows = [],
  outcomeRows = [],
  practiceNotes = [],
  excludeMmsIds = [],
  maxOutcomes = 4,
  // Injected rather than imported so the tutor roster never reaches the client
  // bundle — this module's summariser runs in the browser. Without it, one
  // tutor recorded as "Calum" in assignments and "Calum Steel" in notes appears
  // twice on the same song.
  resolveTutorName = (name) => name,
} = {}) {
  const excluded = new Set(excludeMmsIds.map(clean).filter(Boolean));
  const tutorName = (value) => clean(resolveTutorName(clean(value)));
  const history = new Map();
  // Students are counted, never named, so this holds ids only long enough to
  // size the set and is dropped before the entry is returned.
  const studentsBySong = new Map(); // songId -> Set of mmsIds
  const tutorsBySong = new Map(); // songId -> Map(tutor -> Set of mmsIds)

  const entryFor = (songId) => {
    if (!history.has(songId)) {
      history.set(songId, emptyEntry(songId));
      studentsBySong.set(songId, new Set());
      tutorsBySong.set(songId, new Map());
    }
    return history.get(songId);
  };

  const recordTeaching = ({ songId, tutor, mmsId, at }) => {
    const entry = entryFor(songId);
    if (mmsId) studentsBySong.get(songId).add(mmsId);
    if (tutor) {
      // A tutor who taught a song without an identifiable student still counts
      // as having taught it, so the set may stay empty while the name stands.
      const byTutor = tutorsBySong.get(songId);
      if (!byTutor.has(tutor)) byTutor.set(tutor, new Set());
      if (mmsId) byTutor.get(tutor).add(mmsId);
    }
    if (at && at > entry.lastTaughtAt) entry.lastTaughtAt = at;
  };

  for (const row of assignmentRows) {
    const songId = clean(row?.songId);
    const mmsId = clean(row?.mmsId);
    if (!songId || excluded.has(mmsId)) continue;
    recordTeaching({
      songId,
      tutor: tutorName(row?.assignedBy),
      mmsId,
      at: clean(row?.updatedAt) || clean(row?.assignedAt),
    });
  }

  for (const row of outcomeRows) {
    const songId = clean(row?.songId);
    const mmsId = clean(row?.mmsId);
    if (!songId || excluded.has(mmsId)) continue;
    const tutor = tutorName(row?.recordedBy);
    recordTeaching({ songId, tutor, mmsId, at: clean(row?.recordedAt) });

    const entry = entryFor(songId);
    const outcome = clean(row?.outcome).toLowerCase();
    if (OUTCOME_KEYS.includes(outcome)) entry.outcomeCounts[outcome] += 1;

    const note = clean(row?.note);
    // An outcome chip with no note is a count, not something to read back.
    if (note) {
      entry.outcomes.push({
        outcome: OUTCOME_KEYS.includes(outcome) ? outcome : '',
        note,
        tutor,
        atStatus: clean(row?.atStatus),
        recordedAt: clean(row?.recordedAt),
      });
    }
  }

  for (const note of practiceNotes) {
    const songIds = Array.isArray(note?.songIds) ? note.songIds : [];
    const mmsId = clean(note?.studentMmsId);
    if (excluded.has(mmsId)) continue;
    const tutor = tutorName(note?.tutorName) || tutorName(note?.actingTutor);
    for (const rawSongId of songIds) {
      const songId = clean(rawSongId);
      if (!songId) continue;
      recordTeaching({ songId, tutor, mmsId, at: clean(note?.lessonDate) });
      entryFor(songId).noteMentions += 1;
    }
  }

  const result = {};
  for (const [songId, entry] of history) {
    const tutors = [...tutorsBySong.get(songId).entries()]
      .map(([name, students]) => ({ name, students: students.size }))
      // Most experience with THIS song first: the point is who to ask, and a
      // per-song order is never a cross-song tally of tutors.
      .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));

    result[songId] = {
      ...entry,
      tutors,
      studentCount: studentsBySong.get(songId).size,
      outcomes: entry.outcomes
        .sort((a, b) => newestFirst(a.recordedAt, b.recordedAt))
        .slice(0, maxOutcomes),
    };
  }

  return result;
}

/**
 * One line a tutor can read at a glance, or '' when the song has no history
 * worth interrupting the card for.
 */
export function summariseTeachingHistory(entry) {
  if (!entry) return '';
  const { tutors = [], studentCount = 0 } = entry;
  if (!tutors.length && !studentCount) return '';

  const names = tutors.map((tutor) => tutor.name).filter(Boolean);
  const who = names.length === 0
    ? ''
    : names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]}, ${names[1]} +${names.length - 2}`;

  const count = studentCount === 1 ? '1 student' : `${studentCount} students`;
  return who ? `${who} · ${count}` : count;
}
