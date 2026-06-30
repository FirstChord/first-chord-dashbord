'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

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

function formatCheckedAt(value = '') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function attendanceBadgeClass(tone = 'expected') {
  const classes = {
    expected: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    notice: 'border-amber-200 bg-amber-50 text-amber-800',
    absent: 'border-rose-100 bg-rose-50 text-rose-700',
    teacher_absent: 'border-violet-100 bg-violet-50 text-violet-700',
    present: 'border-blue-100 bg-blue-50 text-blue-700',
    mixed: 'border-gray-200 bg-gray-50 text-gray-700',
  };
  return classes[tone] || classes.mixed;
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
  const checkedAt = formatCheckedAt(schedule?.refreshedAt);

  if (!tutor) return null;

  if (compact && isCollapsed) {
    return (
      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-blue-50/80 px-4 py-2 text-sm font-bold text-blue-900 shadow-sm backdrop-blur hover:bg-white/90"
        >
          <CalendarDays className="h-4 w-4 text-blue-700" />
          Today’s lessons
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-blue-800">
            {schedule?.summary?.lessonCount ?? lessons.length}
          </span>
          <ChevronDown className="h-4 w-4 text-blue-700" />
        </button>
      </div>
    );
  }

  return (
    <section className={`rounded-xl border border-white/70 bg-gradient-to-br from-white/75 via-blue-50/75 to-green-50/55 p-4 shadow-sm shadow-blue-200/30 backdrop-blur ${compact ? 'mb-5 ml-auto max-w-xl' : 'w-full max-w-2xl'}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-blue-950">
            <CalendarDays className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-bold">Today’s lessons</h2>
          </div>
          <p className="mt-1 text-sm font-semibold text-blue-800/70">{formatDisplayDate(date)}</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm"
          />
          <button
            type="button"
            onClick={() => loadSchedule({ refresh: true })}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-sm font-bold text-blue-900 shadow-sm hover:bg-white disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {compact && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/80 bg-white/80 px-3 py-2 text-sm font-bold text-blue-900 shadow-sm hover:bg-white"
              aria-label="Collapse today’s lessons"
            >
              <ChevronUp className="h-4 w-4" />
              Collapse
            </button>
          )}
        </div>
      </div>

      {checkedAt && (
        <p className="mb-3 text-xs font-semibold text-blue-900/55">Checked {checkedAt} from MMS calendar.</p>
      )}

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      )}

      {!error && isLoading && !schedule && (
        <div className="space-y-2">
          <div className="h-12 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-12 rounded-lg bg-gray-100 animate-pulse" />
          <div className="h-12 rounded-lg bg-gray-100 animate-pulse" />
        </div>
      )}

      {!error && !isLoading && schedule && lessons.length === 0 && (
        <div className="rounded-lg border border-dashed border-blue-200/80 bg-white/60 px-4 py-5 text-center text-sm font-semibold text-blue-900/60">
          No lessons found for {tutor} on this date.
        </div>
      )}

      {!error && lessons.length > 0 && (
        <div className="space-y-2">
          {lessons.map((lesson) => {
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

            const content = (
              <>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="w-14 shrink-0 text-sm font-semibold text-gray-900">{lesson.lessonTime || '—'}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-gray-900">{lesson.studentLabel}</div>
                    <div className="text-xs font-semibold text-gray-600">
                      {lesson.durationMinutes ? `${lesson.durationMinutes} mins` : 'Duration unknown'}
                      {lesson.category ? ` · ${lesson.category}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${attendanceBadgeClass(attendance.tone)}`}>
                    {attendance.label}
                  </span>
                  {attendance.detail && (
                    <span className={`max-w-32 text-xs font-semibold ${attendance.requiresPracticeVideo ? 'text-amber-700' : 'text-gray-600'}`}>
                      {attendance.detail}
                    </span>
                  )}
                </div>
              </>
            );

            if (canSelect) {
              return (
                <button
                  type="button"
                  key={lesson.eventId}
                  onClick={() => {
                    if (compact) setIsCollapsed(true);
                    onSelectStudent(linkedStudent);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/80 bg-white/70 px-3 py-3 text-left shadow-sm hover:border-blue-200 hover:bg-white/90"
                >
                  {content}
                </button>
              );
            }

            return (
              <div
                key={lesson.eventId}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/80 bg-white/70 px-3 py-3 shadow-sm"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
