'use client';

import Link from 'next/link';
import { Check, Loader2, Pencil, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PLANNING_ITEM_TYPES,
  SCHOOL_FORWARD_PLANNING_ID,
  MONDAY_SCHEDULE_PLANNING_ID,
  buildReflectionIntentionDismissalNote,
  buildSchoolForwardReflections,
  calculateFridayReviewDate,
  calculateNextMeetingDate,
  extractDismissedReflectionIntentions,
  extractReflectionIntentions,
  getLatestSchoolForwardReflectionNote,
  buildPauseLessonDateSuggestions,
  flagNearbyPauses,
  isMeetingPlanningItem,
  labelPlanningType,
  normaliseReflectionIntentionKey,
  parseLinkedStudentIds,
} from '@/lib/admin/planning-helpers.mjs';
import {
  cardClasses,
  formatDateTime,
  extractPauseDatesFromPlanningItem,
  isPausePlanningItem,
  isDueNowPlanningItem,
  isOpenPlanningItem,
  getPlanningStory,
  getPlanningWhatToDo,
  dueChipLabel,
  hasPlanningLink,
  findStudentById,
  buildSearchText,
  hasPausePaymentConfirmation,
  buildSchoolNoteItem,
  SCHOOL_NOTE_TYPES,
  PAUSE_PAYMENT_CONFIRMATION_NOTE,
  EMPTY_FORM,
  buildQuickCaptureItem,
} from '@/lib/admin/planning-client-helpers.mjs';
import { ExpandableText } from './planning/fields';
import MondayIntentionRow from './planning/MondayIntentionRow';
import SchoolNoteCapture from './planning/SchoolNoteCapture';
import ItemForm from './planning/ItemForm';
import QuickBrainCapture from './planning/QuickBrainCapture';
import PlanningCard from './planning/PlanningCard';

const STATUS_GROUPS = [
  { key: 'inbox', title: 'Inbox', hint: 'Fresh thoughts to review later.' },
  { key: 'active', title: 'Active', hint: 'Chosen work with a current next action.' },
  { key: 'waiting', title: 'Waiting', hint: 'Blocked by a reply, decision, or real-world test.' },
  { key: 'parked', title: 'Parked', hint: 'Worth keeping, but not current.' },
  { key: 'done', title: 'Done', hint: 'Completed or absorbed into normal workflow.' },
];

const PRIMARY_REVIEW_FILTERS = [
  { value: 'due_now', label: 'Due today' },
  { value: 'all', label: 'All' },
];

const ADVANCED_REVIEW_FILTERS = [
  { value: '', label: 'More filters' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'school_notes', label: 'School notes' },
  { value: 'learning_note', label: 'Learning notes' },
  { value: 'strategic_note', label: 'Strategic notes' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'no_next_action', label: 'No next action' },
  { value: 'waiting_status', label: 'Waiting' },
  { value: 'linked', label: 'Linked' },
  { value: 'stalled', label: 'Stalled' },
  { value: 'moving', label: 'Moving' },
  { value: 'initiative', label: 'Initiatives' },
  { value: 'idea', label: 'Ideas' },
  { value: 'action', label: 'Actions' },
  { value: 'done', label: 'Done' },
  { value: 'parked', label: 'Parked' },
];

const EMPTY_SCHOOL_NOTE_FORM = {
  noteKind: 'learning_note',
  title: '',
  owner: 'Unassigned',
  status: 'active',
  area: 'learning',
  mainNote: '',
  keyIdeas: '',
  applications: '',
  nextAction: '',
};

const PAUSE_EXPECTATION_SET_NOTE = 'Set Stripe paused expected from linked pause planning item.';
const PAUSE_COMPLETED_NOTE = 'Pause completed from Planning: pause tool run, parent confirmation sent, and payment expectation aligned.';

// Calm, focused card for the "due today" view. Shows a plain-language headline +
// next step + minimal meta, with one obvious action. Deeper work (and the full
// pause toolkit) lives behind "Details", which renders the full PlanningCard with
// every handler passed through — so the pause checklist, the side-screen pause
// tool, and the copy-message button all still work.
function DueTodayCard({
  item,
  studentOptions = [],
  paymentExpectationOverrides = {},
  onStatus,
  onArchive,
  onEdit,
  onProgress,
  onPauseCompleted,
  onRepairPauseDetails,
  onOpenPauseTool,
  onOpenWorkflowPanel,
  onCreateLinkedAction,
  onDefer,
  pendingId,
  nearbyPause = null,
}) {
  const isPause = isPausePlanningItem(item);
  const [expanded, setExpanded] = useState(false);
  const story = getPlanningStory(item, studentOptions);
  const whatToDo = getPlanningWhatToDo(item);
  const due = dueChipLabel(item.targetDate);
  const overdue = due.startsWith('Overdue');
  const isPending = pendingId === item.planningId;

  return (
    <article className={`rounded-2xl border bg-white p-5 shadow-sm ${overdue ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${overdue ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
            {due}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {item.owner && item.owner !== 'Unassigned' ? item.owner : 'Unassigned'}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onArchive?.(item)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      <h3 className="mt-2 text-base font-semibold text-slate-900">{story}</h3>
      {!isPause && whatToDo ? <p className="mt-1 text-sm leading-6 text-slate-600">{whatToDo}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {!isPause && (
          <button
            type="button"
            onClick={() => onStatus(item, 'done')}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Mark done
          </button>
        )}
        <button
          type="button"
          onClick={() => onDefer(item)}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Defer until next meeting
        </button>
        {!isPause && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {expanded ? 'Hide details' : 'Details'}
          </button>
        )}
      </div>

      {/* Pause cards show the steps inline (unhidden, minus the noise); other
          cards reveal the full card under Details. Both use compact mode. */}
      {isPause || expanded ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <PlanningCard
            item={item}
            studentOptions={studentOptions}
            paymentExpectationOverrides={paymentExpectationOverrides}
            onStatus={onStatus}
            onArchive={onArchive}
            onEdit={onEdit}
            onProgress={onProgress}
            onPauseCompleted={onPauseCompleted}
            onRepairPauseDetails={onRepairPauseDetails}
            onOpenPauseTool={onOpenPauseTool}
            onOpenWorkflowPanel={onOpenWorkflowPanel}
            onCreateLinkedAction={onCreateLinkedAction}
            pendingId={pendingId}
            nearbyPause={nearbyPause}
            compact
          />
        </div>
      ) : null}
    </article>
  );
}

// One "next improvement" from Friday's reflection on the Monday panel. Click to
// expand into a small editor (shape the title, add a note, pick an owner and a
// do-by) before it becomes a planning card — rather than scheduling the raw line.
export default function AdminPlanningPageClient({ initialPlanning, initialFilter = 'all', studentOptions = [] }) {
  const [planning, setPlanning] = useState(initialPlanning || { items: [], summary: {} });
  const [quickNote, setQuickNote] = useState('');
  const [quickOptions, setQuickOptions] = useState({});
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [schoolNoteForm, setSchoolNoteForm] = useState(EMPTY_SCHOOL_NOTE_FORM);
  const [schoolNotesOpen, setSchoolNotesOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saveState, setSaveState] = useState({ pending: false, error: '', savedAt: '' });
  const [pendingId, setPendingId] = useState('');
  const [paymentExpectationOverrides, setPaymentExpectationOverrides] = useState({});
  const [scheduledIntentions, setScheduledIntentions] = useState({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(initialFilter);
  const [showDone, setShowDone] = useState(false);
  // { url, name } when the pause-tool side window is open; null when closed.
  const [pauseToolPanel, setPauseToolPanel] = useState(null);
  const [workflowPanel, setWorkflowPanel] = useState(null);

  useEffect(() => {
    if (!pauseToolPanel && !workflowPanel) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') {
        setPauseToolPanel(null);
        setWorkflowPanel(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pauseToolPanel, workflowPanel]);
  const editPanelRef = useRef(null);

  useEffect(() => {
    if (editingItem && editPanelRef.current) {
      editPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editingItem]);

  // Passive "noticing" aid: which open pause cards sit next to another pause for the
  // same student (so they might be one longer break). Read-only — no merging.
  const nearbyPauseFlags = useMemo(() => {
    const entries = (planning.items || [])
      .filter((item) => isOpenPlanningItem(item) && isPausePlanningItem(item))
      .map((item) => {
        const { startDate, endDate } = extractPauseDatesFromPlanningItem(item);
        return { planningId: item.planningId, studentId: item.linkedStudentId, start: startDate, end: endDate };
      });
    return flagNearbyPauses(entries);
  }, [planning.items]);

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (planning.items || []).filter((item) => {
      if (!showDone && !['done', 'parked'].includes(filter) && ['done', 'parked'].includes(item.status)) {
        return false;
      }
      if (search && !buildSearchText(item).includes(search)) {
        return false;
      }
      if (filter === 'due_now') {
        return isDueNowPlanningItem(item);
      }
      if (filter === 'meeting') {
        return isMeetingPlanningItem(item);
      }
      if (filter === 'school_notes') {
        return SCHOOL_NOTE_TYPES.has(item.itemType);
      }
      if (filter === 'unassigned') {
        return isOpenPlanningItem(item) && item.owner === 'Unassigned';
      }
      if (filter === 'waiting_status') {
        return isOpenPlanningItem(item) && item.status === 'waiting';
      }
      if (filter === 'linked') {
        return isOpenPlanningItem(item) && hasPlanningLink(item);
      }
      if (filter === 'all') {
        return true;
      }
      if (filter === 'done') {
        return item.status === 'done';
      }
      if (filter === 'parked') {
        return item.status === 'parked';
      }
      if (PLANNING_ITEM_TYPES.includes(filter)) {
        return item.itemType === filter;
      }
      return item.momentum === filter;
    });
  }, [planning.items, query, filter, showDone]);

  // `silent` skips the pending/savedAt/pendingId bookkeeping so a multi-step
  // action (e.g. completing a pause) can own that state across several calls
  // without the button flickering enabled between steps.
  async function postPlanning(payload, targetId = '', { silent = false } = {}) {
    if (!silent) {
      setSaveState({ pending: true, error: '', savedAt: '' });
      setPendingId(targetId);
    }
    const response = await fetch('/api/admin/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Planning save failed');
    }

    setPlanning(data.planning);
    if (!silent) {
      setSaveState({
        pending: false,
        error: '',
        savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      });
      setPendingId('');
    }
    return data.planning;
  }

  async function handleCapture(event) {
    event.preventDefault();
    const rawNote = quickNote.trim();
    if (!rawNote) {
      setSaveState({ pending: false, error: 'Write a note before capturing.', savedAt: '' });
      return;
    }

    const item = buildQuickCaptureItem(rawNote, quickOptions, studentOptions);

    try {
      await postPlanning({
        mode: 'save',
        item,
        progressNote: item.progressNote,
      });
      setQuickNote('');
      setQuickOptions({});
      setQuickExpanded(false);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleSchoolNoteCapture(event) {
    event.preventDefault();
    const item = buildSchoolNoteItem(schoolNoteForm);
    if (!item.title || !item.notes) {
      setSaveState({ pending: false, error: 'Add a title and main note before saving.', savedAt: '' });
      return;
    }

    try {
      await postPlanning({
        mode: 'save',
        item,
        progressNote: item.progressNote,
      });
      setSchoolNoteForm(EMPTY_SCHOOL_NOTE_FORM);
      setFilter('school_notes');
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleCreateLinkedAction(item) {
    const title = `${item.nextAction || ''}`.trim();
    if (!title) {
      setSaveState({ pending: false, error: 'Add a next action before creating a linked action.', savedAt: '' });
      return;
    }

    try {
      await postPlanning({
        mode: 'save',
        item: {
          title,
          notes: `Created from ${item.itemTypeLabel || labelPlanningType(item.itemType)}: ${item.title}`,
          itemType: 'action',
          owner: item.owner || 'Unassigned',
          status: 'active',
          area: item.area || 'other',
          parentPlanningId: item.planningId,
          nextAction: title,
        },
        progressNote: `Created linked action from: ${item.title}`,
      }, item.planningId);

      await postPlanning({
        mode: 'progress',
        planningId: item.planningId,
        progressNote: `Created linked action: ${title}`,
        progressType: 'decision',
        nextAction: item.nextAction,
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  // Monday review: turn one "next improvement" intention from Friday's reflection
  // into a dated, owned action item linked back to the reflection. The row's
  // editor supplies the shaped title/notes/owner/do-by; we key the scheduled
  // state by the original intention line so it flips even if the title was edited.
  async function handleScheduleIntention(intention, { title, notes, owner, targetDate } = {}) {
    const cleanTitle = `${title || ''}`.trim();
    if (!cleanTitle) {
      return;
    }
    try {
      await postPlanning({
        mode: 'save',
        item: {
          title: cleanTitle,
          notes: [
            `Friday intention: ${intention}`,
            `${notes || ''}`.trim(),
          ].filter(Boolean).join('\n'),
          itemType: 'action',
          owner: owner || 'Unassigned',
          status: 'active',
          area: 'other',
          parentPlanningId: SCHOOL_FORWARD_PLANNING_ID,
          targetDate: targetDate || calculateFridayReviewDate(new Date()),
          progressNote: 'Scheduled from Friday reflection.',
        },
        progressNote: 'Scheduled from Friday reflection.',
      });
      setScheduledIntentions((current) => ({
        ...current,
        [normaliseReflectionIntentionKey(intention || cleanTitle)]: { targetDate: targetDate || calculateFridayReviewDate(new Date()) },
      }));
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleDismissIntention(intention) {
    if (!mondayItem?.planningId) {
      return;
    }
    try {
      await postPlanning({
        mode: 'progress',
        planningId: mondayItem.planningId,
        progressNote: buildReflectionIntentionDismissalNote(intention),
        progressType: 'decision',
        nextAction: mondayItem.nextAction,
      }, mondayItem.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handlePauseCapture(rawNote, overrides) {
    const note = (rawNote || '').trim();
    if (!note) {
      setSaveState({ pending: false, error: 'Add the pause details before capturing.', savedAt: '' });
      return;
    }
    const item = buildQuickCaptureItem(note, overrides, studentOptions);
    try {
      await postPlanning({
        mode: 'save',
        item,
        progressNote: item.progressNote,
      });
      setQuickNote('');
      setQuickOptions({});
      setQuickExpanded(false);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleTutorAbsenceCapture(tutorShortName, dates) {
    setSaveState({ pending: true, error: '', savedAt: '' });
    try {
      const response = await fetch('/api/admin/planning/tutor-absence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorShortName, dates }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Tutor absence capture failed');
      }
      setPlanning(data.planning);
      setQuickNote('');
      setQuickOptions({});
      setQuickExpanded(false);
      setSaveState({
        pending: false,
        error: '',
        savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
    }
  }

  function startEdit(item) {
    setEditingItem(item);
    setEditForm({
      ...EMPTY_FORM,
      title: item.title,
      notes: item.notes,
      itemType: item.itemType,
      owner: item.owner,
      status: item.status,
      area: item.area,
      linkedWorkflowId: item.linkedWorkflowId,
      linkedStudentId: item.linkedStudentId,
      linkedStudentIds: parseLinkedStudentIds(item.linkedStudentIds ?? item.linkedStudentId),
      linkedTutorId: item.linkedTutorId,
      parentPlanningId: item.parentPlanningId,
      outcome: item.outcome,
      nextAction: item.nextAction,
      targetDate: item.targetDate,
    });
  }

  async function handleEdit(event) {
    event.preventDefault();
    if (!editingItem) {
      return;
    }

    try {
      await postPlanning({
        mode: 'save',
        planningId: editingItem.planningId,
        item: editForm,
        progressNote: editForm.progressNote,
      }, editingItem.planningId);
      setEditingItem(null);
      setEditForm(EMPTY_FORM);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleStatus(item, status) {
    try {
      await postPlanning({
        mode: 'status',
        planningId: item.planningId,
        status,
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleArchiveItem(item) {
    const confirmed = window.confirm('Remove this planning card from active planning? It will be parked, not deleted, so the history stays available.');
    if (!confirmed) return;

    try {
      await postPlanning({
        mode: 'status',
        planningId: item.planningId,
        status: 'parked',
        progressNote: 'Removed from active Planning board by admin.',
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  // Push an item's "do by" to the next meeting day (Mon/Thu/Fri), used by the
  // calm due-today view. A save merges over the existing row, so only title +
  // targetDate need to be sent.
  async function handleDefer(item) {
    const tomorrow = new Date();
    tomorrow.setHours(12, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMeeting = calculateNextMeetingDate(tomorrow);
    try {
      await postPlanning({
        mode: 'save',
        planningId: item.planningId,
        item: { title: item.title, targetDate: nextMeeting },
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleProgress(item, { progressNote, nextAction }) {
    try {
      await postPlanning({
        mode: 'progress',
        planningId: item.planningId,
        progressNote,
        progressType: 'note',
        nextAction,
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message, savedAt: '' });
      setPendingId('');
    }
  }

  async function handleRepairPauseDetails(item, { draft, linkedStudentId }) {
    if (!draft?.isComplete) {
      setSaveState({ pending: false, error: 'Add the missing pause date details before saving.', savedAt: '' });
      return;
    }

    try {
      await postPlanning({
        mode: 'save',
        planningId: item.planningId,
        item: {
          ...item,
          title: draft.title,
          notes: draft.notes,
          itemType: 'action',
          status: item.status === 'inbox' ? 'active' : item.status,
          area: 'admin',
          linkedStudentId: linkedStudentId || item.linkedStudentId,
          targetDate: draft.targetDate || item.targetDate,
          nextAction: draft.nextAction,
        },
        progressNote: draft.progressNote || 'Added structured pause dates to existing planning item.',
      }, item.planningId);
    } catch (error) {
      setSaveState({ pending: false, error: error.message || 'Pause date repair failed', savedAt: '' });
      setPendingId('');
    }
  }

  async function handlePauseCompleted(item) {
    if (!item.linkedStudentId) {
      setSaveState({ pending: false, error: 'Link a student before completing a pause task.', savedAt: '' });
      return;
    }

    try {
      setSaveState({ pending: true, error: '', savedAt: '' });
      setPendingId(item.planningId);

      if (!hasPausePaymentConfirmation(item)) {
        await postPlanning({
          mode: 'progress',
          planningId: item.planningId,
          progressNote: PAUSE_PAYMENT_CONFIRMATION_NOTE,
          progressType: 'action_completed',
          nextAction: item.nextAction,
        }, item.planningId, { silent: true });
      }

      const linkedStudent = findStudentById(studentOptions, item.linkedStudentId);
      const currentExpectation = paymentExpectationOverrides[item.linkedStudentId] || linkedStudent?.paymentExpectation || '';
      if (currentExpectation !== 'stripe_paused_expected') {
        const response = await fetch(`/api/admin/students/${encodeURIComponent(item.linkedStudentId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentExpectation: 'stripe_paused_expected',
            auditContext: {
              source: 'admin_pause_workflow_action',
              actionLabel: 'Complete pause from Planning',
              note: `Linked planning item: ${item.title}`,
            },
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Pause expectation update failed');
        }

        await postPlanning({
          mode: 'progress',
          planningId: item.planningId,
          progressNote: PAUSE_EXPECTATION_SET_NOTE,
          progressType: 'action_completed',
          nextAction: item.nextAction,
        }, item.planningId, { silent: true });
        setPaymentExpectationOverrides((current) => ({
          ...current,
          [item.linkedStudentId]: 'stripe_paused_expected',
        }));
      }

      await postPlanning({
        mode: 'status',
        planningId: item.planningId,
        status: 'done',
        progressNote: PAUSE_COMPLETED_NOTE,
        progressType: 'action_completed',
        nextAction: item.nextAction,
      }, item.planningId, { silent: true });

      // Clear the shared pending/pendingId once, after all steps — the button stays
      // in "Completing…" the whole time instead of flickering between calls.
      setSaveState({
        pending: false,
        error: '',
        savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      });
      setPendingId('');
    } catch (error) {
      setSaveState({ pending: false, error: error.message || 'Pause completion failed', savedAt: '' });
      setPendingId('');
    }
  }

  const summary = planning.summary || {};
  const schoolForwardReflections = useMemo(
    () => buildSchoolForwardReflections(planning.items || [], { limit: 6 }),
    [planning.items],
  );

  const mondayItem = useMemo(
    () => (planning.items || []).find((item) => item.planningId === MONDAY_SCHEDULE_PLANNING_ID) || null,
    [planning.items],
  );
  const latestReflectionNote = useMemo(
    () => getLatestSchoolForwardReflectionNote(planning.items || []),
    [planning.items],
  );
  const reflectionIntentions = useMemo(
    () => extractReflectionIntentions(latestReflectionNote?.progressNote || ''),
    [latestReflectionNote],
  );
  const dismissedIntentions = useMemo(
    () => extractDismissedReflectionIntentions(mondayItem || {}),
    [mondayItem],
  );
  // Intentions already turned into linked action items (so they don't get
  // re-scheduled across reloads), keyed by lowercased title → the card's do-by.
  const alreadyScheduledByTitle = useMemo(() => {
    const map = new Map();
    for (const item of planning.items || []) {
      if (item.parentPlanningId === SCHOOL_FORWARD_PLANNING_ID && `${item.title || ''}`.trim()) {
        map.set(normaliseReflectionIntentionKey(item.title), { targetDate: item.targetDate || '' });
        const intentionLine = `${item.notes || ''}`.split(/\r?\n/u)
          .find((line) => /^Friday intention:/iu.test(line.trim()));
        const sourceIntention = intentionLine ? intentionLine.replace(/^Friday intention:\s*/iu, '') : '';
        const sourceKey = normaliseReflectionIntentionKey(sourceIntention);
        if (sourceKey) {
          map.set(sourceKey, { targetDate: item.targetDate || '' });
        }
      }
    }
    return map;
  }, [planning.items]);
  const openReflectionIntentions = useMemo(() => reflectionIntentions.filter((intention) => {
    const key = normaliseReflectionIntentionKey(intention);
    const sessionEntry = scheduledIntentions[key];
    const existing = alreadyScheduledByTitle.get(key);
    return !sessionEntry && !existing && !dismissedIntentions.has(key);
  }), [alreadyScheduledByTitle, dismissedIntentions, reflectionIntentions, scheduledIntentions]);
  const mondayDefaultDueDate = useMemo(() => calculateFridayReviewDate(new Date()), []);
  const mondayReviewOpen = Boolean(
    mondayItem
    && !['done', 'parked'].includes(mondayItem.status)
    && openReflectionIntentions.length > 0,
  );

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Planning inbox</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Planning
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Capture ideas quickly, turn chosen work into initiatives, and keep momentum visible through next actions and progress notes.
        </p>
      </section>

      {mondayReviewOpen ? (
        <section className="rounded-[1.2rem] border border-blue-100 bg-blue-50/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Monday scheduling</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">Schedule what we said we’d work on</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                From Friday’s reflection ({formatDateTime(latestReflectionNote.createdAt)}). Turn each “next improvement” into a dated, owned task — each gets a “Do by” of this Friday and links back to the reflection.
              </p>
            </div>
            <Link
              href="/admin/planning?filter=meeting"
              className="whitespace-nowrap rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50"
            >
              Meeting view
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {openReflectionIntentions.map((intention) => (
              <MondayIntentionRow
                key={intention}
                intention={intention}
                defaultDueDate={mondayDefaultDueDate}
                onSchedule={(values) => handleScheduleIntention(intention, values)}
                onDismiss={handleDismissIntention}
                pending={saveState.pending}
              />
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Scheduled items appear on the board as dated actions. Mark the Monday card done once you’ve scheduled this week’s work.
          </p>
        </section>
      ) : null}

      {filter === 'meeting' ? (
        <section className="rounded-[1.2rem] border border-emerald-100 bg-emerald-50/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Meeting rhythm</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Keep things running</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                Clear dated work, pauses, tutor absences, waiting items, and unresolved admin loops quickly.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Move the school forward</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                Protect time for one useful improvement, decision, or learning from the week, especially on Friday.
              </p>
            </div>
          </div>
          {schoolForwardReflections.length ? (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Recent Friday reflections</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Dated progress entries from the weekly school-forward prompt. This is the raw material for monthly or quarterly summaries.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  {schoolForwardReflections.length} recent
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {schoolForwardReflections.map((reflection) => (
                  <div key={reflection.progressId} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500">{formatDateTime(reflection.createdAt)}</p>
                    <ExpandableText text={reflection.progressNote} className="mt-1 text-sm leading-6 text-slate-700" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-white/70 p-4">
              <h3 className="text-base font-semibold text-slate-900">Friday reflections</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Add reflections to the Friday prompt and they will appear here as a dated record of what moved forward.
              </p>
            </div>
          )}
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-5">
        {[
          ['Open planning', summary.open || 0],
          ['Active', summary.active || 0],
          ['Inbox', summary.inbox || 0],
          ['School notes', summary.activeSchoolNotes || 0],
          ['No next action', summary.noNextAction || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className={cardClasses('border-violet-100 bg-violet-50/50')}>
        <button
          type="button"
          onClick={() => setSchoolNotesOpen((open) => !open)}
          aria-expanded={schoolNotesOpen}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Let&apos;s work on the school</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Learning notes, transcript summaries, and strategic scratchpad thoughts.{' '}
              {schoolNotesOpen ? 'Tap to hide.' : 'Tap to open — kept tucked away so planning stays quick.'}
            </p>
          </div>
          <span
            aria-hidden="true"
            className={`shrink-0 text-xl text-violet-700 transition-transform ${schoolNotesOpen ? 'rotate-90' : ''}`}
          >
            ›
          </span>
        </button>
        {schoolNotesOpen ? (
          <>
            <div className="mt-4 flex justify-end">
              <Link
                href="/admin/planning?filter=school_notes"
                className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-900 hover:bg-violet-50"
              >
                View school notes
              </Link>
            </div>
            <div className="mt-3 rounded-2xl border border-violet-100 bg-white/90 p-4">
              <SchoolNoteCapture
                form={schoolNoteForm}
                onChange={setSchoolNoteForm}
                onSubmit={handleSchoolNoteCapture}
                pending={saveState.pending && !pendingId}
              />
            </div>
          </>
        ) : null}
      </section>

      <section className={cardClasses()}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Brain capture</h3>
            <p className="mt-1 text-sm text-slate-600">One box for the stuff that would usually disappear in WhatsApp.</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Add dates when you can. Pauses, cancellations, and tutor absences should usually be done before the lesson day. Review rhythm: Monday, Thursday, Friday.
            </p>
          </div>
          {saveState.savedAt && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Saved {saveState.savedAt}
            </span>
          )}
        </div>
        {saveState.error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveState.error}</p>
        )}
        <div className="mt-5">
          <QuickBrainCapture
            rawNote={quickNote}
            setRawNote={setQuickNote}
            options={quickOptions}
            setOptions={setQuickOptions}
            studentOptions={studentOptions}
            expanded={quickExpanded}
            setExpanded={setQuickExpanded}
            onSubmit={handleCapture}
            onTutorAbsenceCapture={handleTutorAbsenceCapture}
            onPauseCapture={handlePauseCapture}
            pending={saveState.pending && !pendingId}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className={cardClasses()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Review</h3>
              <p className="mt-1 text-sm text-slate-600">Start with what is due today, or scan the open board.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {PRIMARY_REVIEW_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    filter === option.value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <select
                value={PRIMARY_REVIEW_FILTERS.some((option) => option.value === filter) ? '' : filter}
                onChange={(event) => {
                  if (event.target.value) setFilter(event.target.value);
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {ADVANCED_REVIEW_FILTERS.map((option) => (
                  <option key={option.value || 'more'} value={option.value}>{option.label}</option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={showDone}
                  onChange={(event) => setShowDone(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                Show done/parked
              </label>
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, owner, area, workflow, student, tutor"
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="mt-5 space-y-6">
            {filter === 'due_now' ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">On today</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    What needs doing today, calmly — overdue first. Open “Details” for the full card and tools.
                  </p>
                </div>
                {[...filteredItems]
                  .sort((a, b) => `${a.targetDate || ''}`.localeCompare(`${b.targetDate || ''}`))
                  .map((item) => (
                    <DueTodayCard
                      key={item.planningId}
                      item={item}
                      studentOptions={studentOptions}
                      paymentExpectationOverrides={paymentExpectationOverrides}
                      onStatus={handleStatus}
                      onArchive={handleArchiveItem}
                      onEdit={startEdit}
                      onProgress={handleProgress}
                      onPauseCompleted={handlePauseCompleted}
                      onRepairPauseDetails={handleRepairPauseDetails}
                      onOpenPauseTool={(url, name) => setPauseToolPanel({ url, name })}
                      onOpenWorkflowPanel={setWorkflowPanel}
                      onCreateLinkedAction={handleCreateLinkedAction}
                      onDefer={handleDefer}
                      pendingId={pendingId}
                      nearbyPause={nearbyPauseFlags.get(item.planningId)}
                    />
                  ))}
              </div>
            ) : STATUS_GROUPS.map((group) => {
              const groupItems = filteredItems.filter((item) => item.status === group.key);
              if (!groupItems.length) {
                return null;
              }

              return (
                <section key={group.key}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{group.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">{group.hint}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {groupItems.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {groupItems.map((item) => (
                      <PlanningCard
                        key={item.planningId}
                        item={item}
                        studentOptions={studentOptions}
                        paymentExpectationOverrides={paymentExpectationOverrides}
                        onStatus={handleStatus}
                        onArchive={handleArchiveItem}
                        onEdit={startEdit}
                        onProgress={handleProgress}
                        onPauseCompleted={handlePauseCompleted}
                        onRepairPauseDetails={handleRepairPauseDetails}
                        onOpenPauseTool={(url, name) => setPauseToolPanel({ url, name })}
                        onOpenWorkflowPanel={setWorkflowPanel}
                        onCreateLinkedAction={handleCreateLinkedAction}
                        pendingId={pendingId}
                        nearbyPause={nearbyPauseFlags.get(item.planningId)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {!filteredItems.length && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No planning items match this view.
              </p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className={cardClasses()}>
            <h3 className="text-base font-semibold text-slate-900">Planning context</h3>
            <Link
              href="/admin/capacity"
              className="mt-4 block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
            >
              <p className="text-sm font-semibold text-slate-900">Capacity</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Free slots, tutor availability, waiting-list placement hints, and schedule-cache health.
              </p>
            </Link>
            <Link
              href="/admin/finance"
              className="mt-3 block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
            >
              <p className="text-sm font-semibold text-slate-900">Finance</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Estimate-only run-rate, tutor costs, overhead, and margin context.
              </p>
            </Link>
            <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Tutor absence</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Start the cancel-or-cover workflow for a tutor being off.
              </p>
              <button
                type="button"
                onClick={() => setWorkflowPanel({
                  url: '/admin/workflows/tutor-absence',
                  title: 'Tutor absence',
                  eyebrow: 'Tutor absence workflow',
                })}
                className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Open workflow
              </button>
            </div>
            <Link
              href="/admin/workflows"
              className="mt-3 block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-white"
            >
              <p className="text-sm font-semibold text-slate-900">Workflows</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Waiting list, onboarding, showcase, holidays, parent understanding, and tutor absence loops.
              </p>
            </Link>
          </div>

          {editingItem && (
            <div ref={editPanelRef} className={cardClasses('sticky top-4 ring-2 ring-blue-100')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Edit item</h3>
                  <p className="mt-1 text-sm text-slate-600">{editingItem.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setEditForm(EMPTY_FORM);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  Close
                </button>
              </div>
              <div className="mt-4">
                <ItemForm
                  form={editForm}
                  onChange={setEditForm}
                  studentOptions={studentOptions}
                  onSubmit={handleEdit}
                  submitLabel="Save changes"
                  pending={pendingId === editingItem.planningId}
                />
              </div>
            </div>
          )}
        </aside>
      </section>

      {pauseToolPanel ? (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={() => setPauseToolPanel(null)}
            aria-hidden
          />
          <aside className="flex h-full w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Payment pause tool</p>
                <p className="text-sm font-semibold text-slate-900">{pauseToolPanel.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pauseToolPanel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Open in full page ↗
                </a>
                <button
                  type="button"
                  onClick={() => setPauseToolPanel(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Close ✕
                </button>
              </div>
            </header>
            <iframe
              key={pauseToolPanel.url}
              src={pauseToolPanel.url}
              title={`Payment pause tool: ${pauseToolPanel.name}`}
              className="h-full w-full flex-1 border-0"
            />
          </aside>
        </div>
      ) : null}

      {workflowPanel ? (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={() => setWorkflowPanel(null)}
            aria-hidden
          />
          <aside className="flex h-full w-full max-w-5xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{workflowPanel.eyebrow || 'Workflow'}</p>
                <p className="text-sm font-semibold text-slate-900">{workflowPanel.title || 'Workflow'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={workflowPanel.url}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Open full page
                </Link>
                <button
                  type="button"
                  onClick={() => setWorkflowPanel(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Close ✕
                </button>
              </div>
            </header>
            <iframe
              key={workflowPanel.url}
              src={workflowPanel.url}
              title={`${workflowPanel.eyebrow || 'Workflow'}: ${workflowPanel.title || 'Workflow'}`}
              className="h-full w-full flex-1 border-0"
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
