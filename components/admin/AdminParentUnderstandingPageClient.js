'use client';

import Link from 'next/link';
import { Check, Copy, Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AgeChip } from '@/components/admin/ui/AgeChip';
import {
  buildParentUnderstandingSummary,
  calculateUnderstandingScore,
  PARENT_UNDERSTANDING_STATUS_OPTIONS,
} from '@/lib/admin/parent-understanding-helpers.mjs';
import {
  cardClasses,
  firstName,
  labelFor,
  statusAfterEdit,
  buildStatusPatch,
  buildEmptyDetails,
  getRecordScore,
  hasUnderstandingAssessment,
  hasWorkflowActivity,
  getRecordRiskSignals,
  matchesQueueSearch,
  deriveNextActions,
} from '@/lib/admin/parent-understanding-client-helpers.mjs';
import { logCommunicationCopy } from '@/lib/admin/log-communication-copy.js';

const UNDERSTANDING_AREAS = [
  {
    key: 'cancellations',
    title: 'Cancellations & Holidays',
    prompt: 'Understands cancellation/holiday policy',
    notePlaceholder: 'Any confusion about holidays, cancellations, or pausing?',
    actionKey: 'policyInfoSent',
    actionLabel: 'Policy info sent',
  },
  {
    key: 'dashboardSoundslice',
    title: 'Student Dashboard & Soundslice',
    prompt: 'Knows where to access songs, notes, and resources',
    notePlaceholder: 'Dashboard/Soundslice access notes',
    actionKey: 'dashboardLinkSent',
    actionLabel: 'Dashboard link sent',
  },
  {
    key: 'practiceNotes',
    title: 'Practice Notes',
    prompt: 'Understands practice notes and receives them',
    notePlaceholder: 'Email, delivery, or home-practice note issues',
    actionKey: 'practiceNotesIssueFlagged',
    actionLabel: 'Email/contact issue flagged',
  },
  {
    key: 'showcases',
    title: 'Student Showcases',
    prompt: 'Understands showcases and the invitation to perform',
    notePlaceholder: 'Interest, nerves, or showcase questions',
    actionKey: 'showcaseInfoSent',
    actionLabel: 'Showcase info sent',
  },
];

const UNDERSTANDING_OPTIONS = [
  { value: '', label: 'Not checked' },
  { value: 'yes', label: 'Clear' },
  { value: 'partial', label: 'Some clarification' },
  { value: 'no', label: 'Not clear' },
  { value: 'unsure', label: 'Unsure' },
];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'needs_follow_up', label: 'Needs Follow-Up' },
  { value: 'completed', label: 'Completed' },
  { value: 'risk', label: 'Has Risk Signals' },
  { value: 'low_score', label: 'Low Score' },
];

const WHATSAPP_COMMUNITY_INVITE_URL = 'https://chat.whatsapp.com/KKetDYyqDDGFBF1sTSWOG3?mode=gi_t';
const GOOGLE_REVIEW_URL = 'https://www.google.com/search?hl=en-GB&gl=uk&q=First+Chord+Music+School,+33+Otago+St,+Glasgow+G12+8JJ&ludocid=12199449542125224380&lsig=AB86z5W4tXrtGxxEIxNKZMDj34tG#lrd=0x48884565152a53d5:0xa94d26b91dad01bc,3';

const CANCELLATION_POLICY_RECAP = 'If you cannot attend in person, you can have a Zoom lesson at the normal time or your tutor can send a 5-10 minute practice video with notes. Same-day cancellations/no-shows are not eligible for a practice video. If you need to cancel a lesson, please give one week of notice so the lesson is not charged. Extended breaks can be paused for up to 3 weeks; weeks 4 and 5 are charged as normal, and 6+ weeks usually means discussing stepping back temporarily. Summer holidays are handled separately.';

function hasCompleteUnderstandingAssessment(record) {
  const understanding = record?.state?.details?.understanding || {};
  return UNDERSTANDING_AREAS.every((area) => `${understanding[area.key]?.understands || ''}`.trim());
}

function effectiveWorkflowStatus(record) {
  if (record?.state?.workflowStatus === 'completed' && !hasCompleteUnderstandingAssessment(record)) {
    return 'needs_follow_up';
  }
  return record?.state?.workflowStatus || 'not_started';
}

function workflowStatusLabel(record) {
  if (record?.state?.workflowStatus === 'completed' && !hasCompleteUnderstandingAssessment(record)) {
    return 'Checklist missing';
  }
  return labelFor(PARENT_UNDERSTANDING_STATUS_OPTIONS, record?.state?.workflowStatus);
}

function buildTemplates(record) {
  const parent = firstName(record.student.parentName);
  const student = firstName(record.student.studentName);
  const dashboardUrl = record.student.dashboardUrl || `/admin/students/${record.student.mmsId}`;

  return {
    cancellations: `Here's a quick summary of how missed lessons and holidays work:\n\n${CANCELLATION_POLICY_RECAP}\n\nFull policy is here: https://firstchord.co.uk/handbook\n\nIf anything feels unclear, just ask.`,
    dashboardSoundslice: `Here's a quick reminder on accessing ${student}'s Student Dashboard: ${dashboardUrl}\n\nInside you'll find practice notes, song materials, and progress updates. If you ever have trouble accessing it, just message and we'll help straight away.`,
    practiceNotes: `Practice notes are sent via email after each lesson. If you're not seeing them, please check spam or let us know and we'll resend them.\n\nWe also recommend bookmarking ${student}'s dashboard so you can quickly access practice notes and song material from anywhere: ${dashboardUrl}`,
    showcases: `Just to recap, we run two free Student Showcases each year. All students are welcome to perform in a supportive environment. Dates are announced via newsletter and the WhatsApp community.\n\nDo let us know if you're not in the First Chord community group.`,
    whatsappGroups: `Just to recap how we usually communicate: the small WhatsApp group with the tutor, parents, Finn and Tom is for most lesson/admin messages, and the main First Chord community group is for bigger school-wide announcements. We’ll keep important information in the relevant group so it’s easy to find.\n\nFirst Chord Community Group: ${WHATSAPP_COMMUNITY_INVITE_URL}`,
    noAnswer: `Hi ${parent}, it's Fenella from First Chord. I was just trying to catch you for a quick check-in about ${student}'s lessons and to make sure you have all the useful lesson information. Let me know if there's a better time to call.`,
    reviewRequest: `Hi ${parent}, thanks again for taking the time to chat today. It was really helpful to check in about ${student}'s lessons.\n\nIf you have a minute, we'd really appreciate a quick Google review. You can click here: ${GOOGLE_REVIEW_URL}`,
  };
}

function QueueItem({ record, selected, unsaved, onSelect }) {
  const score = getRecordScore(record);
  const signals = getRecordRiskSignals(record);
  const hasActivity = hasWorkflowActivity(record);
  const hasAssessment = hasUnderstandingAssessment(record);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{record.student.studentName}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{record.student.parentName || 'Parent not recorded'}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs text-slate-600 shadow-sm">
          {hasActivity && hasAssessment ? `${score.total}/8` : 'Not assessed'}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
          {workflowStatusLabel(record)}
        </span>
        {unsaved ? (
          <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-900">Unsaved</span>
        ) : null}
        {signals.length ? (
          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">{signals.length} signal{signals.length === 1 ? '' : 's'}</span>
        ) : null}
        <AgeChip updatedAt={record.state?.updatedAt} />
      </div>
    </button>
  );
}

function FieldLabel({ children }) {
  return <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</label>;
}

function UnderstandingArea({ area, value, actions, onAreaChange, onActionChange }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{area.title}</h4>
          <p className="mt-1 text-sm text-slate-600">{area.prompt}</p>
        </div>
        <select
          value={value.understands || ''}
          onChange={(event) => onAreaChange(area.key, { understands: event.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {UNDERSTANDING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <textarea
          value={value.notes || ''}
          onChange={(event) => onAreaChange(area.key, { notes: event.target.value })}
          placeholder={area.notePlaceholder}
          rows={2}
          className="min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
        />
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(actions[area.actionKey])}
            onChange={(event) => onActionChange(area.actionKey, event.target.checked)}
          />
          {area.actionLabel}
        </label>
      </div>
    </section>
  );
}

function TemplateButton({ label, body, onCopy, copied }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(label, body)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/60"
    >
      <span>{label}</span>
      {copied === label ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
    </button>
  );
}

export default function AdminParentUnderstandingPageClient({ initialWorkflow }) {
  const [records, setRecords] = useState(() => initialWorkflow.records.map((record) => ({
    ...record,
    state: {
      ...record.state,
      details: buildEmptyDetails(record.state.details),
    },
  })));
  const [selectedMmsId, setSelectedMmsId] = useState(initialWorkflow.records[0]?.student?.mmsId || '');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState({ pending: false, error: '', savedAt: '' });
  const [unsavedMmsIds, setUnsavedMmsIds] = useState(() => new Set());
  const [copiedTemplate, setCopiedTemplate] = useState('');

  const selectedRecord = records.find((record) => record.student.mmsId === selectedMmsId) || records[0] || null;
  const hasUnsavedSelected = selectedRecord ? unsavedMmsIds.has(selectedRecord.student.mmsId) : false;
  const score = selectedRecord ? getRecordScore(selectedRecord) : calculateUnderstandingScore({});
  const selectedHasAssessment = selectedRecord ? hasUnderstandingAssessment(selectedRecord) : false;
  const selectedHasCompleteAssessment = selectedRecord ? hasCompleteUnderstandingAssessment(selectedRecord) : false;
  const riskSignals = selectedRecord ? getRecordRiskSignals(selectedRecord) : [];
  const nextActions = selectedRecord ? deriveNextActions(selectedRecord) : [];
  const templates = selectedRecord ? buildTemplates(selectedRecord) : {};

  const filteredRecords = useMemo(() => records.filter((record) => {
    if (!matchesQueueSearch(record, query)) {
      return false;
    }

    const recordScore = getRecordScore(record);
    const signals = getRecordRiskSignals(record);
    const hasActivity = hasWorkflowActivity(record);
    if (filter === 'all') return true;
    if (filter === 'risk') return hasActivity && signals.length > 0;
    if (filter === 'low_score') return hasUnderstandingAssessment(record) && recordScore.total <= 4;
    const status = effectiveWorkflowStatus(record);
    if (filter === 'not_started') return status === 'not_started' && !hasActivity;
    if (!hasActivity) return false;
    return status === filter;
  }), [records, filter, query]);

  const completedCount = records.filter((record) => effectiveWorkflowStatus(record) === 'completed').length;
  const followUpCount = records.filter((record) => ['needs_follow_up', 'escalate_to_admin'].includes(effectiveWorkflowStatus(record))).length;

  useEffect(() => {
    setSaveState({ pending: false, error: '', savedAt: '' });
  }, [selectedMmsId]);

  useEffect(() => {
    function handleBeforeUnload(event) {
      if (!unsavedMmsIds.size) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedMmsIds]);

  function confirmDiscardUnsaved() {
    if (!hasUnsavedSelected) {
      return true;
    }
    return window.confirm('This parent record has unsaved changes. Leave without saving?');
  }

  function selectRecord(nextMmsId) {
    if (nextMmsId === selectedRecord?.student?.mmsId) {
      return;
    }
    if (!confirmDiscardUnsaved()) {
      return;
    }
    setSelectedMmsId(nextMmsId);
  }

  function markSelectedDirty() {
    if (!selectedRecord?.student?.mmsId) {
      return;
    }
    setUnsavedMmsIds((current) => {
      const next = new Set(current);
      next.add(selectedRecord.student.mmsId);
      return next;
    });
    setSaveState({ pending: false, error: '', savedAt: '' });
  }

  function updateSelected(updater) {
    setRecords((current) => current.map((record) => {
      if (record.student.mmsId !== selectedRecord.student.mmsId) {
        return record;
      }
      return updater(record);
    }));
  }

  function updateState(patch) {
    markSelectedDirty();
    updateSelected((record) => ({
      ...record,
      state: {
        ...record.state,
        workflowStatus: patch.workflowStatus || statusAfterEdit(record.state.workflowStatus),
        ...patch,
      },
    }));
  }

  function updateDetails(patch) {
    markSelectedDirty();
    updateSelected((record) => ({
      ...record,
      state: {
        ...record.state,
        workflowStatus: statusAfterEdit(record.state.workflowStatus),
        details: {
          ...record.state.details,
          ...patch,
        },
      },
    }));
  }

  function updateUnderstanding(areaKey, patch) {
    updateDetails({
      understanding: {
        ...selectedRecord.state.details.understanding,
        [areaKey]: {
          ...selectedRecord.state.details.understanding[areaKey],
          ...patch,
        },
      },
    });
  }

  function updateFeedback(patch) {
    updateDetails({
      feedback: {
        ...selectedRecord.state.details.feedback,
        ...patch,
      },
    });
  }

  function updateCommunication(patch) {
    updateDetails({
      communication: {
        ...selectedRecord.state.details.communication,
        ...patch,
      },
    });
  }

  function updateAction(actionKey, checked) {
    updateDetails({
      actions: {
        ...selectedRecord.state.details.actions,
        [actionKey]: checked,
      },
    });
  }

  async function copyTemplate(label, body) {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = body;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopiedTemplate(label);
    window.setTimeout(() => setCopiedTemplate((current) => (current === label ? '' : current)), 1800);
    if (selectedRecord) {
      logCommunicationCopy({
        category: 'parent',
        mmsId: selectedRecord.student.mmsId,
        studentName: selectedRecord.student.studentName,
        body,
        source: 'parent_understanding',
      });
    }
  }

  function regenerateSummary() {
    updateState({
      summary: buildParentUnderstandingSummary(
        { ...selectedRecord.state.details, adminFollowUpNote: selectedRecord.state.details.adminFollowUpNote },
        {
          parentName: selectedRecord.student.parentName,
          studentName: selectedRecord.student.studentName,
        },
      ),
    });
  }

  async function saveRecord(nextStatus = 'in_progress') {
    if (nextStatus === 'completed' && !hasCompleteUnderstandingAssessment(selectedRecord)) {
      setSaveState({
        pending: false,
        error: 'Complete all four understanding checks before marking this call done.',
        savedAt: '',
      });
      return;
    }

    const statusPatch = buildStatusPatch(nextStatus);
    const recordToSave = {
      ...selectedRecord,
      state: {
        ...selectedRecord.state,
        ...statusPatch,
      },
    };
    setSaveState({ pending: true, error: '', savedAt: '' });
    const nextScore = getRecordScore(recordToSave);
    const nextSignals = getRecordRiskSignals(recordToSave);

    try {
      const response = await fetch('/api/admin/parent-understanding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentMmsId: recordToSave.student.mmsId,
          studentName: recordToSave.student.studentName,
          parentName: recordToSave.student.parentName,
          workflowStatus: recordToSave.state.workflowStatus,
          loopStatus: recordToSave.state.loopStatus,
          callAttemptCount: recordToSave.state.callAttemptCount,
          lastContactedAt: recordToSave.state.lastContactedAt,
          details: recordToSave.state.details,
          summary: recordToSave.state.summary,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setSaveState({ pending: false, error: payload.error || 'Save failed', savedAt: '' });
        return;
      }

      updateSelected((record) => ({
        ...record,
        state: {
          ...record.state,
          ...payload.state,
          details: buildEmptyDetails(payload.state.details),
          understandingScore: nextScore.total,
          understandingLabel: nextScore.labelText,
          riskSignals: nextSignals,
        },
      }));
      setUnsavedMmsIds((current) => {
        const next = new Set(current);
        next.delete(selectedRecord.student.mmsId);
        return next;
      });
      setSaveState({ pending: false, error: '', savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
    } catch (error) {
      setSaveState({ pending: false, error: error.message || 'Save failed', savedAt: '' });
    }
  }

  if (!selectedRecord) {
    return (
      <section className={cardClasses()}>
        <h2 className="text-xl font-semibold text-slate-900">Parent Understanding Workflow</h2>
        <p className="mt-2 text-sm text-slate-600">No students were available for this workflow.</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">One-off workflow</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Parent Understanding
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          A call workspace for checking parent understanding, copying follow-up messages, capturing feedback, and leaving each conversation with a clear loop status.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className={cardClasses()}>
          <p className="text-sm text-slate-500">Campaign progress</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{completedCount} / {records.length}</p>
          <p className="mt-2 text-sm text-slate-600">Parent records completed.</p>
        </div>
        <div className={cardClasses()}>
          <p className="text-sm text-slate-500">Needs follow-up</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{followUpCount}</p>
          <p className="mt-2 text-sm text-slate-600">Saved records marked for follow-up.</p>
        </div>
        <div className={cardClasses()}>
          <p className="text-sm text-slate-500">Selected score</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {selectedHasAssessment ? `${score.total} / ${score.max}` : 'Not assessed'}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {selectedHasAssessment ? score.labelText : 'Use the four understanding dropdowns before marking the call done.'}
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_330px]">
        <aside className={cardClasses('h-fit')}>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search student, parent, tutor, MMS ID"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  filter === item.value
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Showing {filteredRecords.length} of {records.length}
          </p>
          <div className="mt-4 max-h-[680px] space-y-3 overflow-auto pr-1">
            {filteredRecords.length ? (
              filteredRecords.map((record) => (
                <QueueItem
                  key={record.student.mmsId}
                  record={record}
                  selected={record.student.mmsId === selectedRecord.student.mmsId}
                  unsaved={unsavedMmsIds.has(record.student.mmsId)}
                  onSelect={() => selectRecord(record.student.mmsId)}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No matching parent records.
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-5">
          {hasUnsavedSelected || saveState.error || saveState.savedAt ? (
            <section
              className={`rounded-2xl border p-4 shadow-sm ${
                saveState.error
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : hasUnsavedSelected
                    ? 'border-amber-200 bg-amber-50 text-amber-950'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              <p className="text-sm font-semibold">
                {saveState.error
                  ? 'Save failed'
                  : hasUnsavedSelected
                    ? 'Unsaved changes'
                    : `Saved at ${saveState.savedAt}`}
              </p>
              <p className="mt-1 text-sm">
                {saveState.error
                  ? saveState.error
                  : hasUnsavedSelected
                    ? 'Click Save progress, Mark done, or Needs follow-up before moving to another parent. Unsaved edits only live on this screen.'
                    : 'This parent workflow record has been written to the Parent_Understanding_State sheet.'}
              </p>
            </section>
          ) : null}

          <section className={cardClasses()}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{selectedRecord.student.studentName}</h3>
                <p className="mt-1 text-sm text-slate-600">{selectedRecord.student.parentName || 'Parent not recorded'}</p>
              </div>
              <Link
                href={`/admin/students/${selectedRecord.student.mmsId}`}
                onClick={(event) => {
                  if (!confirmDiscardUnsaved()) {
                    event.preventDefault();
                  }
                }}
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50"
              >
                Open student record
              </Link>
            </div>
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ['Phone', selectedRecord.student.parentPhone || 'Missing'],
                ['Parent email on record', selectedRecord.student.parentEmail || 'Missing'],
                ['Tutor', selectedRecord.student.tutor || 'Unknown'],
                ['Lesson', selectedRecord.student.lessonSlot || 'No cached schedule'],
                ['Instrument', selectedRecord.student.instrument || 'Unknown'],
                ['Lifecycle', selectedRecord.student.lifecycleLabel || 'Unknown'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={cardClasses()}>
            <h3 className="text-lg font-semibold text-slate-900">Call Status</h3>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current state</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {hasUnsavedSelected ? 'Unsaved changes - save progress, mark done, or flag follow-up' : workflowStatusLabel(selectedRecord)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Starting or editing a record automatically makes it in progress. Use the save buttons at the bottom to close the loop.
              </p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Attempt count</FieldLabel>
                <input
                  type="number"
                  min="0"
                  value={selectedRecord.state.callAttemptCount}
                  onChange={(event) => updateState({ callAttemptCount: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Last contacted</FieldLabel>
                <input
                  type="datetime-local"
                  value={selectedRecord.state.lastContactedAt || ''}
                  onChange={(event) => updateState({ lastContactedAt: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </div>
            </div>
          </section>

          <section className={cardClasses()}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Understanding Checklist</h3>
                <p className="mt-1 text-sm text-slate-600">Each area scores 0, 1, or 2 and creates practical follow-up signals when unclear.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{score.total} / 8</span>
            </div>
            <div className="mt-4 space-y-3">
              {UNDERSTANDING_AREAS.map((area) => (
                <UnderstandingArea
                  key={area.key}
                  area={area}
                  value={selectedRecord.state.details.understanding[area.key] || {}}
                  actions={selectedRecord.state.details.actions || {}}
                  onAreaChange={updateUnderstanding}
                  onActionChange={updateAction}
                />
              ))}
            </div>
          </section>

          <section className={cardClasses()}>
            <h3 className="text-lg font-semibold text-slate-900">Feedback</h3>
            <div className="mt-4 grid gap-4">
              <textarea
                value={selectedRecord.state.details.feedback.lessonFeedback || ''}
                onChange={(event) => updateFeedback({ lessonFeedback: event.target.value })}
                rows={3}
                placeholder="How are lessons going? Anything the parent wants us to know?"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
              />
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldLabel>Practice at home</FieldLabel>
                  <select
                    value={selectedRecord.state.details.feedback.practiceAtHome || 'unknown'}
                    onChange={(event) => updateFeedback({ practiceAtHome: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="regularly">Regularly</option>
                    <option value="sometimes">Sometimes</option>
                    <option value="not_often">Not often</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Tutor/action relevance</FieldLabel>
                  <select
                    value={selectedRecord.state.details.feedback.tutorRelevance || 'none'}
                    onChange={(event) => updateFeedback({ tutorRelevance: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="none">None</option>
                    <option value="worth_noting_later">Worth noting later</option>
                    <option value="needs_admin_review">Needs admin review</option>
                  </select>
                </div>
              </div>
              <textarea
                value={selectedRecord.state.details.feedback.practiceBarriers || ''}
                onChange={(event) => updateFeedback({ practiceBarriers: event.target.value })}
                rows={2}
                placeholder="Practice barriers, equipment issues, timetable issues, motivation/confidence notes"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
              />
            </div>
          </section>

          <section className={cardClasses()}>
            <h3 className="text-lg font-semibold text-slate-900">WhatsApp Communication</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Understands WhatsApp groups</FieldLabel>
                <select
                  value={selectedRecord.state.details.communication.whatsappUnderstanding || ''}
                  onChange={(event) => updateCommunication({ whatsappUnderstanding: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="">Not checked</option>
                  <option value="yes">Yes</option>
                  <option value="partial">Partial</option>
                  <option value="no">No</option>
                  <option value="unsure">Unsure</option>
                </select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Community group status</FieldLabel>
                <select
                  value={selectedRecord.state.details.communication.communityGroupStatus || 'unknown'}
                  onChange={(event) => updateCommunication({ communityGroupStatus: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="unknown">Unknown</option>
                  <option value="in_group">In group</option>
                  <option value="not_in_group">Not in group</option>
                  <option value="not_relevant">Not relevant</option>
                </select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Best time to call if needed</FieldLabel>
                <input
                  value={selectedRecord.state.details.communication.bestContactTime || ''}
                  onChange={(event) => updateCommunication({ bestContactTime: event.target.value })}
                  placeholder="Evening, weekend, specific notes..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Community invite</p>
              <a
                href={WHATSAPP_COMMUNITY_INVITE_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm font-medium text-slate-800 underline-offset-2 hover:underline"
              >
                {WHATSAPP_COMMUNITY_INVITE_URL}
              </a>
              <p className="mt-2 text-sm text-slate-600">If the parent is not in the community group, send this and leave the loop open until joined or intentionally declined.</p>
            </div>
          </section>

          <section className={cardClasses()}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">Summary & Save</h3>
              <button
                type="button"
                onClick={regenerateSummary}
                className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50"
              >
                Generate summary
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <h4 className="text-sm font-semibold text-amber-950">Next Action</h4>
              <ul className="mt-2 space-y-1 text-sm text-amber-950">
                {nextActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
            <textarea
              value={selectedRecord.state.summary || ''}
              onChange={(event) => updateState({ summary: event.target.value })}
              rows={5}
              placeholder="Generate or write a plain-English call summary before saving."
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
            <textarea
              value={selectedRecord.state.details.adminFollowUpNote || ''}
              onChange={(event) => updateDetails({ adminFollowUpNote: event.target.value })}
              rows={2}
              placeholder="Admin follow-up note, if anything needs action after the call"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => saveRecord('in_progress')}
                disabled={saveState.pending}
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-wait disabled:opacity-70 ${
                  hasUnsavedSelected
                    ? 'border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                }`}
              >
                {saveState.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save progress
              </button>
              <button
                type="button"
                onClick={() => saveRecord('completed')}
                disabled={saveState.pending || !selectedHasCompleteAssessment}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100 px-5 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
                title={selectedHasCompleteAssessment ? '' : 'Complete the four understanding checks before marking done.'}
              >
                <Check className="h-4 w-4" />
                Mark done
              </button>
              <button
                type="button"
                onClick={() => saveRecord('needs_follow_up')}
                disabled={saveState.pending}
                className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-70"
              >
                Needs follow-up
              </button>
              {saveState.savedAt ? <span className="text-sm text-emerald-700">Saved at {saveState.savedAt}</span> : null}
              {saveState.error ? <span className="text-sm text-red-700">{saveState.error}</span> : null}
            </div>
            {!selectedHasCompleteAssessment ? (
              <p className="mt-3 text-sm text-amber-800">
                Complete all four understanding checks before marking this call done. Use Save progress or Needs follow-up if the call is only partly assessed.
              </p>
            ) : null}
          </section>
        </main>

        <aside className={cardClasses('h-fit space-y-5')}>
          <section>
            <h3 className="text-lg font-semibold text-slate-900">Fixes & Templates</h3>
            <p className="mt-1 text-sm text-slate-600">Copy only what is useful during or after the call.</p>
          </section>

          <section className="space-y-2">
            <TemplateButton label="Thanks + review request" body={templates.reviewRequest} onCopy={copyTemplate} copied={copiedTemplate} />
            <TemplateButton label="No answer follow-up" body={templates.noAnswer} onCopy={copyTemplate} copied={copiedTemplate} />
            {selectedRecord.state.details.communication.whatsappUnderstanding !== 'yes' ? (
              <TemplateButton label="WhatsApp groups recap" body={templates.whatsappGroups} onCopy={copyTemplate} copied={copiedTemplate} />
            ) : null}
            {UNDERSTANDING_AREAS.map((area) => {
              const areaValue = selectedRecord.state.details.understanding[area.key]?.understands;
              if (areaValue === 'yes') {
                return null;
              }
              return (
                <TemplateButton
                  key={area.key}
                  label={`${area.title} recap`}
                  body={templates[area.key]}
                  onCopy={copyTemplate}
                  copied={copiedTemplate}
                />
              );
            })}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Useful Links</h4>
            <div className="mt-3 space-y-2 text-sm">
              <a href={selectedRecord.student.dashboardUrl || '#'} target="_blank" rel="noreferrer" className="block text-slate-700 underline-offset-2 hover:underline">
                Student dashboard
              </a>
              <a href="https://firstchord.co.uk/handbook" target="_blank" rel="noreferrer" className="block text-slate-700 underline-offset-2 hover:underline">
                School handbook
              </a>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Practice Notes Email</h4>
            <p className="mt-2 text-sm text-slate-600">Practice notes are sent to the parent email in MMS. This workflow flags issues only; Fenella can update MMS after the call.</p>
            <p className="mt-3 break-all rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-800">
              {selectedRecord.student.parentEmail || 'No parent email visible'}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Risk Signals</h4>
            {riskSignals.length ? (
              <ul className="mt-3 space-y-2">
                {riskSignals.map((signal) => (
                  <li key={signal} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">{signal}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No practical follow-up signals yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Score Breakdown</h4>
            <dl className="mt-3 space-y-2 text-sm">
              {UNDERSTANDING_AREAS.map((area) => (
                <div key={area.key} className="flex items-center justify-between gap-3">
                  <dt className="text-slate-600">{area.title}</dt>
                  <dd className="font-semibold text-slate-900">{score.breakdown[area.key] || 0}/2</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </section>
    </div>
  );
}
