'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  SCHOOL_FORWARD_PLANNING_ID,
  MONDAY_SCHEDULE_PLANNING_ID,
  labelPlanningStatus,
  parseLinkedStudentIds,
  buildPauseLessonDateSuggestions,
  buildStructuredPausePlanningDraft,
} from '@/lib/admin/planning-helpers.mjs';
import {
  extractPauseDatesFromPlanningItem,
  isPausePlanningItem,
  isSchoolNotePlanningItem,
  hasPausePaymentConfirmation,
  buildTutorAbsenceWorkflowHref,
  workflowHref,
  findStudentById,
  buildPaymentPausePrefillUrl,
  buildPauseConfirmationMessage,
  momentumClasses,
  formatTargetDate,
  formatDateTime,
  shortPreview,
  studentHref,
} from '@/lib/admin/planning-client-helpers.mjs';
import { logCommunicationCopy } from '@/lib/admin/log-communication-copy.js';
import { SelectField, TextField, DateField, StudentSearchField, ExpandableText, LinkPill } from './fields';

// The per-planning-item card: status actions, progress logging, link facts, and — for
// pause items — the full pause toolkit (open the pause tool, copy the parent message,
// the "Edit dates" repair builder, and the two-checkbox "Mark pause completed" gate).
// Pure props in (item + studentOptions + handlers); also used inside DueTodayCard.
export default function PlanningCard({ item, studentOptions = [], paymentExpectationOverrides = {}, onStatus, onArchive, onEdit, onProgress, onPauseCompleted, onRepairPauseDetails, onOpenPauseTool, onOpenWorkflowPanel, onCreateLinkedAction, pendingId, compact = false, nearbyPause = null }) {
  const [progressNote, setProgressNote] = useState('');
  const [nextAction, setNextAction] = useState(item.nextAction || '');
  const [pauseToolRan, setPauseToolRan] = useState(false);
  const [pauseMessageConfirmed, setPauseMessageConfirmed] = useState(false);
  const [copyState, setCopyState] = useState('');
  const [scheduleOverrides, setScheduleOverrides] = useState({});
  const [scheduleRefreshState, setScheduleRefreshState] = useState({ pendingId: '', error: '' });
  const existingPauseDates = extractPauseDatesFromPlanningItem(item);
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairOptions, setRepairOptions] = useState({
    pauseType: existingPauseDates.startDate && existingPauseDates.endDate && existingPauseDates.startDate !== existingPauseDates.endDate ? 'range' : 'single',
    linkedStudentId: item.linkedStudentId || '',
    pauseLessonDate: existingPauseDates.startDate === existingPauseDates.endDate ? existingPauseDates.startDate : '',
    pauseFirstPauseDate: existingPauseDates.startDate !== existingPauseDates.endDate ? existingPauseDates.startDate : '',
    pauseReturnDate: existingPauseDates.startDate !== existingPauseDates.endDate ? existingPauseDates.endDate : '',
    pauseExtraNote: '',
  });
  const isPending = pendingId === item.planningId;
  const isPauseReminder = isPausePlanningItem(item);
  const isSchoolNote = isSchoolNotePlanningItem(item);
  const isSchoolForwardReview = item.planningId === SCHOOL_FORWARD_PLANNING_ID;
  const isSystemPlanningItem = item.planningId === SCHOOL_FORWARD_PLANNING_ID || item.planningId === MONDAY_SCHEDULE_PLANNING_ID;
  const pausePaymentConfirmed = hasPausePaymentConfirmation(item);
  const isTutorAbsenceCard = item.linkedWorkflowId === 'tutor-absence' && Boolean(item.linkedTutorId);
  const linkedWorkflowHref = isTutorAbsenceCard
    ? buildTutorAbsenceWorkflowHref(item)
    : workflowHref(item.linkedWorkflowId);
  const linkedStudentBase = findStudentById(studentOptions, item.linkedStudentId);
  const linkedStudent = linkedStudentBase ? {
    ...linkedStudentBase,
    scheduleContext: scheduleOverrides[item.linkedStudentId] || linkedStudentBase.scheduleContext,
  } : null;
  const repairStudentBase = findStudentById(studentOptions, repairOptions.linkedStudentId);
  const repairStudent = repairStudentBase ? {
    ...repairStudentBase,
    scheduleContext: scheduleOverrides[repairOptions.linkedStudentId] || repairStudentBase.scheduleContext,
  } : null;
  const repairPauseType = repairOptions.pauseType === 'range' ? 'range' : 'single';
  const repairDateSuggestions = buildPauseLessonDateSuggestions(repairStudent?.scheduleContext, {
    count: 6,
    startDate: repairPauseType === 'range' ? repairOptions.pauseFirstPauseDate || '' : '',
  });
  const repairDraft = buildStructuredPausePlanningDraft({
    studentName: repairStudent?.fullName || '',
    pauseType: repairPauseType,
    lessonDate: repairOptions.pauseLessonDate || '',
    firstPauseDate: repairOptions.pauseFirstPauseDate || '',
    returnDate: repairOptions.pauseReturnDate || '',
    extraNote: repairOptions.pauseExtraNote || '',
  });
  const linkedStudentPaymentExpectation = paymentExpectationOverrides[item.linkedStudentId] || linkedStudent?.paymentExpectation || '';
  const pauseExpectationAlreadySet = linkedStudentPaymentExpectation === 'stripe_paused_expected';
  const paymentPausePrefillUrl = isPauseReminder
    ? buildPaymentPausePrefillUrl({ item, student: linkedStudent })
    : '';
  const pauseConfirmationMessage = isPauseReminder
    ? buildPauseConfirmationMessage({ item, student: linkedStudent })
    : '';
  const canCompletePause = Boolean(
    item.linkedStudentId
    && paymentPausePrefillUrl
    && (pauseToolRan || pauseExpectationAlreadySet)
    && (pauseMessageConfirmed || pausePaymentConfirmed)
  );
  const linkedStudentIds = parseLinkedStudentIds(item.linkedStudentIds ?? item.linkedStudentId);
  const linkFacts = [
    item.linkedWorkflowId ? { label: `Workflow: ${item.linkedWorkflowId}`, href: linkedWorkflowHref } : null,
    ...linkedStudentIds.map((id) => ({
      label: `Student: ${findStudentById(studentOptions, id)?.fullName || id}`,
      href: studentHref(id),
    })),
    item.linkedTutorId ? { label: `Tutor: ${item.linkedTutorId}`, href: '' } : null,
  ].filter(Boolean);

  async function refreshRepairSchedule() {
    if (!repairOptions.linkedStudentId) return;
    setScheduleRefreshState({ pendingId: repairOptions.linkedStudentId, error: '' });
    try {
      const response = await fetch(`/api/admin/students/${encodeURIComponent(repairOptions.linkedStudentId)}/schedule`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Schedule refresh failed');
      }
      setScheduleOverrides((current) => ({
        ...current,
        [repairOptions.linkedStudentId]: data.scheduleContext,
      }));
      setScheduleRefreshState({ pendingId: '', error: '' });
    } catch (error) {
      setScheduleRefreshState({ pendingId: '', error: error.message || 'Schedule refresh failed' });
    }
  }

  return (
    <article className={compact ? '' : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]'}>
      {nearbyPause ? (
        <p className="mb-3 rounded-xl bg-blue-50/70 px-3 py-2 text-xs leading-5 text-slate-600">
          This student also has a pause around {formatTargetDate(nearbyPause.otherStart)}
          {nearbyPause.otherEnd && nearbyPause.otherEnd !== nearbyPause.otherStart ? `–${formatTargetDate(nearbyPause.otherEnd)}` : ''}.
          {' '}If they join up, you might be doing one longer break — worth a glance before you pause.
        </p>
      ) : null}
      {!compact && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {isPauseReminder ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pause
                {item.targetDate ? (
                  <span className="normal-case text-amber-800"> · do by {formatTargetDate(item.targetDate)}</span>
                ) : null}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {item.itemTypeLabel}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${momentumClasses(item.momentum)}`}>
                  {item.momentumLabel}
                </span>
              </div>
            )}
            <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isSystemPlanningItem && item.status !== 'parked' ? (
              <button
                type="button"
                onClick={() => onArchive?.(item)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          </div>
        </div>
      )}

      {!compact && !isPauseReminder && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span>{item.owner}</span>
          <span>·</span>
          <span>{item.areaLabel}</span>
          <span>·</span>
          <span>Updated {formatDateTime(item.updatedAt || item.createdAt)}</span>
        </div>
      )}

      {item.outcome && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="font-semibold">Outcome: </span>
          {item.outcome}
        </div>
      )}

      {item.nextAction && !isPauseReminder && (
        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-slate-800">
          <span className="font-semibold">Next action: </span>
          {item.nextAction}
        </div>
      )}

      {item.targetDate && !isPauseReminder ? (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="font-semibold">Do by: </span>
          {formatTargetDate(item.targetDate)}
        </div>
      ) : null}

      {item.notes && !isPauseReminder && <p className="mt-3 text-sm leading-6 text-slate-600">{shortPreview(item.notes)}</p>}

      {linkFacts.length > 0 && !isPauseReminder && (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkFacts.map((fact) => (
            <LinkPill key={fact.label} label={fact.label} href={fact.href} />
          ))}
        </div>
      )}

      {linkedWorkflowHref && !isPauseReminder ? (
        isTutorAbsenceCard ? (
          <button
            type="button"
            onClick={() => onOpenWorkflowPanel?.({
              url: linkedWorkflowHref,
              title: item.title || 'Tutor absence',
              eyebrow: 'Tutor absence workflow',
            })}
            className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white"
          >
            Open tutor absence workflow →
          </button>
        ) : (
          <Link
            href={linkedWorkflowHref}
            className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white"
          >
            Open linked workflow
          </Link>
        )
      ) : null}

      {item.latestProgress && !isPauseReminder && (
        <div className="mt-4 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">{isSchoolForwardReview ? 'Latest reflection' : 'Latest progress'}</p>
          <ExpandableText text={item.latestProgress.progressNote} className="mt-1" />
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.latestProgress.createdAt)}</p>
        </div>
      )}

      {isSchoolNote && item.nextAction && item.status !== 'done' ? (
        <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
          <p className="text-sm font-semibold text-slate-900">Turn this thinking into work</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Keep the note as context, then create a linked action from the next step.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onCreateLinkedAction?.(item)}
            className="mt-3 inline-flex rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create linked action
          </button>
        </div>
      ) : null}

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2">
          {['active', 'waiting', 'done', 'parked'].map((status) => (
            <button
              key={status}
              type="button"
              disabled={isPending || item.status === status || (status === 'done' && isPauseReminder && !pausePaymentConfirmed)}
              onClick={() => onStatus(item, status)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {labelPlanningStatus(status)}
            </button>
          ))}
        </div>
      )}

      {isPauseReminder ? (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
          {(
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-amber-950">Complete this pause</p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Run the tool, send the parent message, then mark it complete — the dashboard handles the rest.
                </p>
              </div>
              {paymentPausePrefillUrl ? (
                onOpenPauseTool ? (
                  <button
                    type="button"
                    onClick={() => onOpenPauseTool(paymentPausePrefillUrl, linkedStudent?.fullName || item.title)}
                    className="inline-flex rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-50"
                  >
                    Open payment pause tool
                  </button>
                ) : (
                  <a
                    href={paymentPausePrefillUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-950 hover:bg-violet-50"
                  >
                    Open payment pause tool
                  </a>
                )
              ) : (
                <span className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900">
                  Add structured pause dates to prefill the pause tool
                </span>
              )}
              {isPauseReminder ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <button
                    type="button"
                    onClick={() => setRepairOpen((current) => !current)}
                    className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                  >
                    {repairOpen
                      ? 'Hide dates'
                      : (paymentPausePrefillUrl ? 'Edit dates' : 'Add dates to this plan')}
                  </button>

                  {repairOpen ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <SelectField
                          label="Pause type"
                          value={repairPauseType}
                          onChange={(value) => setRepairOptions((current) => ({ ...current, pauseType: value }))}
                          options={[
                            { value: 'single', label: 'One lesson' },
                            { value: 'range', label: 'Away period' },
                          ]}
                        />
                        <StudentSearchField
                          label="Student"
                          value={repairOptions.linkedStudentId}
                          onChange={(value) => setRepairOptions((current) => ({ ...current, linkedStudentId: value }))}
                          studentOptions={studentOptions}
                        />
                      </div>

                      {repairStudent?.scheduleContext?.status === 'found' && repairDateSuggestions.length ? (
                        <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Suggested lesson dates</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {repairDateSuggestions.map((suggestion) => (
                              <div key={suggestion.date} className="rounded-lg border border-violet-100 bg-white p-2">
                                <p className="text-sm font-semibold text-slate-900">{suggestion.lessonLabel}</p>
                                {repairPauseType === 'single' ? (
                                  <button
                                    type="button"
                                    onClick={() => setRepairOptions((current) => ({ ...current, pauseLessonDate: suggestion.date }))}
                                    className="mt-2 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                                  >
                                    Use this lesson
                                  </button>
                                ) : (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setRepairOptions((current) => ({ ...current, pauseFirstPauseDate: suggestion.date }))}
                                      className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                                    >
                                      First missed
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRepairOptions((current) => ({ ...current, pauseReturnDate: suggestion.date }))}
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
                      ) : repairOptions.linkedStudentId ? (
                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                          <p className="text-sm font-semibold text-amber-950">No cached schedule for this student yet.</p>
                          <p className="mt-1 text-xs leading-5 text-amber-800">
                            Refresh from MMS to pull the usual lesson slot into `Schedule_Context`, then the suggested pause dates should appear here.
                          </p>
                          <button
                            type="button"
                            onClick={refreshRepairSchedule}
                            disabled={scheduleRefreshState.pendingId === repairOptions.linkedStudentId}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {scheduleRefreshState.pendingId === repairOptions.linkedStudentId ? (
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

                      {repairPauseType === 'single' ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <DateField
                            label="Lesson to pause"
                            value={repairOptions.pauseLessonDate || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseLessonDate: value }))}
                          />
                          <TextField
                            label="Extra note"
                            value={repairOptions.pauseExtraNote || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseExtraNote: value }))}
                            placeholder="Optional reason or context"
                          />
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-3">
                          <DateField
                            label="First lesson missed"
                            value={repairOptions.pauseFirstPauseDate || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseFirstPauseDate: value }))}
                          />
                          <DateField
                            label="Returning from"
                            value={repairOptions.pauseReturnDate || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseReturnDate: value }))}
                          />
                          <TextField
                            label="Extra note"
                            value={repairOptions.pauseExtraNote || ''}
                            onChange={(value) => setRepairOptions((current) => ({ ...current, pauseExtraNote: value }))}
                            placeholder="Summer holiday, illness, etc."
                          />
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                        {repairDraft.isComplete ? (
                          <>
                            <p className="font-semibold text-slate-900">{repairDraft.title}</p>
                            <p className="mt-1 whitespace-pre-line">{repairDraft.notes}</p>
                            {repairDraft.targetDate ? (
                              <p className="mt-2 text-xs font-semibold text-amber-800">Do by {formatTargetDate(repairDraft.targetDate)}</p>
                            ) : null}
                          </>
                        ) : (
                          <p>Add {repairDraft.missingFields.join(' and ')} to repair this pause plan.</p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isPending || !repairDraft.isComplete}
                        onClick={() => onRepairPauseDetails(item, {
                          draft: repairDraft,
                          linkedStudentId: repairOptions.linkedStudentId,
                        })}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save structured dates
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {pauseConfirmationMessage ? (
                <div className="rounded-lg border border-amber-100 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Parent message</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{pauseConfirmationMessage}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pauseConfirmationMessage);
                        setCopyState('Copied');
                        logCommunicationCopy({
                          category: 'pause',
                          mmsId: item.linkedStudentId,
                          studentName: linkedStudent?.fullName || '',
                          body: pauseConfirmationMessage,
                          source: 'pause_card',
                        });
                      } catch (error) {
                        setCopyState('Copy failed');
                      }
                    }}
                    className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Copy message
                  </button>
                  {copyState ? <span className="ml-2 text-xs font-semibold text-amber-800">{copyState}</span> : null}
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm font-medium text-amber-950">
                  <input
                    type="checkbox"
                    checked={pauseToolRan || pauseExpectationAlreadySet}
                    disabled={isPending || pauseExpectationAlreadySet}
                    onChange={(event) => setPauseToolRan(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-300 text-slate-900"
                  />
                  <span>
                    Payment pause tool has been run
                    {pauseExpectationAlreadySet ? (
                      <span className="block text-xs font-normal text-amber-800">Payment expectation is already paused expected.</span>
                    ) : null}
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm font-medium text-amber-950">
                  <input
                    type="checkbox"
                    checked={pauseMessageConfirmed || pausePaymentConfirmed}
                    disabled={isPending || pausePaymentConfirmed}
                    onChange={(event) => setPauseMessageConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-300 text-slate-900"
                  />
                  <span>
                    Parent confirmation message sent
                    {pausePaymentConfirmed ? (
                      <span className="block text-xs font-normal text-amber-800">Already logged on this planning item.</span>
                    ) : null}
                  </span>
                </label>
              </div>
              <button
                type="button"
                disabled={isPending || !canCompletePause}
                onClick={() => onPauseCompleted(item)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-950 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? 'Completing…' : 'Mark pause completed'}
              </button>
              <p className="text-xs leading-5 text-amber-800">
                Logs the confirmation and sets paused-expected if needed — doesn&apos;t run Stripe directly.
              </p>
              {!item.linkedStudentId ? (
                <p className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900">
                  Save structured dates with a linked student before completing this pause.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {isPauseReminder ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-semibold text-slate-700">Details</summary>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{item.owner}</span>
              <span>·</span>
              <span>{item.areaLabel}</span>
              <span>·</span>
              <span>Updated {formatDateTime(item.updatedAt || item.createdAt)}</span>
            </div>
            {item.nextAction ? (
              <p><span className="font-semibold text-slate-700">Next action: </span>{item.nextAction}</p>
            ) : null}
            {item.notes ? <p className="leading-6">{shortPreview(item.notes)}</p> : null}
            {linkFacts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {linkFacts.map((fact) => (
                  <LinkPill key={fact.label} label={fact.label} href={fact.href} />
                ))}
              </div>
            ) : null}
            {item.latestProgress ? (
              <div className="border-l-2 border-slate-200 pl-3">
                <p className="font-semibold text-slate-800">Latest progress</p>
                <ExpandableText text={item.latestProgress.progressNote} className="mt-1" />
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.latestProgress.createdAt)}</p>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <form
        className={`mt-4 grid gap-2 ${isSchoolForwardReview ? 'md:grid-cols-[1fr_auto]' : 'md:grid-cols-[1fr_1fr_auto]'}`}
        onSubmit={(event) => {
          event.preventDefault();
          onProgress(item, { progressNote, nextAction });
          setProgressNote('');
        }}
      >
        {isSchoolForwardReview ? (
          <div className="space-y-2">
            <textarea
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
              placeholder={`What moved forward:\n-\n\nUseful decisions:\n-\n\nWhat felt stuck:\n-\n\nWhat we learned:\n-\n\nNext improvement to make time for:\n-`}
              rows={4}
              className="min-h-28 w-full rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-500"
            />
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="Next improvement to make time for"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
            <p className="text-xs leading-5 text-slate-500">
              Saved as dated progress history for later monthly or quarterly summaries.
            </p>
          </div>
        ) : (
          <>
            <input
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
              placeholder="Add progress note"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="Update next action"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </>
        )}
        <button
          type="submit"
          disabled={isPending || !progressNote.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isSchoolForwardReview ? 'Add Friday reflection' : 'Add note'}
        </button>
      </form>
    </article>
  );
}
