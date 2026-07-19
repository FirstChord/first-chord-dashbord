'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  assessBridgeHealth,
  extractIncomingMessageDates,
  INCOMING_MESSAGE_CATEGORIES,
  isAutoArchivedMessage,
  isIncomingPlaceholderText,
  isOneTapConvertEligible,
  labelIncomingCategory,
  labelIncomingResolutionType,
  labelIncomingStatus,
} from '@/lib/admin/incoming-message-helpers.mjs';
import { formatFriendlyDate } from '@/lib/admin/incoming-date-helpers.mjs';

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusTone(status) {
  if (status === 'converted') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'ignored') return 'border-slate-200 bg-slate-100 text-slate-600';
  if (status === 'needs_review') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-blue-200 bg-blue-50 text-blue-800';
}

function confidenceTone(confidence) {
  if (confidence === 'high') return 'bg-emerald-50 text-emerald-800';
  if (confidence === 'medium') return 'bg-blue-50 text-blue-800';
  if (confidence === 'low') return 'bg-amber-50 text-amber-800';
  return 'bg-slate-100 text-slate-600';
}

const ABSENCE_CATEGORIES = new Set(['one_off_absence', 'extended_absence', 'summer_break', 'absence_pause']);

function isWhatsappGroup(chatId = '') {
  return `${chatId || ''}`.trim().endsWith('@g.us');
}

function GroupRow({ group, studentOptions = [], onReviewGroup, onAddGroupStudent, isPending }) {
  const [selectedMmsId, setSelectedMmsId] = useState(group.matchedMmsId || '');
  const [addMmsId, setAddMmsId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const status = group.status || 'review';

  const additionalIds = `${group.additionalMmsIds || ''}`.split(',').map((id) => id.trim()).filter(Boolean);
  const additionalNames = additionalIds.map((id) => studentOptions.find((s) => s.mmsId === id)?.fullName || id);
  const inGroup = new Set([group.matchedMmsId, ...additionalIds].filter(Boolean));

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{group.chatName || 'Unnamed WhatsApp group'}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${confidenceTone(group.matchConfidence)}`}>
          {status === 'confirmed' ? 'confirmed' : status === 'ignored' ? 'ignored' : (group.matchConfidence || 'unmatched')}
        </span>
      </div>
      <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{group.chatId}</p>
      <p className="mt-1 text-xs text-slate-500">
        {group.matchedStudentName || 'No student hint yet'}
        {additionalNames.length ? ` + ${additionalNames.join(', ')}` : ''}
        {group.instrument ? ` · ${group.instrument}` : ''}
        {group.matchedFcId ? ` · ${group.matchedFcId}` : ''}
        {group.lastMessageAt ? ` · last active ${formatDateTime(group.lastMessageAt)}` : (group.lastSeenAt ? ` · last seen ${formatDateTime(group.lastSeenAt)}` : '')}
      </p>

      {status === 'confirmed' ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowAdd((current) => !current)}
              className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 disabled:opacity-60"
            >
              + Student (sibling)
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onReviewGroup(group.chatId, { status: 'review' })}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-60"
            >
              Re-review
            </button>
          </div>
          {showAdd ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={addMmsId}
                onChange={(event) => setAddMmsId(event.target.value)}
                className="rounded-full border border-blue-100 bg-white px-2.5 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-300"
              >
                <option value="">Add another student…</option>
                {studentOptions.filter((s) => !inGroup.has(s.mmsId)).map((student) => (
                  <option key={student.mmsId} value={student.mmsId}>
                    {student.fullName}{student.instrument ? ` · ${student.instrument}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={isPending || !addMmsId}
                onClick={() => { onAddGroupStudent(group.chatId, addMmsId); setAddMmsId(''); setShowAdd(false); }}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 disabled:opacity-60"
              >
                Add
              </button>
            </div>
          ) : null}
        </div>
      ) : status === 'ignored' ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onReviewGroup(group.chatId, { status: 'review' })}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-60"
          >
            Restore
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={selectedMmsId}
            onChange={(event) => setSelectedMmsId(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-300"
          >
            <option value="">Pick student…</option>
            {studentOptions.map((student) => (
              <option key={student.mmsId} value={student.mmsId}>
                {student.fullName}{student.instrument ? ` · ${student.instrument}` : ''}{student.tutor ? ` · ${student.tutor}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isPending || !selectedMmsId}
            onClick={() => onReviewGroup(group.chatId, { status: 'confirmed', matchedMmsId: selectedMmsId })}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 disabled:opacity-60"
          >
            Confirm
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onReviewGroup(group.chatId, { status: 'ignored' })}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 disabled:opacity-60"
          >
            Not FC
          </button>
        </div>
      )}
    </div>
  );
}

const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 };

function byConfidence(a, b) {
  return (CONFIDENCE_ORDER[a.matchConfidence] ?? 3) - (CONFIDENCE_ORDER[b.matchConfidence] ?? 3);
}

function GroupMapPanel({ groups = [], studentOptions = [], onReviewGroup, onAddGroupStudent, pendingChatId }) {
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  // Matched a current student → review (surfaced, sorted best-match first).
  // Matched nothing → unmatched (old students / non-lesson groups, hidden by default).
  const reviewGroups = groups.filter((group) => (group.status || 'review') === 'review').sort(byConfidence);
  const unmatchedGroups = groups.filter((group) => group.status === 'unmatched').sort(byConfidence);
  const resolvedGroups = groups.filter((group) => ['confirmed', 'ignored'].includes(group.status));

  const renderRow = (group) => (
    <GroupRow
      key={group.chatId}
      group={group}
      studentOptions={studentOptions}
      onReviewGroup={onReviewGroup}
      onAddGroupStudent={onAddGroupStudent}
      isPending={pendingChatId === group.chatId}
    />
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">WhatsApp groups</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {reviewGroups.length} to review
        </span>
      </div>

      {!reviewGroups.length ? (
        <p className="mt-3 text-sm text-slate-500">
          {groups.length ? 'No matched groups need review.' : 'No WhatsApp groups captured yet.'}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {reviewGroups.map(renderRow)}
        </div>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {unmatchedGroups.length ? (
          <button
            type="button"
            onClick={() => setShowUnmatched((current) => !current)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
          >
            {showUnmatched ? 'Hide unmatched' : `Show unmatched (${unmatchedGroups.length})`}
          </button>
        ) : null}
        {resolvedGroups.length ? (
          <button
            type="button"
            onClick={() => setShowResolved((current) => !current)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
          >
            {showResolved ? 'Hide resolved' : `Show confirmed/ignored (${resolvedGroups.length})`}
          </button>
        ) : null}
      </div>

      {showUnmatched && unmatchedGroups.length ? (
        <div className="mt-2">
          <p className="mb-2 text-xs font-semibold text-slate-500">Unmatched — likely old students or non-lesson groups. Pick a student if one belongs here.</p>
          <div className="space-y-2">
            {unmatchedGroups.map(renderRow)}
          </div>
        </div>
      ) : null}

      {showResolved && resolvedGroups.length ? (
        <div className="mt-2 space-y-2">
          {resolvedGroups.map(renderRow)}
        </div>
      ) : null}
    </section>
  );
}

function CorrectionPanel({ entry, studentOptions = [], onCorrect, onConvert, isPending }) {
  const [category, setCategory] = useState(entry.suspectedCategory || 'general');
  const [matchedMmsId, setMatchedMmsId] = useState(entry.matchedMmsId || '');
  const [reviewNote, setReviewNote] = useState('');
  const [confirmGroupMap, setConfirmGroupMap] = useState(isWhatsappGroup(entry.chatId));
  const canConfirmGroup = isWhatsappGroup(entry.chatId) && matchedMmsId;

  function correctionPayload(status = 'needs_review') {
    return {
      category,
      matchedMmsId,
      reviewNote,
      confirmGroupMap,
      status,
    };
  }

  return (
    <details className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-blue-900">Correct interpretation</summary>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1 w-full rounded-full border border-blue-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-300"
            >
              {INCOMING_MESSAGE_CATEGORIES.map((option) => (
                <option key={option} value={option}>{labelIncomingCategory(option)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Matched student</span>
            <select
              value={matchedMmsId}
              onChange={(event) => setMatchedMmsId(event.target.value)}
              className="mt-1 w-full rounded-full border border-blue-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-300"
            >
              <option value="">No student selected</option>
              {studentOptions.map((student) => (
                <option key={student.mmsId} value={student.mmsId}>
                  {student.fullName}{student.fcStudentId ? ` · ${student.fcStudentId}` : ''}{student.parentName ? ` · ${student.parentName}` : ''}{student.tutor ? ` · ${student.tutor}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Reviewer note</span>
          <input
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            className="mt-1 w-full rounded-full border border-blue-100 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-300"
            placeholder="e.g. Clarified: summer break, returning second week after schools restart."
          />
        </label>
        {isWhatsappGroup(entry.chatId) ? (
          <label className="flex items-start gap-2 rounded-xl border border-blue-100 bg-white/75 px-3 py-2 text-xs leading-5 text-slate-600">
            <input
              type="checkbox"
              checked={confirmGroupMap}
              disabled={!matchedMmsId}
              onChange={(event) => setConfirmGroupMap(event.target.checked)}
              className="mt-1"
            />
            <span>
              Confirm this WhatsApp group belongs to the selected student.
              {!matchedMmsId ? ' Select a student first.' : ' Future messages from this group will use that as high-confidence evidence.'}
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending || (confirmGroupMap && !canConfirmGroup)}
            onClick={() => onConvert(entry, correctionPayload('converted'))}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-[0.97] disabled:opacity-60"
          >
            {isPending ? 'Converting…' : 'Convert to plan + draft reply'}
          </button>
          <button
            type="button"
            disabled={isPending || (confirmGroupMap && !canConfirmGroup)}
            onClick={() => onCorrect(entry, correctionPayload('needs_review'))}
            className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm disabled:opacity-60"
          >
            Save correction
          </button>
          <button
            type="button"
            disabled={isPending || (confirmGroupMap && !canConfirmGroup)}
            onClick={() => onCorrect(entry, correctionPayload('converted'))}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm disabled:opacity-60"
          >
            Save + archive
          </button>
        </div>
      </div>
    </details>
  );
}

function ReplyPanel({ conversion }) {
  const [reply, setReply] = useState(conversion.replyTemplate || '');
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fc-slide-in mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-emerald-900">Planning item created — draft reply ready</p>
        {conversion.planningId ? (
          <Link
            href={`/admin/planning?focus=${encodeURIComponent(conversion.planningId)}`}
            className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm"
          >
            Open plan
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-5 text-emerald-800/80">
        Edit if needed, then copy and send it yourself in WhatsApp. Nothing is sent automatically.
      </p>
      <textarea
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        rows={5}
        className="mt-2 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-emerald-300"
      />
      <button
        type="button"
        onClick={handleCopy}
        className="mt-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
      >
        {copied ? 'Copied' : 'Copy reply'}
      </button>
    </div>
  );
}

// The quiet suggested-reply block for an open inbox row: one editable draft,
// one approve button (label flips to "Approve edited" when the text diverges —
// the diff is the telemetry), one discard. Nothing sends; approving copies to
// the clipboard and the server logs it to Communication_Log.
function SuggestedReplyBlock({ entry, proposal, onDecideReply, isPending }) {
  const [text, setText] = useState(proposal.proposalBody || '');
  const edited = text.trim() !== (proposal.proposalBody || '').trim();

  async function handleApprove() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.alert('The reply was not approved because the browser could not copy it. Try again or copy the text manually.');
      return;
    }
    onDecideReply(entry, proposal, edited ? { decision: 'edit', finalBody: text } : { decision: 'use' });
  }

  function handleDiscard() {
    const reason = window.prompt('Discard this suggestion — why? (optional)') ?? '';
    onDecideReply(entry, proposal, { decision: 'discard', rejectionReason: reason });
  }

  return (
    <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/40 px-3 py-3">
      <p className="text-xs font-semibold text-violet-900">Suggested reply</p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        className="mt-2 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-violet-300"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending || !text.trim()}
          onClick={handleApprove}
          className="rounded-full bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-[0.97] disabled:opacity-60"
        >
          {isPending ? 'Saving…' : edited ? 'Approve edited' : 'Use this'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={handleDiscard}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

// Shown when the bridge captured a star without the original text (the message
// predates its cache): paste the message from WhatsApp and it re-classifies.
function PlaceholderFixPanel({ entry, onUpdateText, isPending }) {
  const [text, setText] = useState('');

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-3 py-2">
      <p className="text-xs font-semibold leading-5 text-amber-900">
        WhatsApp only sent the star — the message text is missing. Paste the original message here and it will be classified and matched.
      </p>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-amber-300"
        placeholder="Paste the original WhatsApp message..."
      />
      <button
        type="button"
        disabled={isPending || !text.trim()}
        onClick={() => onUpdateText(entry, text)}
        className="mt-2 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
      >
        Save message text
      </button>
    </div>
  );
}

// "Dates spotted: from Wednesday 24 June · back Monday 21 July" — the same
// extraction the convert action uses, shown up front so the guess can be
// sanity-checked against the message before creating a pause plan.
function describeSpottedDates(entry) {
  const dates = extractIncomingMessageDates(entry);
  const parts = [
    dates.startDate ? `from ${formatFriendlyDate(dates.startDate)}` : '',
    dates.returnDate ? `back ${formatFriendlyDate(dates.returnDate)}` : '',
    dates.durationWeeks ? `${dates.durationWeeks} week${dates.durationWeeks === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  if (!parts.length && dates.dates.length) {
    parts.push(dates.dates.map((iso) => formatFriendlyDate(iso)).join(', '));
  }
  return parts.join(' · ');
}

// One-line bridge health: slate when fine, amber with the reasons when not.
// The heavy diagnostics stay in the bridge's local logs — this is just enough
// to tell "down", "connected but capturing nothing", and "quiet" apart.
function BridgeStatusStrip({ bridgeStatus, inbox = [] }) {
  const lastAutoCaptureAt = inbox
    .filter((entry) => entry.source === 'whatsapp_group_auto')
    .reduce((latest, entry) => ((entry.capturedAt || '') > latest ? entry.capturedAt : latest), '');
  const health = assessBridgeHealth(bridgeStatus, { lastAutoCaptureAt });

  if (health.state === 'none') return null;

  if (health.state === 'warn') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-2 text-xs leading-5 text-amber-900">
        <span className="font-semibold">WhatsApp bridge needs a look:</span> {health.problems.join(' · ')}
      </div>
    );
  }

  return (
    <p
      className="flex items-center px-1"
      title={`Bridge connected · ${bridgeStatus.confirmedGroups} groups on the capture list · heartbeat ${formatDateTime(bridgeStatus.lastHeartbeatAt)}${lastAutoCaptureAt ? ` · last capture ${formatDateTime(lastAutoCaptureAt)}` : ''}`}
    >
      <span aria-label="WhatsApp bridge connected" className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span>
    </p>
  );
}

function MessageCard({ entry, studentOptions, onReview, onDelete, onCorrect, onConvert, onUpdateText, conversion, pendingId, replyProposal, decidedReply, replyDraftingAvailable, onDraftReply, onDecideReply }) {
  const isPending = pendingId === entry.incomingId;
  const spottedDates = describeSpottedDates(entry);
  const isOpen = ['inbox', 'needs_review'].includes(entry.status);
  const canDraftReply = replyDraftingAvailable
    && isOpen
    && !replyProposal
    && !decidedReply
    && !isIncomingPlaceholderText(entry.messageText);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {labelIncomingCategory(entry.suspectedCategory)}
        </span>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(entry.status)}`}>
          {labelIncomingStatus(entry.status)}
        </span>
        {entry.resolutionType ? (
          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            {labelIncomingResolutionType(entry.resolutionType)}
          </span>
        ) : null}
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${confidenceTone(entry.matchConfidence)}`}>
          Match: {entry.matchConfidence || 'none'}
        </span>
        <span className="text-xs text-slate-400">{formatDateTime(entry.messageAt || entry.capturedAt)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {entry.matchedMmsId ? (
              <Link href={`/admin/students/${encodeURIComponent(entry.matchedMmsId)}`} className="hover:text-blue-700">
                {entry.matchedStudentName || entry.matchedMmsId}
              </Link>
            ) : (
              entry.matchedStudentName || 'No student matched yet'
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {entry.senderName || 'Unknown sender'}
            {entry.senderPhone ? ` · ${entry.senderPhone}` : ''}
            {entry.chatName ? ` · ${entry.chatName}` : ''}
          </p>
        </div>
        <p className="text-xs text-slate-400">{entry.source || 'manual'}</p>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{entry.messageText}</p>

      {spottedDates ? (
        <p className="mt-2 text-xs font-semibold text-blue-800">Dates spotted: {spottedDates}</p>
      ) : null}

      {isIncomingPlaceholderText(entry.messageText) ? (
        <PlaceholderFixPanel entry={entry} onUpdateText={onUpdateText} isPending={isPending} />
      ) : null}

      {entry.matchReasons ? (
        <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          {entry.matchReasons}
        </p>
      ) : null}

      {entry.reviewNote ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">Review note: {entry.reviewNote}</p>
      ) : null}

      {entry.schoolRepliedAt ? (
        <p className="mt-2 text-xs font-semibold text-emerald-700">
          ✓ Replied in WhatsApp{entry.schoolRepliedBy && entry.schoolRepliedBy !== 'me' ? ` by ${entry.schoolRepliedBy}` : ''} · {formatDateTime(entry.schoolRepliedAt)}
        </p>
      ) : null}

      {entry.reviewedBy || entry.reviewedAt ? (
        <p className="mt-1 text-[11px] text-slate-400">
          Last actioned{entry.reviewedBy ? ` by ${entry.reviewedBy}` : ''}{entry.reviewedAt ? ` · ${formatDateTime(entry.reviewedAt)}` : ''}
        </p>
      ) : null}

      {replyProposal ? (
        <SuggestedReplyBlock
          entry={entry}
          proposal={replyProposal}
          onDecideReply={onDecideReply}
          isPending={isPending}
        />
      ) : null}

      {decidedReply?.status === 'approved' ? (
        <p className="mt-3 text-xs font-semibold text-violet-800">
          ✓ Reply copied — send it in WhatsApp. It's in the communication log.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canDraftReply ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onDraftReply(entry)}
            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 disabled:opacity-60"
          >
            {isPending ? 'Drafting…' : 'Draft reply'}
          </button>
        ) : null}
        {entry.createdPlanningId && !conversion ? (
          <Link
            href={`/admin/planning?focus=${encodeURIComponent(entry.createdPlanningId)}`}
            className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm"
          >
            Open plan
          </Link>
        ) : null}
        {isOneTapConvertEligible(entry) && !conversion ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onConvert(entry, { category: '', matchedMmsId: '', reviewNote: '', confirmGroupMap: false })}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition active:scale-[0.97] disabled:opacity-60"
          >
            {isPending ? 'Converting…' : 'Convert to plan + draft reply'}
          </button>
        ) : null}
        <button
          type="button"
          disabled={isPending}
          onClick={() => onReview(entry.incomingId, 'converted')}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-60"
        >
          Archive handled
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onReview(entry.incomingId, 'ignored')}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60"
        >
          Ignore
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onDelete(entry)}
          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
        >
          Delete test
        </button>
      </div>

      <CorrectionPanel
        entry={entry}
        studentOptions={studentOptions}
        isPending={isPending}
        onCorrect={onCorrect}
        onConvert={onConvert}
      />

      {conversion ? <ReplyPanel conversion={conversion} /> : null}
    </article>
  );
}

export default function AdminIncomingMessagesPageClient({ initialInbox = [], initialGroupMap = [], studentOptions = [], bridgeStatus = null, error = '', initialReplyProposals = {}, replyDraftingAvailable = false }) {
  const [inbox, setInbox] = useState(initialInbox);
  const [groupMap, setGroupMap] = useState(initialGroupMap);
  const [replyProposals, setReplyProposals] = useState(initialReplyProposals);
  const [decidedReplies, setDecidedReplies] = useState({});
  const [messageText, setMessageText] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [chatName, setChatName] = useState('');
  const [status, setStatus] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [pendingChatId, setPendingChatId] = useState('');
  const [submitError, setSubmitError] = useState(error);
  const [showArchived, setShowArchived] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [conversions, setConversions] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fresh data whenever the (installed) app is opened or the tab regains
  // focus, plus the manual refresh button
  async function refreshInbox() {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/admin/incoming-messages');
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setInbox(data.inbox || []);
        if (Array.isArray(data.groupMap)) setGroupMap(data.groupMap);
      }
      if (replyDraftingAvailable) {
        const proposalsResponse = await fetch('/api/admin/incoming-messages/reply-proposals');
        const proposalsData = await proposalsResponse.json().catch(() => ({}));
        if (proposalsResponse.ok && proposalsData.success) {
          setReplyProposals(proposalsData.openByIncomingId || {});
        }
      }
    } catch {} finally {
      setIsRefreshing(false);
    }
  }

  async function handleDraftReply(entry) {
    setSubmitError('');
    setPendingId(entry.incomingId);
    try {
      const response = await fetch('/api/admin/incoming-messages/reply-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'draft', incomingId: entry.incomingId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Reply drafting failed');
      }
      setReplyProposals((current) => ({ ...current, [entry.incomingId]: data.proposal }));
      return true;
    } catch (caught) {
      setSubmitError(caught.message || 'Reply drafting failed');
      return false;
    } finally {
      setPendingId('');
    }
  }

  async function handleDecideReply(entry, proposal, { decision, finalBody = '', rejectionReason = '' }) {
    setSubmitError('');
    setPendingId(entry.incomingId);
    try {
      const response = await fetch('/api/admin/incoming-messages/reply-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'decide', proposalId: proposal.proposalId, decision, finalBody, rejectionReason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Proposal decision failed');
      }
      setReplyProposals((current) => {
        const next = { ...current };
        delete next[entry.incomingId];
        return next;
      });
      if (data.proposal?.status === 'approved') {
        setDecidedReplies((current) => ({ ...current, [entry.incomingId]: { status: 'approved' } }));
      }
    } catch (caught) {
      setSubmitError(caught.message || 'Proposal decision failed');
    } finally {
      setPendingId('');
    }
  }

  // Sequential on purpose: one model call at a time, and the server's
  // per-admin rate limit (10/min) is the natural stop.
  async function handleDraftAllOpen() {
    const eligible = inbox.filter((entry) => ['inbox', 'needs_review'].includes(entry.status)
      && !replyProposals[entry.incomingId]
      && !decidedReplies[entry.incomingId]
      && !isIncomingPlaceholderText(entry.messageText));
    for (const entry of eligible) {
      const ok = await handleDraftReply(entry);
      if (!ok) break;
    }
  }

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refreshInbox();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);

  const openCount = useMemo(() => inbox.filter((entry) => ['inbox', 'needs_review'].includes(entry.status)).length, [inbox]);
  const absenceCount = useMemo(() => inbox.filter((entry) => ABSENCE_CATEGORIES.has(entry.suspectedCategory) && ['inbox', 'needs_review'].includes(entry.status)).length, [inbox]);
  const archivedCount = useMemo(() => inbox.filter((entry) => ['converted', 'ignored'].includes(entry.status)).length, [inbox]);
  const autoArchivedCount = useMemo(() => inbox.filter(isAutoArchivedMessage).length, [inbox]);
  const visibleInbox = useMemo(() => {
    if (showArchived) return inbox;
    return inbox.filter((entry) => ['inbox', 'needs_review'].includes(entry.status) || conversions[entry.incomingId]);
  }, [inbox, showArchived, conversions]);

  async function postPayload(payload) {
    const response = await fetch('/api/admin/incoming-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Incoming message save failed');
    }
    setInbox(data.inbox || []);
    if (Array.isArray(data.groupMap)) {
      setGroupMap(data.groupMap);
    }
    return data;
  }

  async function handleCapture(event) {
    event.preventDefault();
    setSubmitError('');
    setStatus('Saving…');
    try {
      await postPayload({
        message: {
          source: 'manual_paste',
          senderName,
          senderPhone,
          chatName,
          messageText,
        },
      });
      setMessageText('');
      setSenderName('');
      setSenderPhone('');
      setChatName('');
      setStatus('Saved');
    } catch (caught) {
      setSubmitError(caught.message || 'Incoming message save failed');
      setStatus('');
    }
  }

  async function handleReview(incomingId, nextStatus) {
    setSubmitError('');
    setPendingId(incomingId);
    try {
      await postPayload({
        mode: 'review',
        incomingId,
        status: nextStatus,
      });
    } catch (caught) {
      setSubmitError(caught.message || 'Review update failed');
    } finally {
      setPendingId('');
    }
  }

  async function handleDelete(entry) {
    const label = entry.matchedStudentName || entry.senderName || entry.messageText?.slice(0, 40) || 'this message';
    const confirmed = window.confirm(`Delete ${label} from the incoming message inbox? This is intended for test/noise rows.`);
    if (!confirmed) return;

    setSubmitError('');
    setPendingId(entry.incomingId);
    try {
      await postPayload({
        mode: 'delete',
        incomingId: entry.incomingId,
      });
    } catch (caught) {
      setSubmitError(caught.message || 'Delete failed');
    } finally {
      setPendingId('');
    }
  }

  async function handleCorrect(entry, correction) {
    setSubmitError('');
    setPendingId(entry.incomingId);
    try {
      await postPayload({
        mode: 'correct',
        incomingId: entry.incomingId,
        ...correction,
      });
    } catch (caught) {
      setSubmitError(caught.message || 'Correction failed');
    } finally {
      setPendingId('');
    }
  }

  async function handleReviewGroup(chatId, { matchedMmsId = '', status }) {
    setSubmitError('');
    setPendingChatId(chatId);
    try {
      await postPayload({
        mode: 'review_group',
        chatId,
        matchedMmsId,
        status,
      });
    } catch (caught) {
      setSubmitError(caught.message || 'Group review failed');
    } finally {
      setPendingChatId('');
    }
  }

  async function handleAddGroupStudent(chatId, mmsId) {
    setSubmitError('');
    setPendingChatId(chatId);
    try {
      await postPayload({
        mode: 'add_group_student',
        chatId,
        mmsId,
      });
    } catch (caught) {
      setSubmitError(caught.message || 'Add student to group failed');
    } finally {
      setPendingChatId('');
    }
  }

  async function handleUpdateText(entry, messageText) {
    setSubmitError('');
    setPendingId(entry.incomingId);
    try {
      await postPayload({
        mode: 'update_text',
        incomingId: entry.incomingId,
        messageText,
      });
    } catch (caught) {
      setSubmitError(caught.message || 'Message text update failed');
    } finally {
      setPendingId('');
    }
  }

  async function handleConvert(entry, correction) {
    setSubmitError('');
    setPendingId(entry.incomingId);
    try {
      const data = await postPayload({
        mode: 'convert',
        incomingId: entry.incomingId,
        ...correction,
      });
      setConversions((current) => ({
        ...current,
        [entry.incomingId]: {
          planningId: data.planningId || '',
          replyTemplate: data.replyTemplate || '',
        },
      }));
    } catch (caught) {
      setSubmitError(caught.message || 'Conversion failed');
    } finally {
      setPendingId('');
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between gap-3">
        <div>
          <h2 className="fc-display text-3xl text-slate-900">Message Inbox</h2>
          <p className="mt-1 text-sm text-slate-500">
            {openCount ? `${openCount} unread${absenceCount ? ` · ${absenceCount} likely absence` : ''}` : '0 unread'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {replyDraftingAvailable && openCount > 0 ? (
            <button
              type="button"
              onClick={handleDraftAllOpen}
              disabled={Boolean(pendingId)}
              className="mt-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 disabled:opacity-60"
            >
              Draft all open
            </button>
          ) : null}
          <button
            type="button"
            onClick={refreshInbox}
            disabled={isRefreshing}
            aria-label="Refresh inbox"
            title="Refresh"
            className="mt-1 rounded-full p-2.5 text-slate-500 transition-colors hover:bg-white/80 hover:text-[#2F6B3D] disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </section>

      {submitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
      ) : null}

      <BridgeStatusStrip bridgeStatus={bridgeStatus} inbox={inbox} />

      <section className="space-y-4">
        {/* Manual paste is the fallback now that auto-capture handles confirmed
            groups, so it stays collapsed until needed. */}
        <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
          <button
            type="button"
            onClick={() => setShowCapture((current) => !current)}
            aria-expanded={showCapture}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span className="text-lg leading-none text-slate-400">{showCapture ? '−' : '+'}</span>
              Paste a message manually
            </span>
            <span className="hidden text-xs text-slate-400 sm:block">
              {showCapture ? 'Close' : 'Auto-capture handles confirmed groups — use this for anything else'}
            </span>
          </button>
          {showCapture ? (
            <form onSubmit={handleCapture} className="space-y-4 border-t border-slate-100 px-4 pb-5 pt-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Message</span>
                <textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  required
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  placeholder="Paste the parent message here..."
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Sender name</span>
                  <input
                    value={senderName}
                    onChange={(event) => setSenderName(event.target.value)}
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Phone</span>
                  <input
                    value={senderPhone}
                    onChange={(event) => setSenderPhone(event.target.value)}
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Chat / group name</span>
                  <input
                    value={chatName}
                    onChange={(event) => setChatName(event.target.value)}
                    className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Save to inbox
                </button>
                {status ? <span className="text-sm text-slate-500">{status}</span> : null}
              </div>
            </form>
          ) : null}
        </div>

        <div className="standalone-hide">
          <GroupMapPanel
            groups={groupMap}
            studentOptions={studentOptions}
            onReviewGroup={handleReviewGroup}
            onAddGroupStudent={handleAddGroupStudent}
            pendingChatId={pendingChatId}
          />
        </div>

        {archivedCount + autoArchivedCount ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowArchived((current) => !current)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
            >
              {showArchived ? 'Hide archived' : `Show archived (${archivedCount + autoArchivedCount})`}
            </button>
          </div>
        ) : null}

        <div className="space-y-3">
          {visibleInbox.map((entry) => (
            <MessageCard
              key={entry.incomingId}
              entry={entry}
              studentOptions={studentOptions}
              pendingId={pendingId}
              conversion={conversions[entry.incomingId]}
              onReview={handleReview}
              onDelete={handleDelete}
              onCorrect={handleCorrect}
              onConvert={handleConvert}
              onUpdateText={handleUpdateText}
              replyProposal={replyProposals[entry.incomingId]}
              decidedReply={decidedReplies[entry.incomingId]}
              replyDraftingAvailable={replyDraftingAvailable}
              onDraftReply={handleDraftReply}
              onDecideReply={handleDecideReply}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
