import { SONGS_CATALOGUE } from '../config/songs-catalogue.mjs';

// Context handed to the transcription model so it expects the words a lesson
// actually contains. Speech recognition guesses from a general-language prior:
// told nothing, it renders "Mixolydian" as "mic soul idiom" and mangles song
// titles it has no reason to expect. Told the student is on guitar and working
// on Sweet Home Chicago, it gets both right.
//
// This is the honest replacement for the old find-and-replace rules: bias the
// model up front with what we already know, rather than rewriting its output
// afterwards and hoping the pattern only matches what we meant.
//
// Only the student's OWN shelf goes in. A title the student has never been
// assigned is not evidence, and a prompt stuffed with the whole 300-song
// catalogue would bias toward songs they have never played.

// Statuses that mean "in front of the student right now". `done` and `parked`
// are deliberately excluded: last term's pieces are not what this lesson is about.
const LIVE_ASSIGNMENT_STATUSES = new Set(['assigned', 'working', 'ready']);

// A prompt is a hint, not a dictionary. whisper-1 only reads the final 224
// tokens, so an over-long prompt silently drops the songs at the front.
const MAX_SONGS = 12;

// Terms Whisper reliably mangles, and which no amount of post-hoc regex fixes
// safely. Kept short and instrument-agnostic on purpose.
const MUSIC_TERMS = [
  'barre chord', 'fretboard', 'plectrum', 'fingerpicking',
  'Dorian', 'Mixolydian', 'cadence', 'interval', 'arpeggio',
  'sixteenth notes', 'eighth notes', 'natural minor', 'chromatic',
];

function clean(value = '') {
  return `${value || ''}`.trim();
}

/**
 * The songs a student is actually working on, as catalogue titles.
 * Unknown song ids are skipped rather than guessed at.
 */
export function selectLiveSongTitles({
  assignments = [],
  catalogue = SONGS_CATALOGUE,
  maxSongs = MAX_SONGS,
} = {}) {
  const titles = [];
  const seen = new Set();

  for (const assignment of assignments) {
    if (!LIVE_ASSIGNMENT_STATUSES.has(clean(assignment?.status).toLowerCase())) continue;
    const song = catalogue[clean(assignment?.songId)];
    const title = clean(song?.title);
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    titles.push(title);
    if (titles.length >= maxSongs) break;
  }

  return titles;
}

/**
 * Stable song objects for note linking. Titles remain snapshots for humans;
 * songId is the durable join key used by learning views.
 */
export function selectLiveSongs({
  assignments = [],
  catalogue = SONGS_CATALOGUE,
  maxSongs = MAX_SONGS,
} = {}) {
  const songs = [];
  const seen = new Set();

  for (const assignment of assignments) {
    const status = clean(assignment?.status).toLowerCase();
    const songId = clean(assignment?.songId);
    if (!LIVE_ASSIGNMENT_STATUSES.has(status) || !songId || seen.has(songId)) continue;
    const title = clean(catalogue[songId]?.title);
    if (!title) continue;
    seen.add(songId);
    songs.push({ songId, title, status });
    if (songs.length >= maxSongs) break;
  }

  return songs;
}

export function resolveSelectedPracticeNoteSongs({
  songIds = [],
  assignments = [],
  catalogue = SONGS_CATALOGUE,
} = {}) {
  const requested = [...new Set((Array.isArray(songIds) ? songIds : `${songIds || ''}`.split(','))
    .map(clean)
    .filter(Boolean))];
  if (!requested.length) return { songIds: [], songTitles: [], errors: [] };
  if (requested.length > MAX_SONGS) {
    return {
      songIds: [],
      songTitles: [],
      errors: [`Select no more than ${MAX_SONGS} songs for one Practice Note`],
    };
  }

  const liveById = new Map(
    selectLiveSongs({ assignments, catalogue, maxSongs: MAX_SONGS })
      .map((song) => [song.songId, song]),
  );
  const unknown = requested.filter((songId) => !liveById.has(songId));
  if (unknown.length) {
    return {
      songIds: [],
      songTitles: [],
      errors: [`Selected songs are not on this student's current shelf: ${unknown.join(', ')}`],
    };
  }

  return {
    songIds: requested,
    songTitles: requested.map((songId) => liveById.get(songId).title),
    errors: [],
  };
}

/**
 * The instrument implied by the student's live shelf. Derived from the songs
 * rather than read from the registry so this stays a single cheap lookup —
 * and so it can never disagree with the songs it is sent alongside.
 */
export function inferInstrument({ assignments = [], catalogue = SONGS_CATALOGUE } = {}) {
  const counts = new Map();

  for (const assignment of assignments) {
    if (!LIVE_ASSIGNMENT_STATUSES.has(clean(assignment?.status).toLowerCase())) continue;
    const song = catalogue[clean(assignment?.songId)];
    for (const instrument of song?.instruments || []) {
      counts.set(instrument, (counts.get(instrument) || 0) + 1);
    }
  }

  let best = '';
  let bestCount = 0;
  for (const [instrument, count] of counts) {
    if (count > bestCount) {
      best = instrument;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Build the transcription prompt.
 *
 * Returns '' when there is nothing useful to say — an empty shelf should send
 * no prompt at all rather than a generic one, since a vague hint still shifts
 * the model's prior without adding information.
 */
export function buildTranscriptionPrompt({ instrument = '', songTitles = [] } = {}) {
  const parts = ['A music lesson note from a First Chord tutor.'];

  const cleanInstrument = clean(instrument);
  if (cleanInstrument) {
    parts.push(`The student plays ${cleanInstrument}.`);
  }

  const titles = songTitles.map(clean).filter(Boolean);
  if (titles.length) {
    parts.push(`Songs they are working on: ${titles.join('; ')}.`);
  }

  if (!cleanInstrument && !titles.length) {
    return '';
  }

  parts.push(`Musical terms that may come up: ${MUSIC_TERMS.join(', ')}.`);

  return parts.join(' ');
}

/**
 * Full music context for one student, from their assignment rows.
 */
export function buildPracticeChatMusicContext({
  assignments = [],
  catalogue = SONGS_CATALOGUE,
} = {}) {
  const songs = selectLiveSongs({ assignments, catalogue });
  const songTitles = [...new Set(songs.map((song) => song.title))];
  const instrument = inferInstrument({ assignments, catalogue });

  return {
    instrument,
    songs,
    songTitles,
    prompt: buildTranscriptionPrompt({ instrument, songTitles }),
  };
}
