'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  INCOMING_MESSAGE_CATEGORIES,
  labelIncomingCategory,
  labelIncomingStatus,
} from '@/lib/admin/incoming-message-helpers.mjs';

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

function GroupRow({ group, studentOptions = [], onReviewGroup, isPending }) {
  const [selectedMmsId, setSelectedMmsId] = useState(group.matchedMmsId || '');
  const status = group.status || 'review';

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
        {group.instrument ? ` · ${group.instrument}` : ''}
        {group.matchedFcId ? ` · ${group.matchedFcId}` : ''}
        {group.lastMessageAt ? ` · last active ${formatDateTime(group.lastMessageAt)}` : (group.lastSeenAt ? ` · last seen ${formatDateTime(group.lastSeenAt)}` : '')}
      </p>

      {status === 'confirmed' ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onReviewGroup(group.chatId, { status: 'review' })}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-60"
          >
            Re-review
          </button>
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

function GroupMapPanel({ groups = [], studentOptions = [], onReviewGroup, pendingChatId }) {
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
      isPending={pendingChatId === group.chatId}
    />
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">WhatsApp groups</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Matching hints only — they never trigger actions. Confirm a student so future messages from that group match instantly. Unmatched groups (no current student) are hidden by default.
          </p>
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
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
          >
            Convert to plan + draft reply
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
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-3 py-3">
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

function MessageCard({ entry, studentOptions, onReview, onDelete, onCorrect, onConvert, conversion, pendingId }) {
  const isPending = pendingId === entry.incomingId;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {labelIncomingCategory(entry.suspectedCategory)}
        </span>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(entry.status)}`}>
          {labelIncomingStatus(entry.status)}
        </span>
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

      {entry.matchReasons ? (
        <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          {entry.matchReasons}
        </p>
      ) : null}

      {entry.reviewNote ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">Review note: {entry.reviewNote}</p>
      ) : null}

      {entry.reviewedBy || entry.reviewedAt ? (
        <p className="mt-1 text-[11px] text-slate-400">
          Last actioned{entry.reviewedBy ? ` by ${entry.reviewedBy}` : ''}{entry.reviewedAt ? ` · ${formatDateTime(entry.reviewedAt)}` : ''}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
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

export default function AdminIncomingMessagesPageClient({ initialInbox = [], initialGroupMap = [], studentOptions = [], error = '' }) {
  const [inbox, setInbox] = useState(initialInbox);
  const [groupMap, setGroupMap] = useState(initialGroupMap);
  const [messageText, setMessageText] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [chatName, setChatName] = useState('');
  const [status, setStatus] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [pendingChatId, setPendingChatId] = useState('');
  const [submitError, setSubmitError] = useState(error);
  const [showArchived, setShowArchived] = useState(false);
  const [conversions, setConversions] = useState({});

  const openCount = useMemo(() => inbox.filter((entry) => ['inbox', 'needs_review'].includes(entry.status)).length, [inbox]);
  const absenceCount = useMemo(() => inbox.filter((entry) => ABSENCE_CATEGORIES.has(entry.suspectedCategory) && ['inbox', 'needs_review'].includes(entry.status)).length, [inbox]);
  const archivedCount = useMemo(() => inbox.filter((entry) => ['converted', 'ignored'].includes(entry.status)).length, [inbox]);
  const visibleInbox = useMemo(() => (
    showArchived
      ? inbox
      : inbox.filter((entry) => ['inbox', 'needs_review'].includes(entry.status) || conversions[entry.incomingId])
  ), [inbox, showArchived, conversions]);

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
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Incoming messages</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Message Inbox
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Paste or ingest parent messages that need operational review. This is an intake lane only: it does not pause payments,
          message parents, or change workflow state until a human acts.
        </p>
      </section>

      {submitError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <form onSubmit={handleCapture} className="space-y-4 rounded-2xl border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Quick capture</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">Use this for a starred WhatsApp message or anything copied from a parent chat.</p>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Message</span>
            <textarea
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              required
              rows={8}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder="Paste the parent message here..."
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Chat / group name</span>
            <input
              value={chatName}
              onChange={(event) => setChatName(event.target.value)}
              className="mt-2 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
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

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
              <p className="text-sm text-slate-500">Open messages</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{openCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-[0_12px_36px_rgba(15,23,42,0.04)]">
              <p className="text-sm text-slate-500">Likely absence / pause</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">{absenceCount}</p>
            </div>
          </div>

          <GroupMapPanel
            groups={groupMap}
            studentOptions={studentOptions}
            onReviewGroup={handleReviewGroup}
            pendingChatId={pendingChatId}
          />

          {!visibleInbox.length ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {inbox.length ? 'No open incoming messages.' : 'No incoming messages yet.'}
            </div>
          ) : null}

          {archivedCount ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowArchived((current) => !current)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
              >
                {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
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
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
