'use client';

import Link from 'next/link';
import { Check, Copy, Loader2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildParentUnderstandingSummary,
  calculateUnderstandingScore,
  deriveParentUnderstandingRiskSignals,
  PARENT_UNDERSTANDING_LOOP_STATUS_OPTIONS,
  PARENT_UNDERSTANDING_STATUS_OPTIONS,
} from '@/lib/admin/parent-understanding-helpers.mjs';

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
  { value: 'yes', label: 'Yes' },
  { value: 'partial', label: 'Partial' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Unsure' },
];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'needs_follow_up', label: 'Needs Follow-Up' },
  { value: 'completed', label: 'Completed' },
  { value: 'risk', label: 'Has Risk Signals' },
  { value: 'low_score', label: 'Low Score' },
];

const WHATSAPP_COMMUNITY_INVITE_URL = 'https://chat.whatsapp.com/KKetDYyqDDGFBF1sTSWOG3?mode=gi_t';

const CANCELLATION_POLICY_RECAP = 'If you cannot attend in person, you can have a Zoom lesson at the normal time or your tutor can send a 5-10 minute practice video with notes. Same-day cancellations/no-shows are not eligible for a practice video. If you need to cancel a lesson, please give one week of notice so the lesson is not charged. Extended breaks can be paused for up to 3 weeks; weeks 4 and 5 are charged as normal, and 6+ weeks usually means discussing stepping back temporarily. Summer holidays are handled separately.';

function cardClasses(extra = '') {
  return `rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] ${extra}`;
}

function firstName(name = '') {
  return `${name || ''}`.trim().split(/\s+/)[0] || 'there';
}

function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || value || 'Not set';
}

function buildEmptyDetails(details = {}) {
  return {
    understanding: {
      cancellations: { understands: '' },
      dashboardSoundslice: { understands: '' },
      practiceNotes: { understands: '' },
      showcases: { understands: '' },
      ...(details.understanding || {}),
    },
    feedback: {
      lessonFeedback: '',
      tutorFit: '',
      studentEnjoyment: '',
      practiceAtHome: 'unknown',
      practiceBarriers: '',
      equipmentIssues: '',
      motivationIssues: '',
      parentSuggestions: '',
      generalNotes: '',
      tutorRelevance: 'none',
      ...(details.feedback || {}),
    },
    communication: {
      whatsappUnderstanding: '',
      bestContactTime: '',
      communityGroupStatus: 'unknown',
      ...(details.communication || {}),
    },
    actions: {
      ...(details.actions || {}),
    },
    adminFollowUpNote: details.adminFollowUpNote || '',
  };
}

function getRecordScore(record) {
  return calculateUnderstandingScore({ ...record.state.details, adminFollowUpNote: record.state.details.adminFollowUpNote });
}

function hasSavedWorkflowState(record) {
  return Boolean(record?.state?.updatedAt || record?.state?.recordId);
}

function hasUnderstandingAssessment(record) {
  const understanding = record?.state?.details?.understanding || {};
  return Object.values(understanding).some((area) => `${area?.understands || ''}`.trim());
}

function hasWorkflowActivity(record) {
  const details = record?.state?.details || {};
  const feedback = details.feedback || {};
  const communication = details.communication || {};
  const hasFeedback = Object.values(feedback).some((value) => {
    const text = Array.isArray(value) ? value.join(' ') : `${value || ''}`;
    return text.trim() && text !== 'unknown' && text !== 'none';
  });
  const hasCommunication = Object.values(communication).some((value) => {
    const text = `${value || ''}`.trim();
    return text && text !== 'unknown';
  });

  return Boolean(
    hasSavedWorkflowState(record)
    || record?.state?.workflowStatus !== 'not_started'
    || hasUnderstandingAssessment(record)
    || hasFeedback
    || hasCommunication
    || `${details.adminFollowUpNote || ''}`.trim(),
  );
}

function getRecordRiskSignals(record) {
  if (!hasWorkflowActivity(record)) {
    return [];
  }
  return deriveParentUnderstandingRiskSignals({ ...record.state.details, adminFollowUpNote: record.state.details.adminFollowUpNote });
}

function matchesQueueSearch(record, query) {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) {
    return true;
  }

  const searchableText = [
    record.student.studentName,
    record.student.parentName,
    record.student.tutor,
    record.student.mmsId,
  ].join(' ').toLowerCase();

  return searchableText.includes(trimmedQuery);
}

function buildTemplates(record) {
  const parent = firstName(record.student.parentName);
  const student = firstName(record.student.studentName);
  const dashboardUrl = record.student.dashboardUrl || `/admin/students/${record.student.mmsId}`;

  return {
    cancellations: `Hi ${parent}, lovely speaking with you. Here's a quick summary of how missed lessons and holidays work:\n\n${CANCELLATION_POLICY_RECAP}\n\nFull policy is here: https://firstchord.co.uk/handbook\n\nIf anything feels unclear, just ask.`,
    dashboardSoundslice: `Hi ${parent}, here's a quick reminder on accessing ${student}'s Student Dashboard: ${dashboardUrl}\n\nInside you'll find practice notes, song materials, and progress updates. If you ever have trouble accessing it, just message and we'll help straight away.`,
    practiceNotes: `Hi ${parent}, just confirming that practice notes are sent via email after each lesson. If you're not seeing them, please check spam or let us know and we'll resend them.\n\nWe also recommend bookmarking ${student}'s dashboard so you can quickly access practice notes and song material from anywhere: ${dashboardUrl}`,
    showcases: `Hi ${parent}, just to recap, we run two free Student Showcases each year. All students are welcome to perform in a supportive environment. Dates are announced via newsletter and the WhatsApp community.\n\nDo let us know if you're not in the First Chord community group.`,
    whatsappGroups: `Hi ${parent}, just to recap how we usually communicate: the small WhatsApp group with the tutor, parents, Finn and Tom is for most lesson/admin messages, and the main First Chord community group is for bigger school-wide announcements. We’ll keep important information in the relevant group so it’s easy to find.\n\nFirst Chord Community Group: ${WHATSAPP_COMMUNITY_INVITE_URL}`,
    noAnswer: `Hi ${parent}, it's Fenella from First Chord. I was just trying to catch you for a quick check-in about ${student}'s lessons and to make sure you have all the useful lesson information. Let me know if there's a better time to call.`,
  };
}

function deriveNextActions(record) {
  const details = record.state.details || {};
  const understanding = details.understanding || {};
  const communication = details.communication || {};
  const actions = details.actions || {};
  const nextActions = [];

  if (understanding.cancellations?.understands && understanding.cancellations.understands !== 'yes' && !actions.policyInfoSent) {
    nextActions.push('Send the cancellation/holiday policy recap.');
  }
  if (understanding.dashboardSoundslice?.understands && understanding.dashboardSoundslice.understands !== 'yes' && !actions.dashboardLinkSent) {
    nextActions.push('Send the student dashboard link and check whether access help is needed.');
  }
  if (understanding.practiceNotes?.understands && understanding.practiceNotes.understands !== 'yes' && !actions.practiceNotesIssueFlagged) {
    nextActions.push('Confirm the parent email used in MMS and flag any practice-note delivery issue for Fenella to fix.');
  }
  if (understanding.showcases?.understands && understanding.showcases.understands !== 'yes' && !actions.showcaseInfoSent) {
    nextActions.push('Send the showcase recap.');
  }
  if (communication.whatsappUnderstanding && communication.whatsappUnderstanding !== 'yes') {
    nextActions.push('Explain the small tutor WhatsApp group and the wider community announcement group.');
  }
  if (communication.communityGroupStatus === 'not_in_group') {
    nextActions.push('Send the First Chord community group invite and mark follow-up needed until joined or declined.');
  }
  if (`${details.adminFollowUpNote || ''}`.trim()) {
    nextActions.push('Resolve the admin follow-up note before closing this loop.');
  }

  if (!nextActions.length) {
    nextActions.push('No obvious follow-up from the current answers.');
  }

  return nextActions;
}

function QueueItem({ record, selected, onSelect }) {
  const score = getRecordScore(record);
  const signals = getRecordRiskSignals(record);
  const hasActivity = hasWorkflowActivity(record);

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
          {hasActivity ? `${score.total}/8` : 'Not assessed'}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
          {labelFor(PARENT_UNDERSTANDING_STATUS_OPTIONS, record.state.workflowStatus)}
        </span>
        {signals.length ? (
          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">{signals.length} signal{signals.length === 1 ? '' : 's'}</span>
        ) : null}
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
  const [copiedTemplate, setCopiedTemplate] = useState('');

  const selectedRecord = records.find((record) => record.student.mmsId === selectedMmsId) || records[0] || null;
  const score = selectedRecord ? getRecordScore(selectedRecord) : calculateUnderstandingScore({});
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
    if (filter === 'not_started') return record.state.workflowStatus === 'not_started' && !hasActivity;
    if (!hasActivity) return false;
    return record.state.workflowStatus === filter;
  }), [records, filter, query]);

  const completedCount = records.filter((record) => record.state.workflowStatus === 'completed').length;
  const followUpCount = records.filter((record) => ['needs_follow_up', 'escalate_to_admin'].includes(record.state.workflowStatus)).length;

  function updateSelected(updater) {
    setRecords((current) => current.map((record) => {
      if (record.student.mmsId !== selectedRecord.student.mmsId) {
        return record;
      }
      return updater(record);
    }));
  }

  function updateState(patch) {
    updateSelected((record) => ({
      ...record,
      state: {
        ...record.state,
        ...patch,
      },
    }));
  }

  function updateDetails(patch) {
    updateSelected((record) => ({
      ...record,
      state: {
        ...record.state,
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

  async function saveRecord() {
    setSaveState({ pending: true, error: '', savedAt: '' });
    const nextScore = getRecordScore(selectedRecord);
    const nextSignals = getRecordRiskSignals(selectedRecord);

    try {
      const response = await fetch('/api/admin/parent-understanding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentMmsId: selectedRecord.student.mmsId,
          studentName: selectedRecord.student.studentName,
          parentName: selectedRecord.student.parentName,
          workflowStatus: selectedRecord.state.workflowStatus,
          loopStatus: selectedRecord.state.loopStatus,
          callAttemptCount: selectedRecord.state.callAttemptCount,
          lastContactedAt: selectedRecord.state.lastContactedAt,
          details: selectedRecord.state.details,
          summary: selectedRecord.state.summary,
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
          <p className="mt-2 text-sm text-slate-600">Saved records marked for follow-up or escalation.</p>
        </div>
        <div className={cardClasses()}>
          <p className="text-sm text-slate-500">Selected score</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{score.total} / {score.max}</p>
          <p className="mt-2 text-sm text-slate-600">{score.labelText}</p>
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
                  onSelect={() => setSelectedMmsId(record.student.mmsId)}
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
          <section className={cardClasses()}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{selectedRecord.student.studentName}</h3>
                <p className="mt-1 text-sm text-slate-600">{selectedRecord.student.parentName || 'Parent not recorded'}</p>
              </div>
              <Link
                href={`/admin/students/${selectedRecord.student.mmsId}`}
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
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Workflow status</FieldLabel>
                <select
                  value={selectedRecord.state.workflowStatus}
                  onChange={(event) => updateState({ workflowStatus: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {PARENT_UNDERSTANDING_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Loop status</FieldLabel>
                <select
                  value={selectedRecord.state.loopStatus}
                  onChange={(event) => updateState({ loopStatus: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {PARENT_UNDERSTANDING_LOOP_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
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
                onClick={saveRecord}
                disabled={saveState.pending}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
              >
                {saveState.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save record
              </button>
              {saveState.savedAt ? <span className="text-sm text-emerald-700">Saved at {saveState.savedAt}</span> : null}
              {saveState.error ? <span className="text-sm text-red-700">{saveState.error}</span> : null}
            </div>
          </section>
        </main>

        <aside className={cardClasses('h-fit space-y-5')}>
          <section>
            <h3 className="text-lg font-semibold text-slate-900">Fixes & Templates</h3>
            <p className="mt-1 text-sm text-slate-600">Copy only what is useful during or after the call.</p>
          </section>

          <section className="space-y-2">
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
