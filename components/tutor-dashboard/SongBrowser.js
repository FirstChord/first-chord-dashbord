'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight, Music } from 'lucide-react';
import { getSongsForInstrument } from '@/lib/songs/catalogue-helpers.mjs';

// Read-only catalogue browser for the selected student's instrument.
// Renders nothing when the catalogue has no songs for that instrument.
export default function SongBrowser({ student }) {
  const [open, setOpen] = useState(false);
  const [levelFilter, setLevelFilter] = useState('All');
  const [expandedSongId, setExpandedSongId] = useState(null);

  const songs = useMemo(
    () => getSongsForInstrument(student?.instrument),
    [student?.instrument]
  );

  const levels = useMemo(
    () => ['All', ...new Set(songs.map((song) => song.level))],
    [songs]
  );

  if (songs.length === 0) return null;

  const visibleSongs =
    levelFilter === 'All' ? songs : songs.filter((song) => song.level === levelFilter);

  return (
    <div className="bg-white rounded-xl shadow-md border border-[#2F6B3D]/25 mt-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 sm:p-5 text-left"
      >
        <span className="flex items-center gap-3">
          <Music className="h-5 w-5 text-[#2F6B3D]" />
          <span className="text-lg font-bold text-gray-800">Songs</span>
          <span className="text-sm text-gray-500">
            {songs.length} for {student.instrument}
          </span>
        </span>
        {open ? (
          <ChevronDown className="h-5 w-5 text-[#2F6B3D]" />
        ) : (
          <ChevronRight className="h-5 w-5 text-[#2F6B3D]" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {levels.length > 2 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {levels.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLevelFilter(level)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    levelFilter === level
                      ? 'bg-[#2F6B3D] text-white'
                      : 'bg-green-50 text-[#2F6B3D] hover:bg-green-100'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          )}

          <ul className="divide-y divide-gray-100">
            {visibleSongs.map((song) => (
              <li key={song.songId} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSongId(expandedSongId === song.songId ? null : song.songId)
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="font-semibold text-gray-800">{song.title}</span>
                    <span className="text-gray-500"> — {song.artist}</span>
                    <span className="ml-2 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-[#2F6B3D]">
                      {song.level}
                    </span>
                  </button>
                  <a
                    href={song.soundsliceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2F6B3D] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#265732]"
                  >
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                {expandedSongId === song.songId && (
                  <div className="mt-2 text-sm text-gray-600">
                    {song.tutorNote && <p>{song.tutorNote}</p>}
                    {song.tags?.length > 0 && (
                      <p className="mt-1 text-xs text-gray-400">{song.tags.join(' · ')}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
