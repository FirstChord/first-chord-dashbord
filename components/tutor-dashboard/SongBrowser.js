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
  X,
} from 'lucide-react';
import {
  getSongsForInstrument,
  levelsForSeries,
  seriesForSongs,
  seriesOf,
  songMatchesInstrument,
} from '@/lib/songs/catalogue-helpers.mjs';
import {
  buildPathProgress,
  inferStudentLevel,
  inferStudentSeries,
} from '@/lib/songs/shelf-helpers.mjs';
import { PATH_TEMPLATES } from '@/lib/config/path-templates.mjs';

// Tapping the status chip walks this cycle; parking lives on its own control.
const STATUS_CYCLE = ['assigned', 'working', 'ready', 'done'];
const STATUS_STYLES = {
  assigned: 'bg-gray-100 text-gray-600',
  working: 'bg-amber-100 text-amber-800',
  ready: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  parked: 'bg-gray-100 text-gray-400',
};

// Student-centred song panel: a Now strip (current song + path progress, tap
// to manage the sequence) above the RSL bookcase — a rail of grade tiles with
// the student's grade preselected and that grade's songs as cards. Assigned
// cards stay on the shelf with a tick. Renders nothing when the catalogue has
// no songs for the student's instrument.
export default function SongBrowser({ student }) {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState(null); // null = student's series
  const [selectedLevel, setSelectedLevel] = useState(null); // null = student's level
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [techOpen, setTechOpen] = useState(false);
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
    setManageOpen(false);
    setSelectedSeries(null);
    setSelectedLevel(null);
    setSearchOpen(false);
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

  // A series (RSL grades, John Thompson books) is a tab; its levels are the rail.
  const availableSeries = seriesForSongs(songs);
  const studentSeries = inferStudentSeries(assignments || [], songs);
  const shelfSeries = selectedSeries || studentSeries || availableSeries[0]?.id || null;

  const railLevels = levelsForSeries(shelfSeries, songs);
  const studentLevel = inferStudentLevel(assignments || [], songs, shelfSeries);
  const shelfLevel = selectedLevel || studentLevel || railLevels[0];

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
  // Search reaches across every series; otherwise the shelf is one series' level.
  const shelfItems = searchTerm
    ? songs.filter(
        (song) =>
          song.title.toLowerCase().includes(searchTerm) ||
          (song.artist || '').toLowerCase().includes(searchTerm)
      )
    : songs.filter((song) => seriesOf(song) === shelfSeries && song.level === shelfLevel);
  // Songs are the shelf; scales/exercises sit in a quiet row below it.
  // A search shows everything as cards so nothing is unfindable.
  const shelfSongs = searchTerm
    ? shelfItems
    : shelfItems.filter((song) => (song.contentType || 'song') === 'song');
  const shelfTechnical = searchTerm
    ? []
    : shelfItems.filter((song) => (song.contentType || 'song') !== 'song');

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

          {/* The bookcase: series tabs (only when more than one), then that
              series' level rail, then the selected level's songs as cards. */}
          <div>
            {availableSeries.length > 1 && (
              <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-gray-100">
                {availableSeries.map((series) => {
                  const isShelf = series.id === shelfSeries;
                  return (
                    <button
                      key={series.id}
                      type="button"
                      onClick={() => {
                        setSelectedSeries(series.id);
                        setSelectedLevel(null);
                        setSearch('');
                        setSearchOpen(false);
                      }}
                      className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
                        isShelf
                          ? 'border-[#2F6B3D] font-semibold text-[#2F6B3D]'
                          : 'border-transparent text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {series.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              {availableSeries.length === 1 && (
                <span className="text-xs font-bold uppercase tracking-wide text-[#2F6B3D]">
                  {availableSeries[0].name}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-1">
                {railLevels.map((level) => {
                  const isShelf = !searchTerm && level === shelfLevel;
                  const isStudentLevel = level === studentLevel;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        setSelectedLevel(level);
                        setSearch('');
                        setSearchOpen(false);
                      }}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        isShelf
                          ? 'bg-[#2F6B3D] font-semibold text-white'
                          : isStudentLevel
                            ? 'font-semibold text-[#2F6B3D] hover:bg-green-50'
                            : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  setSearch('');
                }}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-[#2F6B3D]"
                aria-label={searchOpen ? 'Close search' : 'Search songs'}
              >
                {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
              {searchOpen && (
                <input
                  type="search"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Title or artist"
                  className="min-w-40 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#2F6B3D]/50"
                />
              )}
            </div>

            <div className="grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {shelfSongs.map((song) => {
                const isAssigned = assignedSongIds.has(song.songId);
                const busy = pendingId === song.songId;
                return (
                  <div
                    key={song.songId}
                    className={`relative rounded-lg border p-3 transition-colors ${
                      isAssigned
                        ? 'border-[#2F6B3D]/30 bg-green-50/60'
                        : 'border-gray-200 hover:border-[#2F6B3D]/50'
                    }`}
                  >
                    <a
                      href={song.soundsliceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2 top-2 rounded p-1 text-gray-300 hover:bg-green-50 hover:text-[#2F6B3D]"
                      aria-label={`Open ${song.title} in Soundslice`}
                      title="Open in Soundslice"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <p
                      className="pr-6 text-sm font-semibold leading-snug text-gray-800"
                      title={song.tutorNote || undefined}
                    >
                      {song.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <p className="truncate text-xs text-gray-500">{song.artist}</p>
                      {/* A grade can hold pieces from two different RSL syllabuses at once
                          (Rock School and Classical). Only the Classical ones are marked —
                          badging both would just be noise on every card. */}
                      {(song.tags || []).includes('classical') && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
                          Classical
                        </span>
                      )}
                    </div>
                    {searchTerm && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {song.level}
                        {(song.contentType || 'song') !== 'song' ? ` · ${song.contentType}` : ''}
                      </p>
                    )}
                    <div className="mt-2">
                      {isAssigned ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2F6B3D]">
                          <Check className="h-3.5 w-3.5" /> Assigned
                        </span>
                      ) : (
                        canAssign && (
                          <button
                            type="button"
                            disabled={busy || !loaded}
                            onClick={() => assignSong(song.songId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#2F6B3D] hover:underline disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {busy ? 'Assigning…' : 'Assign'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
              {shelfSongs.length === 0 && (
                <p className="col-span-full text-sm text-gray-500">
                  {searchTerm ? `Nothing matches “${search}”.` : 'No songs at this grade yet.'}
                </p>
              )}
            </div>

            {shelfTechnical.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setTechOpen(!techOpen)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#2F6B3D]"
                >
                  {techOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Technical exercises · {shelfTechnical.length}
                </button>
                {techOpen && (
                  <ul className="mt-2 flex max-w-4xl flex-wrap gap-1.5">
                    {shelfTechnical.map((item) => {
                      const isAssigned = assignedSongIds.has(item.songId);
                      const busy = pendingId === item.songId;
                      return (
                        <li
                          key={item.songId}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                            isAssigned
                              ? 'border-[#2F6B3D]/30 bg-green-50 text-[#2F6B3D]'
                              : 'border-gray-200 text-gray-600'
                          }`}
                        >
                          {canAssign && !isAssigned ? (
                            <button
                              type="button"
                              disabled={busy || !loaded}
                              onClick={() => assignSong(item.songId)}
                              className="inline-flex items-center gap-1 hover:text-[#2F6B3D] disabled:opacity-40"
                              title="Assign"
                            >
                              <Plus className="h-3 w-3" />
                              {item.title}
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {isAssigned && <Check className="h-3 w-3" />}
                              {item.title}
                            </span>
                          )}
                          <a
                            href={item.soundsliceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:text-[#2F6B3D]"
                            aria-label={`Open ${item.title} in Soundslice`}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

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
        </div>
      )}
    </div>
  );
}
