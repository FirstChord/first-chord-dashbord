'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Archive, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import {
  SCHOOL_FORWARD_PLANNING_ID,
  MONDAY_SCHEDULE_PLANNING_ID,
  labelPlanningStatus,
  parseLinkedStudentIds,
} from '@/lib/admin/planning-helpers.mjs';
import {
  isPausePlanningItem,
  isTutorAbsenceCapturePlanningItem,
  isTutorAbsenceNoticePlanningItem,
  extractTutorAbsenceNoticeMessage,
  isTutorAbsenceFinalConfirmationPlanningItem,
  extractTutorAbsenceFinalConfirmationMessage,
  isSchoolNotePlanningItem,
  hasPausePaymentConfirmation,
  requiresTutorAbsencePaymentTool,
  buildTutorAbsenceWorkflowHref,
  workflowHref,
  findStudentById,
  buildPaymentPausePrefillUrl,
  buildPauseConfirmationMessage,
  extractIncomingPlanningReply,
  momentumClasses,
  formatTargetDate,
  formatDateTime,
  shortPreview,
  studentHref,
} from '@/lib/admin/planning-client-helpers.mjs';
import { buildWhatsappShareUrl } from '@/lib/admin/incoming-message-helpers.mjs';
import { logCommunicationCopy } from '@/lib/admin/log-communication-copy.js';
import { ExpandableText, LinkPill } from './fields';
import { CardButton, CardNotice, MessageToSend, StepLabel } from './CardBlocks';
import PauseDatesEditor from './PauseDatesEditor';

// The per-planning-item card: status actions, progress logging, link facts, and — for
// pause items — the full pause toolkit (open the pause tool, copy the parent message,
// the "Edit dates" repair builder, and the two-checkbox "Mark pause completed" gate).
// Pure props in (item + studentOptions + handlers); also used inside DueTodayCard.
export default function PlanningCard({ item, studentOptions = [], paymentExpectationOverrides = {}, onStatus, onArchive, onEdit, onProgress, onPauseCompleted, onRepairPauseDetails, onOpenPauseTool, onCreateLinkedAction, onTutorAbsenceDecision, onTutorAbsenceNoticeSent, onTutorAbsenceFinalConfirmationSent, pendingId, compact = false, nearbyPause = null, sortedEntry = null }) {
  const [progressNote, setProgressNote] = useState('');
  // Starts empty on purpose. The card already states the current next action
  // above; pre-filling the input printed the same sentence twice and made an
  // edit box look like a read-out. Blank means "leave it as it is" — see the
  // submit handler.
  const [nextAction, setNextAction] = useState('');
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
  const isTutorAbsenceCapture = isTutorAbsenceCapturePlanningItem(item);
  const isTutorAbsenceNotice = isTutorAbsenceNoticePlanningItem(item);
  const tutorAbsenceNoticeMessage = isTutorAbsenceNotice ? extractTutorAbsenceNoticeMessage(item) : '';
  const isTutorAbsenceFinalConfirmation = isTutorAbsenceFinalConfirmationPlanningItem(item);
  const tutorAbsenceFinalMessage = isTutorAbsenceFinalConfirmation ? extractTutorAbsenceFinalConfirmationMessage(item) : '';
  const tutorAbsenceDecision = `${item.notes || ''}`.match(/^Tutor absence decision:\s*(cancel_day|cover)$/mu)?.[1] || '';
  const linkedWorkflowHref = isTutorAbsenceCard
    ? buildTutorAbsenceWorkflowHref(item)
    : workflowHref(item.linkedWorkflowId);
  const linkedStudent = findStudentById(studentOptions, item.linkedStudentId) || null;
  const linkedStudentPaymentExpectation = paymentExpectationOverrides[item.linkedStudentId] || linkedStudent?.paymentExpectation || '';
  const pauseExpectationAlreadySet = linkedStudentPaymentExpectation === 'stripe_paused_expected';
  const requiresExplicitTutorAbsenceTool = requiresTutorAbsencePaymentTool(item);
  const pauseToolStepComplete = Boolean(
    pauseToolRan
    || (pauseExpectationAlreadySet && !requiresExplicitTutorAbsenceTool)
  );
  const paymentPausePrefillUrl = isPauseReminder
    ? buildPaymentPausePrefillUrl({ item, student: linkedStudent })
    : '';
  const incomingPlanningReply = extractIncomingPlanningReply(item);
  const pauseConfirmationMessage = isPauseReminder
    ? (incomingPlanningReply || buildPauseConfirmationMessage({ item, student: linkedStudent }))
    : '';
  const canCompletePause = Boolean(
    item.linkedStudentId
    && paymentPausePrefillUrl
    && pauseToolStepComplete
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

  async function copyParentReply(body, { category = 'parent', source = 'planning_card', openWhatsApp = false } = {}) {
    try {
      await navigator.clipboard.writeText(body);
      setCopyState('Copied');
      logCommunicationCopy({
        category,
        mmsId: item.linkedStudentId,
        studentName: linkedStudent?.fullName || '',
        body,
        source,
      });
      if (openWhatsApp) window.location.assign(buildWhatsappShareUrl(body));
    } catch {
      setCopyState('Copy failed');
    }
  }

  // The completion beat: the same "sorted ✓" language, colour and timing the
  // issues queue uses. Only shown once every write has landed, so the tick means
  // "this is done", never "this was sent".
  if (sortedEntry) {
    return (
      <article
        className={`rounded-2xl border border-emerald-200 bg-emerald-50 transition-opacity duration-700 ${compact ? 'p-4' : 'p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]'}`}
        style={sortedEntry.fading ? { opacity: 0 } : undefined}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg text-emerald-600" aria-hidden>✓</span>
          <div>
            <p className="text-base font-semibold text-emerald-900">
              {linkedStudent?.fullName || item.title} — sorted
            </p>
            <p className="mt-1 text-sm text-emerald-800">{sortedEntry.message}</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={compact ? '' : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]'}>
      {/* An already-paused student still gets a card on purpose: the payment
          expectation flag carries no dates, so it cannot prove *this* window is
          covered. That is easy to misread as a duplicate, so say it up front
          rather than only next to the payment tool further down. */}
      {isPauseReminder && pauseExpectationAlreadySet ? (
        <CardNotice tone="warning">
          <span className="font-semibold">Already marked paused expected.</span>
          {' '}That flag has no dates on it, so it does not prove these lesson dates are covered — check the payment tool before running it again.
        </CardNotice>
      ) : null}
      {nearbyPause ? (
        <CardNotice tone="info">
          This student also has a pause around {formatTargetDate(nearbyPause.otherStart)}
          {nearbyPause.otherEnd && nearbyPause.otherEnd !== nearbyPause.otherStart ? `–${formatTargetDate(nearbyPause.otherEnd)}` : ''}.
          {' '}If they join up, you might be doing one longer break — worth a glance before you pause.
        </CardNotice>
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
                className={`inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${isTutorAbsenceNotice ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-red-100 text-red-700 hover:bg-red-50'}`}
              >
                {isTutorAbsenceNotice ? <Archive className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                {isTutorAbsenceNotice ? 'Park notice' : 'Remove'}
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

      {item.nextAction && (
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

      {incomingPlanningReply && !isPauseReminder ? (
        <MessageToSend
          label="Parent reply"
          message={incomingPlanningReply}
          actions={(
            <>
              <CardButton onClick={() => copyParentReply(incomingPlanningReply, {
                source: 'incoming_planning_reply',
                openWhatsApp: true,
              })}
              >
                Copy &amp; open WhatsApp
              </CardButton>
              {copyState ? <span className="text-xs font-semibold text-slate-600">{copyState}</span> : null}
            </>
          )}
        />
      ) : null}

      {/* Tutor-absence cards deliberately have no workflow link: the decision and
          its follow-through both live on this card, so a second door to a
          separate workflow screen only asked "which one is the real one?" */}
      {linkedWorkflowHref && !isPauseReminder && !isTutorAbsenceCard ? (
        <Link
          href={linkedWorkflowHref}
          className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white"
        >
          Open linked workflow
        </Link>
      ) : null}

      {isTutorAbsenceCapture && !tutorAbsenceDecision ? (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <p className="text-sm font-semibold text-slate-900">How is this teaching day handled?</p>
          <p className="mt-1 text-xs leading-5 text-slate-700">
            Cancel creates or updates the grouped student pause cards. Cover keeps this date in the short cover checklist.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => onTutorAbsenceDecision?.(item, 'cancel_day')}
              className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel lessons → pause cards
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onTutorAbsenceDecision?.(item, 'cover')}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cover lessons
            </button>
          </div>
        </div>
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
              disabled={isPending || item.status === status || (status === 'done' && (isTutorAbsenceCapture || isTutorAbsenceNotice || isTutorAbsenceFinalConfirmation || (isPauseReminder && !pausePaymentConfirmed)))}
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
              {/* The numbered steps already say "this one, then that one", so the
                  sentence that used to repeat it here was teaching what the
                  structure shows. The Stripe boundary is NOT stated here: it
                  belongs to the completion button, because step 1's payment tool
                  is precisely the thing that does write to Stripe. */}
              <p className="text-sm font-semibold text-amber-950">Complete this pause</p>
              <StepLabel done={pauseToolStepComplete}>1. Payment action</StepLabel>
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
              {pauseConfirmationMessage && pauseToolStepComplete ? (
                <MessageToSend
                  label={<StepLabel done={pauseMessageConfirmed || pausePaymentConfirmed}>2. Parent confirmation</StepLabel>}
                  message={pauseConfirmationMessage}
                  actions={(
                    <>
                      <CardButton onClick={() => copyParentReply(pauseConfirmationMessage, {
                        category: 'pause',
                        source: incomingPlanningReply ? 'incoming_planning_reply' : 'pause_card',
                        openWhatsApp: Boolean(incomingPlanningReply),
                      })}
                      >
                        {incomingPlanningReply ? 'Copy & open WhatsApp' : 'Copy message'}
                      </CardButton>
                      {copyState ? <span className="text-xs font-semibold text-slate-600">{copyState}</span> : null}
                    </>
                  )}
                />
              ) : pauseConfirmationMessage ? (
                <p className="rounded-lg border border-amber-200 bg-amber-100/60 px-3 py-2 text-xs font-medium leading-5 text-amber-900">
                  The final parent message unlocks after you confirm the payment tool has been run.
                </p>
              ) : null}
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm font-medium text-amber-950">
                  <input
                    type="checkbox"
                    checked={pauseToolStepComplete}
                    disabled={isPending || (pauseExpectationAlreadySet && !requiresExplicitTutorAbsenceTool)}
                    onChange={(event) => setPauseToolRan(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-300 text-slate-900"
                  />
                  <span>
                    Payment pause tool has been run
                    {pauseExpectationAlreadySet && !requiresExplicitTutorAbsenceTool ? (
                      <span className="block text-xs font-normal text-amber-800">Payment expectation is already paused expected.</span>
                    ) : null}
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm font-medium text-amber-950">
                  <input
                    type="checkbox"
                    checked={pauseMessageConfirmed || pausePaymentConfirmed}
                    disabled={isPending || pausePaymentConfirmed || !pauseToolStepComplete}
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
                This button only logs the confirmation and sets paused-expected — the Stripe change itself happens in the step 1 payment tool.
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

      {isTutorAbsenceNotice ? (
        <MessageToSend
          label="Initial absence notice"
          guidance="Send this early notice now. The final payment confirmation remains on the linked pause card closer to the missed lesson."
          message={tutorAbsenceNoticeMessage}
          actions={(
            <>
              <CardButton onClick={() => copyParentReply(tutorAbsenceNoticeMessage, {
                category: 'tutor_absence_notice',
                source: 'tutor_absence_early_notice',
              })}
              >
                Copy early notice
              </CardButton>
              <CardButton
                variant="primary"
                disabled={isPending}
                onClick={() => onTutorAbsenceNoticeSent?.(item)}
              >
                Mark sent &amp; complete
              </CardButton>
              {copyState ? <span className="text-xs font-semibold text-slate-600">{copyState}</span> : null}
            </>
          )}
        />
      ) : null}

      {isTutorAbsenceFinalConfirmation ? (
        <MessageToSend
          label="Final payment outcome confirmation"
          guidance="No payment-tool action is needed here. Send this only after checking the recorded outcome is still correct."
          message={tutorAbsenceFinalMessage}
          actions={(
            <>
              <CardButton onClick={() => copyParentReply(tutorAbsenceFinalMessage, {
                category: 'tutor_absence_final_confirmation',
                source: 'tutor_absence_final_confirmation',
              })}
              >
                Copy final confirmation
              </CardButton>
              <CardButton
                variant="primary"
                disabled={isPending}
                onClick={() => onTutorAbsenceFinalConfirmationSent?.(item)}
              >
                Mark final confirmation sent
              </CardButton>
              {copyState ? <span className="text-xs font-semibold text-slate-600">{copyState}</span> : null}
            </>
          )}
        />
      ) : null}

      {/* Pause cards used to hide all of this behind a "Details" disclosure,
          including the next action and the latest progress — the two things you
          need in order to decide anything. Every other card type shows its next
          action outright, so the pause card was also the odd one out. Disclosure
          now covers only genuine reference: who owns it, its area, when it was
          touched, the notes preview and the links. */}
      {isPauseReminder && item.latestProgress ? (
        <div className="mt-3 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Latest progress</p>
          <ExpandableText text={item.latestProgress.progressNote} className="mt-1" />
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.latestProgress.createdAt)}</p>
        </div>
      ) : null}

      {isPauseReminder ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-semibold text-slate-700">Reference</summary>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{item.owner}</span>
              <span>·</span>
              <span>{item.areaLabel}</span>
              <span>·</span>
              <span>Updated {formatDateTime(item.updatedAt || item.createdAt)}</span>
            </div>
            {item.notes ? <p className="leading-6">{shortPreview(item.notes)}</p> : null}
            {linkFacts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {linkFacts.map((fact) => (
                  <LinkPill key={fact.label} label={fact.label} href={fact.href} />
                ))}
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
            onProgress(item, { progressNote, nextAction: nextAction.trim() ? nextAction : undefined });
            setProgressNote('');
            setNextAction('');
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
