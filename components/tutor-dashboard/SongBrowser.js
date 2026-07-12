'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, ChevronDown, ChevronRight, Music, Check, Plus } from 'lucide-react';
import { getSongsForInstrument } from '@/lib/songs/catalogue-helpers.mjs';

// Catalogue browser + assign for the selected student's instrument.
// Renders nothing when the catalogue has no songs for that instrument.
// Assign buttons appear only when the student carries an access token.
export default function SongBrowser({ student }) {
  const [open, setOpen] = useState(false);
  const [levelFilter, setLevelFilter] = useState('All');
  const [expandedSongId, setExpandedSongId] = useState(null);
  const [assignedSongIds, setAssignedSongIds] = useState(null); // null = not loaded
  const [pendingSongId, setPendingSongId] = useState(null);
  const [assignError, setAssignError] = useState(null);

  const studentId = student?.mms_id || student?.ID || '';
  const token = student?.noteAccessToken || student?.note_access_token || '';

  const songs = useMemo(
    () => getSongsForInstrument(student?.instrument),
    [student?.instrument]
  );

  const levels = useMemo(
    () => ['All', ...new Set(songs.map((song) => song.level))],
    [songs]
  );

  useEffect(() => {
    setAssignedSongIds(null);
    setPendingSongId(null);
    setAssignError(null);
  }, [studentId]);

  useEffect(() => {
    if (!open || assignedSongIds !== null || !studentId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/song-assignments?student=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!cancelled) {
          setAssignedSongIds(new Set((data.assignments || []).map((a) => a.songId)));
        }
      } catch {
        if (!cancelled) setAssignedSongIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, assignedSongIds, studentId, token]);

  if (songs.length === 0) return null;

  const assignSong = async (songId) => {
    setPendingSongId(songId);
    setAssignError(null);
    try {
      const res = await fetch('/api/song-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mmsId: studentId, songId, token }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignedSongIds((prev) => new Set([...(prev || []), songId]));
      } else {
        setAssignError(`Couldn't save that assignment (${data.code || res.status}). Try again, or check this domain can reach the sheet.`);
      }
    } catch {
      setAssignError("Couldn't save that assignment — network error. Try again.");
    }
    setPendingSongId(null);
  };

  const visibleSongs =
    levelFilter === 'All' ? songs : songs.filter((song) => song.level === levelFilter);
  const canAssign = Boolean(studentId && token);

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

          {assignError && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {assignError}
            </p>
          )}

          <ul className="divide-y divide-gray-100">
            {visibleSongs.map((song) => {
              const isAssigned = assignedSongIds?.has(song.songId);
              return (
                <li key={song.songId} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
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
                    <div className="flex shrink-0 items-center gap-1.5">
                      {canAssign && (
                        isAssigned ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1.5 text-sm font-medium text-[#2F6B3D]">
                            <Check className="h-3.5 w-3.5" /> Assigned
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={pendingSongId === song.songId || assignedSongIds === null}
                            onClick={() => assignSong(song.songId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#2F6B3D]/40 px-2.5 py-1.5 text-sm font-medium text-[#2F6B3D] transition-colors hover:bg-green-50 disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {pendingSongId === song.songId ? 'Assigning…' : 'Assign'}
                          </button>
                        )
                      )}
                      <a
                        href={song.soundsliceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2F6B3D] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#265732]"
                      >
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
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
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
