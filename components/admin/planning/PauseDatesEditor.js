'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  buildPauseLessonDateSuggestions,
  buildStructuredPausePlanningDraft,
} from '@/lib/admin/planning-helpers.mjs';
import {
  extractPauseDatesFromPlanningItem,
  findStudentById,
  formatTargetDate,
} from '@/lib/admin/planning-client-helpers.mjs';
import { SelectField, TextField, DateField, StudentSearchField } from './fields';

// The structured pause date editor (pause type, student, schedule-aware date
// suggestions, date fields, live draft preview, save). Extracted from PlanningCard
// so both the card's inline "Edit dates" affordance and the planning side-panel
// use one editing surface. Manages its own repair state; the parent supplies the
// item and the save handler (onSave -> onRepairPauseDetails). `startOpen` opens
// the editor immediately (the side panel + inbox "Open plan" deep link use this).
export default function PauseDatesEditor({
  item,
  studentOptions = [],
  isPending = false,
  onSave,
  startOpen = false,
  hasPrefillUrl = false,
}) {
  const existingPauseDates = extractPauseDatesFromPlanningItem(item);
  const [open, setOpen] = useState(startOpen);
  const [scheduleOverrides, setScheduleOverrides] = useState({});
  const [scheduleRefreshState, setScheduleRefreshState] = useState({ pendingId: '', error: '' });
  const [options, setOptions] = useState({
    pauseType: existingPauseDates.startDate && existingPauseDates.endDate && existingPauseDates.startDate !== existingPauseDates.endDate ? 'range' : 'single',
    linkedStudentId: item.linkedStudentId || '',
    pauseLessonDate: existingPauseDates.startDate === existingPauseDates.endDate ? existingPauseDates.startDate : '',
    pauseFirstPauseDate: existingPauseDates.startDate !== existingPauseDates.endDate ? existingPauseDates.startDate : '',
    pauseReturnDate: existingPauseDates.startDate !== existingPauseDates.endDate ? existingPauseDates.endDate : '',
    pauseExtraNote: '',
  });

  const pauseType = options.pauseType === 'range' ? 'range' : 'single';
  const studentBase = findStudentById(studentOptions, options.linkedStudentId);
  const student = studentBase ? {
    ...studentBase,
    scheduleContext: scheduleOverrides[options.linkedStudentId] || studentBase.scheduleContext,
  } : null;
  const dateSuggestions = buildPauseLessonDateSuggestions(student?.scheduleContext, {
    count: 6,
    startDate: pauseType === 'range' ? options.pauseFirstPauseDate || '' : '',
  });
  const draft = buildStructuredPausePlanningDraft({
    studentName: student?.fullName || '',
    pauseType,
    lessonDate: options.pauseLessonDate || '',
    firstPauseDate: options.pauseFirstPauseDate || '',
    returnDate: options.pauseReturnDate || '',
    extraNote: options.pauseExtraNote || '',
  });

  async function refreshSchedule() {
    if (!options.linkedStudentId) return;
    setScheduleRefreshState({ pendingId: options.linkedStudentId, error: '' });
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(options.linkedStudentId)}/schedule`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Schedule refresh failed');
      }
      setScheduleOverrides((current) => ({ ...current, [options.linkedStudentId]: data.scheduleContext }));
      setScheduleRefreshState({ pendingId: '', error: '' });
    } catch (error) {
      setScheduleRefreshState({ pendingId: '', error: error.message || 'Schedule refresh failed' });
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50"
      >
        {open ? 'Hide dates' : (hasPrefillUrl ? 'Edit dates' : 'Add dates to this plan')}
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField
              label="Pause type"
              value={pauseType}
              onChange={(value) => setOptions((current) => ({ ...current, pauseType: value }))}
              options={[
                { value: 'single', label: 'One lesson' },
                { value: 'range', label: 'Away period' },
              ]}
            />
            <StudentSearchField
              label="Student"
              value={options.linkedStudentId}
              onChange={(value) => setOptions((current) => ({ ...current, linkedStudentId: value }))}
              studentOptions={studentOptions}
            />
          </div>

          {student?.scheduleContext?.status === 'found' && dateSuggestions.length ? (
            <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Suggested lesson dates</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {dateSuggestions.map((suggestion) => (
                  <div key={suggestion.date} className="rounded-lg border border-violet-100 bg-white p-2">
                    <p className="text-sm font-semibold text-slate-900">{suggestion.lessonLabel}</p>
                    {pauseType === 'single' ? (
                      <button
                        type="button"
                        onClick={() => setOptions((current) => ({ ...current, pauseLessonDate: suggestion.date }))}
                        className="mt-2 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                      >
                        Use this lesson
                      </button>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setOptions((current) => ({ ...current, pauseFirstPauseDate: suggestion.date }))}
                          className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                        >
                          First missed
                        </button>
                        <button
                          type="button"
                          onClick={() => setOptions((current) => ({ ...current, pauseReturnDate: suggestion.date }))}
                          className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                        >
                          Returning
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : options.linkedStudentId ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-950">No cached schedule for this student yet.</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Refresh from MMS to pull the usual lesson slot into `Schedule_Context`, then the suggested pause dates should appear here.
              </p>
              <button
                type="button"
                onClick={refreshSchedule}
                disabled={scheduleRefreshState.pendingId === options.linkedStudentId}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scheduleRefreshState.pendingId === options.linkedStudentId ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Refreshing…
                  </>
                ) : 'Refresh schedule from MMS'}
              </button>
              {scheduleRefreshState.error ? (
                <p className="mt-2 text-xs font-semibold text-red-700">{scheduleRefreshState.error}</p>
              ) : null}
            </div>
          ) : null}

          {pauseType === 'single' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <DateField
                label="Lesson to pause"
                value={options.pauseLessonDate || ''}
                onChange={(value) => setOptions((current) => ({ ...current, pauseLessonDate: value }))}
              />
              <TextField
                label="Extra note"
                value={options.pauseExtraNote || ''}
                onChange={(value) => setOptions((current) => ({ ...current, pauseExtraNote: value }))}
                placeholder="Optional reason or context"
              />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <DateField
                label="First lesson missed"
                value={options.pauseFirstPauseDate || ''}
                onChange={(value) => setOptions((current) => ({ ...current, pauseFirstPauseDate: value }))}
              />
              <DateField
                label="Returning from"
                value={options.pauseReturnDate || ''}
                onChange={(value) => setOptions((current) => ({ ...current, pauseReturnDate: value }))}
              />
              <TextField
                label="Extra note"
                value={options.pauseExtraNote || ''}
                onChange={(value) => setOptions((current) => ({ ...current, pauseExtraNote: value }))}
                placeholder="Summer holiday, illness, etc."
              />
            </div>
          )}

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
            {draft.isComplete ? (
              <>
                <p className="font-semibold text-slate-900">{draft.title}</p>
                <p className="mt-1 whitespace-pre-line">{draft.notes}</p>
                {draft.targetDate ? (
                  <p className="mt-2 text-xs font-semibold text-amber-800">Do by {formatTargetDate(draft.targetDate)}</p>
                ) : null}
              </>
            ) : (
              <p>Add {draft.missingFields.join(' and ')} to repair this pause plan.</p>
            )}
          </div>

          <button
            type="button"
            disabled={isPending || !draft.isComplete}
            onClick={() => onSave(item, { draft, linkedStudentId: options.linkedStudentId })}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save structured dates
          </button>
        </div>
      ) : null}
    </div>
  );
}
