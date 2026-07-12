// Song catalogue helpers. The ONLY place Soundslice URLs are derived —
// nothing else may build or store a Soundslice URL from a song.
import {
  SONGS_CATALOGUE,
  SONG_INSTRUMENTS,
  SONG_LEVELS,
  SONG_CONTENT_TYPES,
} from '../config/songs-catalogue.mjs';

export function soundsliceUrlFor(song) {
  const scorehash = song?.soundslice?.scorehash;
  return scorehash ? `https://www.soundslice.com/slices/${scorehash}/` : null;
}

// Matches a student's instrument string ('Guitar', 'Piano / Guitar', ...) against
// a song's instruments. Combo strings match if any part matches.
export function songMatchesInstrument(song, studentInstrument) {
  if (!studentInstrument) return false;
  const parts = `${studentInstrument}`.toLowerCase().split('/').map((p) => p.trim());
  return (song.instruments || []).some((songInstrument) =>
    parts.includes(songInstrument.toLowerCase())
  );
}

// Catalogue songs for one student's instrument, sorted by level then title.
// Returns [] for unknown/unseeded instruments so the panel can hide entirely.
export function getSongsForInstrument(studentInstrument, catalogue = SONGS_CATALOGUE) {
  return Object.entries(catalogue)
    .filter(([, song]) => songMatchesInstrument(song, studentInstrument))
    .map(([songId, song]) => ({ songId, ...song, soundsliceUrl: soundsliceUrlFor(song) }))
    .sort(
      (a, b) =>
        SONG_LEVELS.indexOf(a.level) - SONG_LEVELS.indexOf(b.level) ||
        a.title.localeCompare(b.title)
    );
}

export function validateCatalogue(catalogue = SONGS_CATALOGUE) {
  const errors = [];
  const seenScorehashes = new Set();

  for (const [songId, song] of Object.entries(catalogue)) {
    const where = `${songId}`;
    if (!/^fc_song_[a-z0-9_]+$/.test(songId)) errors.push(`${where}: bad id format`);
    if (!song.title) errors.push(`${where}: missing title`);
    if (!song.artist) errors.push(`${where}: missing artist`);
    if (!SONG_LEVELS.includes(song.level)) errors.push(`${where}: unknown level "${song.level}"`);
    if (!SONG_CONTENT_TYPES.includes(song.contentType)) {
      errors.push(`${where}: unknown contentType "${song.contentType}"`);
    }
    if (!Array.isArray(song.instruments) || song.instruments.length === 0) {
      errors.push(`${where}: instruments must be a non-empty array`);
    } else {
      for (const instrument of song.instruments) {
        if (!SONG_INSTRUMENTS.includes(instrument)) {
          errors.push(`${where}: unknown instrument "${instrument}"`);
        }
      }
    }
    const scorehash = song.soundslice?.scorehash;
    if (!scorehash) {
      errors.push(`${where}: missing soundslice.scorehash`);
    } else if (seenScorehashes.has(scorehash)) {
      errors.push(`${where}: duplicate scorehash "${scorehash}"`);
    } else {
      seenScorehashes.add(scorehash);
    }
  }
  return errors;
}

// The catalogue ships in the client bundle, so student names must never appear.
export function findNameLeaks(firstNames, catalogue = SONGS_CATALOGUE) {
  const leaks = [];
  const names = firstNames.map((n) => `${n}`.toLowerCase()).filter((n) => n.length >= 3);
  for (const [songId, song] of Object.entries(catalogue)) {
    const text = `${song.title} ${song.tutorNote || ''} ${song.studentNote || ''}`.toLowerCase();
    for (const name of names) {
      if (new RegExp(`\\b${name}\\b`).test(text)) leaks.push(`${songId}: contains "${name}"`);
    }
  }
  return leaks;
}
