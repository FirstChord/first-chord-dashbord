// Server-side helper: the songs a student sees on their portal.
// Fail-safe by design — any error returns [] so the portal never breaks on
// a Sheets hiccup; assignments are enrichment, not core portal content.
import { getSongAssignmentRows } from '../admin/sheets/song-assignments.mjs';
import { SONGS_CATALOGUE } from '../config/songs-catalogue.mjs';
import { soundsliceUrlFor } from './catalogue-helpers.mjs';

// Pure join: assignment rows + catalogue -> portal song list.
// Drops parked assignments and rows whose song left the catalogue.
export function joinAssignmentsToCatalogue(rows = [], catalogue = SONGS_CATALOGUE) {
  return rows
    .filter((row) => row.status !== 'parked')
    .map((row) => {
      const song = catalogue[row.songId];
      if (!song) return null;
      return {
        songId: row.songId,
        title: song.title,
        artist: song.artist,
        level: song.level,
        studentNote: song.studentNote || '',
        status: row.status || 'assigned',
        sortOrder: Number(row.sortOrder) || 0,
        soundsliceUrl: soundsliceUrlFor(song),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getAssignedSongsForStudent(mmsId) {
  if (!mmsId) return [];
  try {
    const rows = await getSongAssignmentRows(mmsId);
    return joinAssignmentsToCatalogue(rows);
  } catch (error) {
    console.warn('Assigned songs lookup failed; portal continues without them:', error.message);
    return [];
  }
}
