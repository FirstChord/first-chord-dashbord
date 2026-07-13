'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Music,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { getSongsForInstrument, songMatchesInstrument } from '@/lib/songs/catalogue-helpers.mjs';
import { buildPathProgress, buildShelf } from '@/lib/songs/shelf-helpers.mjs';
import { PATH_TEMPLATES } from '@/lib/config/path-templates.mjs';
import { SONG_LEVELS } from '@/lib/config/songs-catalogue.mjs';

// Tapping the status chip walks this cycle; parking lives on its own control.
const STATUS_CYCLE = ['assigned', 'working', 'ready', 'done'];
const STATUS_STYLES = {
  assigned: 'bg-gray-100 text-gray-600',
  working: 'bg-amber-100 text-amber-800',
  ready: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  parked: 'bg-gray-100 text-gray-400',
};

// Student-centred song panel: opens on "pick the next song" (level-matched
// shelf), with the current song + path progress as a compact strip above and
// the full catalogue behind an explicit Browse toggle. Renders nothing when
// the catalogue has no songs for the student's instrument.
export default function SongBrowser({ student }) {
  const [open, setOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedSongId, setExpandedSongId] = useState(null);
  const [assignments, setAssignments] = useState(null); // null = not loaded
  const [pendingId, setPendingId] = useState(null);
  const [assignError, setAssignError] = useState(null);

  const studentId = student?.mms_id || student?.ID || '';
  const token = student?.noteAccessToken || student?.note_access_token || '';

  const songs = useMemo(
    () => getSongsForInstrument(student?.instrument),
    [student?.instrument]
  );

  useEffect(() => {
    setAssignments(null);
    setPendingId(null);
    setAssignError(null);
    setBrowseOpen(false);
    setManageOpen(false);
    setSearch('');
  }, [studentId]);

  useEffect(() => {
    if (!open || assignments !== null || !studentId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/song-assignments?student=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!cancelled) setAssignments(data.assignments || []);
      } catch {
        if (!cancelled) setAssignments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, assignments, studentId, token]);

  const canAssign = Boolean(studentId && token);
  const loaded = assignments !== null;

  const assignedSongIds = useMemo(
    () => new Set((assignments || []).map((a) => a.songId)),
    [assignments]
  );

  const orderedAssignments = useMemo(
    () =>
      [...(assignments || [])].sort(
        (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
      ),
    [assignments]
  );

  const activeAssignments = orderedAssignments.filter((a) => a.status !== 'parked');
  const nowAssignment =
    activeAssignments.find((a) => a.status === 'working') || activeAssignments[0] || null;
  const nowSong = nowAssignment ? songs.find((s) => s.songId === nowAssignment.songId) : null;
  const pathProgress = loaded ? buildPathProgress(assignments) : null;
  const shelf = useMemo(
    () => buildShelf(assignments || [], songs, { limit: 5 }),
    [assignments, songs]
  );

  const pathTemplates = Object.entries(PATH_TEMPLATES)
    .filter(([, template]) =>
      songMatchesInstrument({ instruments: [template.instrument] }, student?.instrument)
    )
    .map(([pathId, template]) => ({ pathId, ...template }))
    // A fully assigned path has nothing left to offer — hide it.
    .filter((template) => !template.steps.every((songId) => assignedSongIds.has(songId)));

  if (songs.length === 0) return null;

  const callApi = async (id, options) => {
    setPendingId(id);
    setAssignError(null);
    try {
      const res = await fetch('/api/song-assignments', {
        method: options.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mmsId: studentId, token, ...options.body }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.assignments) {
          setAssignments(data.assignments);
        } else if (data.assignment) {
          setAssignments((prev) => [
            ...(prev || []).filter((a) => a.songId !== data.assignment.songId),
            data.assignment,
          ]);
        }
      } else {
        setAssignError(`Couldn't save that (${data.code || res.status}). Try again.`);
      }
    } catch {
      setAssignError("Couldn't save that — network error. Try again.");
    }
    setPendingId(null);
  };

  const assignSong = (songId) => callApi(songId, { method: 'POST', body: { songId } });
  const assignPath = (pathId) => callApi(pathId, { method: 'POST', body: { pathId } });
  const setStatus = (songId, status) =>
    callApi(songId, { method: 'PATCH', body: { songId, status } });
  const move = (songId, direction) =>
    callApi(songId, { method: 'PATCH', body: { songId, direction } });
  const cycleStatus = (assignment) => {
    const index = STATUS_CYCLE.indexOf(assignment.status);
    const next = STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length] || 'assigned';
    setStatus(assignment.songId, next);
  };

  const searchTerm = search.trim().toLowerCase();
  const browseSongs = searchTerm
    ? songs.filter(
        (song) =>
          song.title.toLowerCase().includes(searchTerm) ||
          (song.artist || '').toLowerCase().includes(searchTerm)
      )
    : songs;
  const browseLevels = SONG_LEVELS.filter((level) =>
    browseSongs.some((song) => song.level === level)
  );

  const titleFor = (assignment) =>
    songs.find((s) => s.songId === assignment.songId)?.title ||
    assignment.songTitle ||
    assignment.songId;

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
          {nowSong && !open && (
            <span className="hidden truncate text-sm text-gray-500 sm:inline">
              {nowSong.title}
            </span>
          )}
        </span>
        {open ? (
          <ChevronDown className="h-5 w-5 text-[#2F6B3D]" />
        ) : (
          <ChevronRight className="h-5 w-5 text-[#2F6B3D]" />
        )}
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
          {assignError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{assignError}</p>
          )}

          {/* Now: current song + path progress. Tap to manage the sequence. */}
          {nowAssignment && (
            <div className="rounded-lg border border-[#2F6B3D]/20 bg-green-50/50">
              <button
                type="button"
                onClick={() => setManageOpen(!manageOpen)}
                className="flex w-full max-w-2xl items-center justify-between gap-3 p-3 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold text-gray-800">
                    {titleFor(nowAssignment)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[nowAssignment.status] || STATUS_STYLES.assigned}`}
                  >
                    {nowAssignment.status}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm text-gray-500">
                  {pathProgress && (
                    <>
                      <span className="hidden sm:inline">{pathProgress.name}</span>
                      <span className="flex items-center gap-0.5">
                        {pathProgress.steps.map((step) => (
                          <span
                            key={step.songId}
                            className={`h-2 w-2 rounded-full ${
                              step.status === 'done'
                                ? 'bg-[#2F6B3D]'
                                : step.status === 'working'
                                  ? 'bg-amber-400'
                                  : 'border border-[#2F6B3D]/40'
                            }`}
                          />
                        ))}
                      </span>
                      <span>
                        {pathProgress.position} of {pathProgress.steps.length}
                      </span>
                    </>
                  )}
                  {manageOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
              </button>

              {manageOpen && (
                <ul className="max-w-2xl space-y-1.5 border-t border-[#2F6B3D]/10 p-3">
                  {orderedAssignments.map((assignment, index) => {
                    const isParked = assignment.status === 'parked';
                    const busy = pendingId === assignment.songId;
                    return (
                      <li
                        key={assignment.songId}
                        className={`flex items-center gap-2 ${isParked ? 'opacity-50' : ''}`}
                      >
                        <span className="w-5 shrink-0 text-right text-sm text-gray-400">
                          {isParked ? '·' : `${index + 1}.`}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                          {titleFor(assignment)}
                        </span>
                        <button
                          type="button"
                          disabled={busy || isParked}
                          onClick={() => cycleStatus(assignment)}
                          title="Tap to change status"
                          className={`rounded-full px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${STATUS_STYLES[assignment.status] || STATUS_STYLES.assigned}`}
                        >
                          {assignment.status || 'assigned'}
                        </button>
                        <button
                          type="button"
                          disabled={busy || isParked}
                          onClick={() => move(assignment.songId, 'up')}
                          className="rounded p-1 text-[#2F6B3D] hover:bg-green-100 disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy || isParked}
                          onClick={() => move(assignment.songId, 'down')}
                          className="rounded p-1 text-[#2F6B3D] hover:bg-green-100 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setStatus(assignment.songId, isParked ? 'assigned' : 'parked')
                          }
                          className="rounded p-1 text-gray-400 hover:bg-gray-100"
                          aria-label={isParked ? 'Bring back' : 'Park'}
                          title={isParked ? 'Bring back' : 'Park (hidden from student)'}
                        >
                          {isParked ? (
                            <RotateCcw className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Next: level-matched shelf. Tap a card to assign it. */}
          {canAssign && loaded && shelf.candidates.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {activeAssignments.length ? 'Next song' : 'First song'} · {shelf.level}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {shelf.candidates.map((song) => (
                  <button
                    key={song.songId}
                    type="button"
                    disabled={pendingId === song.songId}
                    onClick={() => assignSong(song.songId)}
                    className="group w-32 shrink-0 rounded-lg border border-[#2F6B3D]/25 p-3 text-left transition-colors hover:border-[#2F6B3D] hover:bg-green-50 disabled:opacity-50"
                  >
                    <span className="block text-sm font-semibold leading-snug text-gray-800">
                      {song.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {song.artist}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#2F6B3D]">
                      <Plus className="h-3 w-3" />
                      {pendingId === song.songId ? 'Assigning…' : 'Assign'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Paths with something left to offer. */}
          {canAssign && loaded && pathTemplates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Paths
              </span>
              {pathTemplates.map((template) => (
                <button
                  key={template.pathId}
                  type="button"
                  disabled={pendingId === template.pathId}
                  onClick={() => assignPath(template.pathId)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#2F6B3D]/40 px-3 py-1 text-sm font-medium text-[#2F6B3D] transition-colors hover:bg-green-50 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {template.name} ({template.steps.length})
                </button>
              ))}
            </div>
          )}

          {/* Browse: the full catalogue, only when asked for. */}
          <div>
            <button
              type="button"
              onClick={() => setBrowseOpen(!browseOpen)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#2F6B3D] hover:underline"
            >
              {browseOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Browse all {songs.length}
            </button>

            {browseOpen && (
              <div className="mt-3 max-w-2xl space-y-4">
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                  <Search className="h-4 w-4 shrink-0 text-gray-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title or artist"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </label>

                {browseLevels.map((level) => (
                  <div key={level}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {level}
                    </p>
                    <ul className="divide-y divide-gray-100">
                      {browseSongs
                        .filter((song) => song.level === level)
                        .map((song) => {
                          const isAssigned = assignedSongIds.has(song.songId);
                          const expanded = expandedSongId === song.songId;
                          return (
                            <li key={song.songId} className="py-2">
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSongId(expanded ? null : song.songId)
                                  }
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <span className="font-medium text-gray-800">{song.title}</span>
                                  <span className="text-sm text-gray-500"> — {song.artist}</span>
                                </button>
                                <div className="flex shrink-0 items-center gap-1">
                                  {canAssign &&
                                    (isAssigned ? (
                                      <span className="p-1.5 text-[#2F6B3D]" title="Assigned">
                                        <Check className="h-4 w-4" />
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={pendingId === song.songId || !loaded}
                                        onClick={() => assignSong(song.songId)}
                                        className="rounded-lg border border-[#2F6B3D]/40 p-1.5 text-[#2F6B3D] transition-colors hover:bg-green-50 disabled:opacity-40"
                                        aria-label={`Assign ${song.title}`}
                                        title="Assign"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </button>
                                    ))}
                                  <a
                                    href={song.soundsliceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-lg p-1.5 text-[#2F6B3D] transition-colors hover:bg-green-50"
                                    aria-label={`Open ${song.title} in Soundslice`}
                                    title="Open in Soundslice"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </div>
                              </div>
                              {expanded && (song.tutorNote || song.tags?.length > 0) && (
                                <div className="mt-1.5 text-sm text-gray-600">
                                  {song.tutorNote && <p>{song.tutorNote}</p>}
                                  {song.tags?.length > 0 && (
                                    <p className="mt-1 text-xs text-gray-400">
                                      {song.tags.join(' · ')}
                                    </p>
                                  )}
                                </div>
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))}
                {browseSongs.length === 0 && (
                  <p className="text-sm text-gray-500">Nothing matches “{search}”.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
