'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  SCHOOL_FORWARD_PLANNING_ID,
  MONDAY_SCHEDULE_PLANNING_ID,
  labelPlanningStatus,
  parseLinkedStudentIds,
} from '@/lib/admin/planning-helpers.mjs';
import {
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
import { ExpandableText, LinkPill } from './fields';
import PauseDatesEditor from './PauseDatesEditor';

// The per-planning-item card: status actions, progress logging, link facts, and — for
// pause items — the full pause toolkit (open the pause tool, copy the parent message,
// the "Edit dates" repair builder, and the two-checkbox "Mark pause completed" gate).
// Pure props in (item + studentOptions + handlers); also used inside DueTodayCard.
export default function PlanningCard({ item, studentOptions = [], paymentExpectationOverrides = {}, onStatus, onArchive, onEdit, onProgress, onPauseCompleted, onRepairPauseDetails, onOpenPauseTool, onOpenWorkflowPanel, onCreateLinkedAction, pendingId, compact = false, nearbyPause = null }) {
  const [progressNote, setProgressNote] = useState('');
  const [nextAction, setNextAction] = useState(item.nextAction || '');
  const [nextSessionDate, setNextSessionDate] = useState('');
  const [pauseToolRan, setPauseToolRan] = useState(false);
  const [pauseMessageConfirmed, setPauseMessageConfirmed] = useState(false);
  const [copyState, setCopyState] = useState('');
  const isPending = pendingId === item.planningId;
  const isPauseReminder = isPausePlanningItem(item);
  const isSchoolNote = isSchoolNotePlanningItem(item);
  const isSchoolForwardReview = item.planningId === SCHOOL_FORWARD_PLANNING_ID;
  // Ongoing plans are worked across sessions: log what you did + set the next
  // meeting day in one step. (School-forward review keeps its own reflection UI.)
  const isOngoing = item.planMode === 'ongoing' && !isSchoolForwardReview;
  const isSystemPlanningItem = item.planningId === SCHOOL_FORWARD_PLANNING_ID || item.planningId === MONDAY_SCHEDULE_PLANNING_ID;
  const pausePaymentConfirmed = hasPausePaymentConfirmation(item);
  const isTutorAbsenceCard = item.linkedWorkflowId === 'tutor-absence' && Boolean(item.linkedTutorId);
  const linkedWorkflowHref = isTutorAbsenceCard
    ? buildTutorAbsenceWorkflowHref(item)
    : workflowHref(item.linkedWorkflowId);
  const linkedStudent = findStudentById(studentOptions, item.linkedStudentId) || null;
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
                {item.planMode === 'ongoing' ? (
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    Ongoing
                  </span>
                ) : null}
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
                <PauseDatesEditor
                  item={item}
                  studentOptions={studentOptions}
                  isPending={isPending}
                  onSave={onRepairPauseDetails}
                  hasPrefillUrl={Boolean(paymentPausePrefillUrl)}
                />
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
        className={`mt-4 grid gap-2 ${isSchoolForwardReview ? 'md:grid-cols-[1fr_auto]' : isOngoing ? 'md:grid-cols-[1fr_auto_auto]' : 'md:grid-cols-[1fr_1fr_auto]'}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (isOngoing) {
            onProgress(item, {
              progressNote,
              targetDate: nextSessionDate || undefined,
              progressType: 'session_logged',
              status: 'active',
            });
            setProgressNote('');
            setNextSessionDate('');
          } else {
            onProgress(item, { progressNote, nextAction });
            setProgressNote('');
          }
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
        ) : isOngoing ? (
          <>
            <input
              value={progressNote}
              onChange={(event) => setProgressNote(event.target.value)}
              placeholder="What did you do this session?"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
            <input
              type="date"
              value={nextSessionDate}
              onChange={(event) => setNextSessionDate(event.target.value)}
              title="Next session / meeting day"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
            />
          </>
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
          {isSchoolForwardReview ? 'Add Friday reflection' : isOngoing ? 'Log session & set next date' : 'Add note'}
        </button>
      </form>
    </article>
  );
}
