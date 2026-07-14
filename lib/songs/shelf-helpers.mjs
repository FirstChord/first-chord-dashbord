// Pure logic behind the tutor Songs panel's student-centred default view:
// which level this student is at, which songs to offer next, and how far
// through their path they are. No fetching, no state — inputs in, view out.
import { SONG_LEVELS } from '../config/songs-catalogue.mjs';
import { PATH_TEMPLATES } from '../config/path-templates.mjs';
import { seriesForSongs, seriesOf } from './catalogue-helpers.mjs';

const ACTIVE_STATUSES = new Set(['assigned', 'working', 'ready']);

// The student's level within one series = the highest level among the songs
// they've been assigned from it (parked included — it still says what they've
// touched). Falls back to that series' lowest level with songs.
// Levels are only comparable inside a series: Book 2 is not "above" Grade 6.
export function inferStudentLevel(assignments = [], songs = [], seriesId = null) {
  const inSeries = seriesId ? songs.filter((song) => seriesOf(song) === seriesId) : songs;
  const songLevels = new Map(inSeries.map((song) => [song.songId, song.level]));
  let highest = -1;
  for (const assignment of assignments) {
    const level = songLevels.get(assignment.songId);
    const index = SONG_LEVELS.indexOf(level);
    if (index > highest) highest = index;
  }
  if (highest >= 0) return SONG_LEVELS[highest];
  const available = inSeries
    .map((song) => SONG_LEVELS.indexOf(song.level))
    .filter((index) => index >= 0);
  return available.length ? SONG_LEVELS[Math.min(...available)] : null;
}

// Which series tab to open on: the one the student is actually working in
// (most assigned songs), else the first series that has songs for them.
export function inferStudentSeries(assignments = [], songs = []) {
  const available = seriesForSongs(songs);
  if (available.length === 0) return null;

  const songSeries = new Map(songs.map((song) => [song.songId, seriesOf(song)]));
  const counts = new Map();
  for (const assignment of assignments) {
    const series = songSeries.get(assignment.songId);
    if (series) counts.set(series, (counts.get(series) || 0) + 1);
  }

  let best = null;
  for (const series of available) {
    const count = counts.get(series.id) || 0;
    if (count > 0 && (best === null || count > counts.get(best))) best = series.id;
  }
  return best || available[0].id;
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
