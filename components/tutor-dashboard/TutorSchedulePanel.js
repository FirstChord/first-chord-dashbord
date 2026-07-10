'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value = '') {
  const match = `${value || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || 'Today';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
}

// Green = happened and went well, grey = not happened yet, red/amber = absence
const DOT_CLASSES = {
  expected: 'border-2 border-gray-300 bg-white',
  notice: 'bg-amber-400',
  absent: 'bg-rose-400',
  teacher_absent: 'bg-violet-400',
  present: 'bg-emerald-500',
  mixed: 'bg-gray-400',
};

const LABEL_CLASSES = {
  expected: 'text-gray-500',
  notice: 'text-amber-700',
  absent: 'text-rose-600',
  teacher_absent: 'text-violet-700',
  present: 'text-emerald-700',
  mixed: 'text-gray-600',
};

function lessonStartMinutes(lesson) {
  const match = `${lesson.lessonTime || ''}`.match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function lessonEndMinutes(lesson) {
  const start = lessonStartMinutes(lesson);
  return start == null ? null : start + (lesson.durationMinutes || 30);
}

export default function TutorSchedulePanel({
  tutor,
  students = [],
  onSelectStudent,
  compact = false,
  defaultCollapsed = false,
  collapseKey = '',
}) {
  const [date, setDate] = useState(todayInputValue());
  const [schedule, setSchedule] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const dateInputRef = useRef(null);

  const studentByMmsId = useMemo(() => (
    new Map((students || []).map((student) => [student.mms_id, student]))
  ), [students]);

  const loadSchedule = async ({ refresh = false } = {}) => {
    if (!tutor || !date) return;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ tutor, date });
      if (refresh) params.set('refresh', '1');
      const response = await fetch(`/api/tutor-schedule?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not load today’s lessons.');
      }
      setSchedule(data);
    } catch (err) {
      setError(err.message || 'Could not load today’s lessons.');
      setSchedule(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [tutor, date]);

  useEffect(() => {
    if (compact && defaultCollapsed) {
      setIsCollapsed(true);
    }
  }, [collapseKey, compact, defaultCollapsed]);

  const lessons = schedule?.lessons || [];

  // "Now" awareness only applies when we're looking at today
  const isToday = date === todayInputValue();
  const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : null;
  const inProgressIndex = isToday
    ? lessons.findIndex((lesson) => {
        const start = lessonStartMinutes(lesson);
        const end = lessonEndMinutes(lesson);
        return start != null && end != null && start <= nowMinutes && nowMinutes < end;
      })
    : -1;
  const upNextIndex = isToday
    ? lessons.findIndex((lesson) => {
        const start = lessonStartMinutes(lesson);
        return start != null && start > nowMinutes;
      })
    : -1;

  if (!tutor) return null;

  if (compact && isCollapsed) {
    return (
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="inline-flex items-center gap-2 rounded-full border border-[#2F6B3D]/30 bg-green-50/80 px-4 py-2 text-sm font-bold text-[#2F6B3D] shadow-sm backdrop-blur hover:bg-white/90"
        >
          Today’s lessons
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-[#2F6B3D]">
            {schedule?.summary?.lessonCount ?? lessons.length}
          </span>
          <ChevronDown className="h-4 w-4 text-[#2F6B3D]" />
        </button>
      </div>
    );
  }

  return (
    <section className={`rounded-xl border border-[#2F6B3D]/30 bg-gradient-to-br from-white/75 via-blue-50/75 to-green-50/55 p-4 shadow-sm shadow-green-200/30 backdrop-blur ${compact ? 'mb-5 ml-auto max-w-xl' : 'w-full max-w-2xl'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#24422B]">Today’s lessons</h2>
          <div className="relative mt-0.5 inline-block">
            <button
              type="button"
              onClick={() => {
                const input = dateInputRef.current;
                if (!input) return;
                if (typeof input.showPicker === 'function') {
                  input.showPicker();
                } else {
                  input.focus();
                }
              }}
              title="Pick a date"
              className="text-sm font-semibold text-[#2F6B3D]/80 underline decoration-transparent underline-offset-2 transition-colors hover:text-[#2F6B3D] hover:decoration-[#2F6B3D]/50"
            >
              {formatDisplayDate(date)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
              tabIndex={-1}
              aria-hidden
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => loadSchedule({ refresh: true })}
            disabled={isLoading}
            aria-label="Refresh lessons"
            title="Refresh lessons"
            className="rounded-lg p-2 text-[#2F6B3D]/70 transition-colors hover:bg-white/80 hover:text-[#2F6B3D] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {compact && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse today’s lessons"
              title="Collapse"
              className="rounded-lg p-2 text-[#2F6B3D]/70 transition-colors hover:bg-white/80 hover:text-[#2F6B3D]"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}

      {!error && isLoading && !schedule && (
        <div className="space-y-2">
          <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      )}

      {!error && !isLoading && schedule && lessons.length === 0 && (
        <div className="rounded-lg border border-dashed border-blue-200/80 bg-white/60 px-4 py-5 text-center text-sm font-semibold text-blue-900/60">
          No lessons found for {tutor} on this date.
        </div>
      )}

      {!error && lessons.length > 0 && (
        <ol className="relative">
          {/* timeline rail: time column (56px) + gap (12px) + half dot (5px) */}
          <div aria-hidden className="absolute bottom-3 left-[72px] top-3 w-px bg-[#2F6B3D]/20" />
          {lessons.map((lesson, index) => {
            const linkedStudent = lesson.studentMmsIds
              .map((studentId) => studentByMmsId.get(studentId))
              .find(Boolean);
            const canSelect = Boolean(linkedStudent && onSelectStudent);
            const attendance = lesson.attendanceSummary || {
              label: 'Expected',
              detail: '',
              tone: 'expected',
              requiresPracticeVideo: false,
            };
            const detail = attendance.detail === 'Attendance not marked yet' ? '' : attendance.detail;
            const isInProgress = index === inProgressIndex;
            const showNowMarker = inProgressIndex === -1 && index === upNextIndex;

            const row = (
              <div
                className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                  isInProgress ? 'bg-green-100/70' : ''
                } ${canSelect ? 'hover:bg-white/80' : ''}`}
              >
                <div className="w-12 shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-gray-800">
                  {lesson.lessonTime || '—'}
                </div>
                <div className="relative z-10 mt-1.5 flex w-2.5 shrink-0 justify-center">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${DOT_CLASSES[attendance.tone] || DOT_CLASSES.mixed} ${
                      isInProgress ? 'animate-pulse ring-4 ring-green-200/70' : ''
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-bold text-gray-900">{lesson.studentLabel}</span>
                    <span className={`shrink-0 text-xs font-semibold ${LABEL_CLASSES[attendance.tone] || LABEL_CLASSES.mixed}`}>
                      {isInProgress ? 'In lesson' : attendance.label}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium text-gray-500">
                      {lesson.durationMinutes ? `${lesson.durationMinutes} mins` : ''}
                      {lesson.category && lesson.category !== 'Lesson' ? ` · ${lesson.category}` : ''}
                    </span>
                    {detail && (
                      <span className={`shrink-0 text-xs font-medium ${attendance.requiresPracticeVideo ? 'text-amber-700' : 'text-gray-500'}`}>
                        {detail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );

            return (
              <li key={lesson.eventId}>
                {showNowMarker && (
                  <div aria-hidden className="flex items-center gap-2 py-1 pl-2">
                    <span className="w-12 shrink-0 text-right text-[10px] font-bold uppercase tracking-wide text-rose-500">now</span>
                    <span className="relative z-10 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" style={{ marginLeft: '2px' }} />
                    <span className="h-px flex-1 bg-rose-300/80" />
                  </div>
                )}
                {canSelect ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (compact) setIsCollapsed(true);
                      onSelectStudent(linkedStudent);
                    }}
                    className="w-full"
                  >
                    {row}
                  </button>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
