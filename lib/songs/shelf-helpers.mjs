// Pure logic behind the tutor Songs panel's student-centred default view:
// which level this student is at, which songs to offer next, and how far
// through their path they are. No fetching, no state — inputs in, view out.
import { SONG_LEVELS } from '../config/songs-catalogue.mjs';
import { PATH_TEMPLATES } from '../config/path-templates.mjs';

const ACTIVE_STATUSES = new Set(['assigned', 'working', 'ready']);

// The student's level = the highest level among their assigned songs
// (parked included — it still says what they've touched). Falls back to the
// lowest level that has songs for their instrument.
export function inferStudentLevel(assignments = [], songs = []) {
  const songLevels = new Map(songs.map((song) => [song.songId, song.level]));
  let highest = -1;
  for (const assignment of assignments) {
    const level = songLevels.get(assignment.songId);
    const index = SONG_LEVELS.indexOf(level);
    if (index > highest) highest = index;
  }
  if (highest >= 0) return SONG_LEVELS[highest];
  const available = songs
    .map((song) => SONG_LEVELS.indexOf(song.level))
    .filter((index) => index >= 0);
  return available.length ? SONG_LEVELS[Math.min(...available)] : null;
}

// Up to `limit` unassigned songs to offer next: the student's level first,
// topped up from the next level when their shelf is running dry.
export function buildShelf(assignments = [], songs = [], { limit = 5 } = {}) {
  const level = inferStudentLevel(assignments, songs);
  if (!level) return { level: null, candidates: [] };
  const assignedIds = new Set(assignments.map((a) => a.songId));
  const unassigned = songs.filter((song) => !assignedIds.has(song.songId));
  const levelIndex = SONG_LEVELS.indexOf(level);
  const candidates = [];
  for (let i = levelIndex; i < SONG_LEVELS.length && candidates.length < limit; i += 1) {
    for (const song of unassigned) {
      if (song.level === SONG_LEVELS[i] && candidates.length < limit) {
        candidates.push(song);
      }
    }
  }
  return { level, candidates };
}

// Progress through the student's path (the first path found among their
// assignments): ordered steps with status, plus the 1-based position of the
// step currently in front of them. Returns null when no path is assigned.
export function buildPathProgress(assignments = [], templates = PATH_TEMPLATES) {
  const withPath = assignments.filter((a) => a.pathId && templates[a.pathId]);
  if (withPath.length === 0) return null;
  const pathId = withPath[0].pathId;
  const template = templates[pathId];
  const bySongId = new Map(
    assignments.filter((a) => a.pathId === pathId).map((a) => [a.songId, a])
  );
  const steps = template.steps.map((songId) => ({
    songId,
    status: bySongId.get(songId)?.status || 'unassigned',
  }));
  const activeIndex = steps.findIndex((step) => ACTIVE_STATUSES.has(step.status));
  return {
    pathId,
    name: template.name,
    steps,
    position: activeIndex === -1 ? steps.length : activeIndex + 1,
  };
}
