'use client';

import Link from 'next/link';
import { Check, Loader2, Pencil, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  PLANNING_AREAS,
  PLANNING_ITEM_TYPES,
  PLANNING_OWNERS,
  PLANNING_STATUSES,
  inferPlanningTargetDateFromText,
  labelPlanningArea,
  labelPlanningMomentum,
  labelPlanningStatus,
  labelPlanningType,
} from '@/lib/admin/planning-helpers.mjs';

const STATUS_GROUPS = [
  { key: 'inbox', title: 'Inbox', hint: 'Fresh thoughts to review later.' },
  { key: 'active', title: 'Active', hint: 'Chosen work with a current next action.' },
  { key: 'waiting', title: 'Waiting', hint: 'Blocked by a reply, decision, or real-world test.' },
  { key: 'parked', title: 'Parked', hint: 'Worth keeping, but not current.' },
  { key: 'done', title: 'Done', hint: 'Completed or absorbed into normal workflow.' },
];

const MOMENTUM_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'no_next_action', label: 'No Next Action' },
  { value: 'stalled', label: 'Stalled' },
  { value: 'moving', label: 'Moving' },
  { value: 'initiative', label: 'Initiatives' },
  { value: 'idea', label: 'Ideas' },
  { value: 'action', label: 'Actions' },
  { value: 'done', label: 'Done' },
];

const EMPTY_FORM = {
  title: '',
  notes: '',
  itemType: 'idea',
  owner: 'Unassigned',
  status: 'inbox',
  area: 'other',
  linkedWorkflowId: '',
  linkedStudentId: '',
  linkedTutorId: '',
  parentPlanningId: '',
  outcome: '',
  nextAction: '',
  targetDate: '',
  progressNote: '',
};

const QUICK_CAPTURE_DEFAULTS = {
  owner: 'Unassigned',
  area: 'other',
  itemType: 'action',
  status: 'inbox',
  linkedWorkflowId: '',
};

const PAUSE_PAYMENT_CONFIRMATION_NOTE = 'Payment pause confirmation message sent.';

function cardClasses(extra = '') {
  return `rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] ${extra}`;
}

function formatDateTime(value) {
  if (!value) {
    return 'Not yet';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortPreview(value = '', max = 150) {
  const text = `${value || ''}`.trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}...`;
}

function formatTargetDate(value = '') {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function firstLine(value = '') {
  return `${value || ''}`
    .split(/\n/)
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function truncateTitle(value = '', max = 90) {
  const text = firstLine(value).replace(/^[-•⁠\s]+/u, '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function inferQuickCapture(raw = '') {
  const text = `${raw || ''}`.toLowerCase();
  const defaults = { ...QUICK_CAPTURE_DEFAULTS };

  if (/\b(pause|holiday|away|off|cancel lesson|no lesson)\b/u.test(text)) {
    defaults.area = 'admin';
    defaults.itemType = 'action';
  }
  if (/\b(tutor|cover|covering|teacher)\b/u.test(text) && /\b(away|off|cover)\b/u.test(text)) {
    defaults.area = 'tutor';
    defaults.linkedWorkflowId = 'tutor-absence';
  }
  if (/\b(onboard|new student|starting|sign.?up)\b/u.test(text)) {
    defaults.area = 'admin';
    defaults.linkedWorkflowId = 'onboarding';
  }
  if (/\b(stripe|payment|billing|refund|charge|subscription|vat|payroll)\b/u.test(text)) {
    defaults.area = 'finance';
  }
  if (/\b(show|showcase|poster|venue|perform)\b/u.test(text)) {
    defaults.area = 'showcase';
    defaults.linkedWorkflowId = 'showcase';
  }
  if (/\b(dashboard|tool|website|mms|soundslice|link|bug)\b/u.test(text)) {
    defaults.area = 'tech';
  }
  if (/\b(maybe|idea|revisit|could|should|future|plan)\b/u.test(text)) {
    defaults.itemType = 'idea';
  }

  return defaults;
}

function buildQuickCaptureItem(rawNote = '', overrides = {}) {
  const inferred = inferQuickCapture(rawNote);
  const item = {
    ...EMPTY_FORM,
    ...inferred,
    ...overrides,
    title: truncateTitle(rawNote),
    notes: rawNote.trim(),
    targetDate: overrides.targetDate || inferPlanningTargetDateFromText(rawNote),
    progressNote: 'Captured from quick brain capture.',
  };

  if (item.itemType === 'action') {
    item.nextAction = item.nextAction || item.title;
  }

  return item;
}

function momentumClasses(momentum = '') {
  if (momentum === 'moving') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (momentum === 'stalled' || momentum === 'no_next_action') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  if (momentum === 'done') {
    return 'border-slate-200 bg-slate-100 text-slate-700';
  }
  if (momentum === 'parked') {
    return 'border-purple-200 bg-purple-50 text-purple-800';
  }
  return 'border-blue-100 bg-blue-50 text-slate-700';
}

function applySmartDefaults(form) {
  const next = { ...form };
  if (next.itemType === 'initiative' && next.status === 'inbox') {
    next.status = 'active';
  }
  if (next.itemType === 'action' && next.status === 'inbox') {
    next.status = 'active';
  }
  return next;
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"
      >
        {options.map((option) => {
          const valueForOption = typeof option === 'string' ? option : option.value;
          const labelForOption = typeof option === 'string' ? option : option.label;
          return (
            <option key={valueForOption} value={valueForOption}>{labelForOption}</option>
          );
        })}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange, placeholder = '' }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:text-slate-400"
      />
    </label>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800"
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange, placeholder = '', rows = 3 }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:text-slate-400"
      />
    </label>
  );
}

function buildSearchText(item) {
  return [
    item.title,
    item.notes,
    item.owner,
    item.areaLabel,
    item.statusLabel,
    item.itemTypeLabel,
    item.linkedWorkflowId,
    item.linkedStudentId,
    item.linkedTutorId,
    item.outcome,
    item.nextAction,
    item.targetDate,
    item.latestProgress?.progressNote,
  ].join(' ').toLowerCase();
}

function workflowHref(workflowId = '') {
  const key = `${workflowId || ''}`.trim().toLowerCase();
  const routes = {
    'tutor-absence': '/admin/workflows/tutor-absence',
    'parent-understanding': '/admin/workflows/parent-understanding',
    waiting: '/admin/waiting',
    onboarding: '/admin/onboard',
    showcase: '/admin/showcase',
    holidays: '/admin/holidays',
  };
  return routes[key] || '';
}

function isPausePlanningItem(item = {}) {
  return /\bpaus(?:e|ed|ing)\b/iu.test([
    item.title,
    item.notes,
    item.nextAction,
  ].join(' '));
}

function hasPausePaymentConfirmation(item = {}) {
  return (item.progress || []).some((entry) => (
    `${entry.progressNote || ''}`.toLowerCase().includes(PAUSE_PAYMENT_CONFIRMATION_NOTE.toLowerCase())
  ));
}

function ItemForm({
  form,
  onChange,
  onSubmit,
  submitLabel = 'Save',
  pending = false,
  compact = false,
}) {
  const setValue = (key, value) => onChange({ ...form, [key]: value });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Title"
        value={form.title}
        onChange={(value) => setValue('title', value)}
        placeholder="Write the thought, initiative, or next action"
      />

      <div className="grid gap-3 md:grid-cols-4">
        <SelectField
          label="Type"
          value={form.itemType}
          onChange={(value) => onChange(applySmartDefaults({ ...form, itemType: value }))}
          options={PLANNING_ITEM_TYPES.map((value) => ({ value, label: labelPlanningType(value) }))}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(value) => setValue('status', value)}
          options={PLANNING_STATUSES.map((value) => ({ value, label: labelPlanningStatus(value) }))}
        />
        <SelectField
          label="Owner"
          value={form.owner}
          onChange={(value) => setValue('owner', value)}
          options={PLANNING_OWNERS}
        />
        <SelectField
          label="Area"
          value={form.area}
          onChange={(value) => setValue('area', value)}
          options={PLANNING_AREAS.map((value) => ({ value, label: labelPlanningArea(value) }))}
        />
      </div>

      {!compact && (
        <>
          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={(value) => setValue('notes', value)}
            placeholder="Context, rough thinking, links, constraints, or why this matters"
          />
          <div className="grid gap-3 md:grid-cols-3">
            <TextField
              label="Linked Workflow"
              value={form.linkedWorkflowId}
              onChange={(value) => setValue('linkedWorkflowId', value)}
              placeholder="parent-understanding"
            />
            <TextField
              label="Linked Student"
              value={form.linkedStudentId}
              onChange={(value) => setValue('linkedStudentId', value)}
              placeholder="sdt_..."
            />
            <TextField
              label="Linked Tutor"
              value={form.linkedTutorId}
              onChange={(value) => setValue('linkedTutorId', value)}
              placeholder="Fennella"
            />
          </div>
          <TextAreaField
            label="Outcome"
            value={form.outcome}
            onChange={(value) => setValue('outcome', value)}
            placeholder="For initiatives: what finished looks like"
            rows={2}
          />
        </>
      )}

      <TextField
        label="Next Action"
        value={form.nextAction}
        onChange={(value) => setValue('nextAction', value)}
        placeholder="The next concrete step"
      />
      <DateField
        label="Do by"
        value={form.targetDate}
        onChange={(value) => setValue('targetDate', value)}
      />
      <TextAreaField
        label={compact ? 'Initial note' : 'Progress note'}
        value={form.progressNote}
        onChange={(value) => setValue('progressNote', value)}
        placeholder="Optional: what moved, what changed, or why this was captured"
        rows={2}
      />

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {submitLabel}
      </button>
    </form>
  );
}

function QuickBrainCapture({
  rawNote,
  setRawNote,
  options,
  setOptions,
  expanded,
  setExpanded,
  onSubmit,
  pending = false,
}) {
  const inferred = inferQuickCapture(rawNote);
  const inferredTargetDate = inferPlanningTargetDateFromText(rawNote);
  const effectiveOptions = {
    ...inferred,
    targetDate: inferredTargetDate,
    ...options,
  };

  function setOption(key, value) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="sr-only">Brain capture note</span>
        <textarea
          value={rawNote}
          onChange={(event) => setRawNote(event.target.value)}
          rows={5}
          autoFocus
          placeholder="Pause Coban for 7 Feb&#10;Elena away next Friday - arrange cover&#10;Idea: meet students video"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-medium leading-7 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{labelPlanningType(effectiveOptions.itemType)}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1">{labelPlanningArea(effectiveOptions.area)}</span>
          {effectiveOptions.linkedWorkflowId ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">{effectiveOptions.linkedWorkflowId}</span>
          ) : null}
          {effectiveOptions.targetDate ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">Do by {formatTargetDate(effectiveOptions.targetDate)}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {expanded ? 'Hide structure' : 'Add structure'}
        </button>
      </div>

      {expanded ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
          <SelectField
            label="Type"
            value={effectiveOptions.itemType}
            onChange={(value) => setOption('itemType', value)}
            options={PLANNING_ITEM_TYPES.map((value) => ({ value, label: labelPlanningType(value) }))}
          />
          <SelectField
            label="Owner"
            value={effectiveOptions.owner}
            onChange={(value) => setOption('owner', value)}
            options={PLANNING_OWNERS}
          />
          <SelectField
            label="Area"
            value={effectiveOptions.area}
            onChange={(value) => setOption('area', value)}
            options={PLANNING_AREAS.map((value) => ({ value, label: labelPlanningArea(value) }))}
          />
          <DateField
            label="Do by"
            value={effectiveOptions.targetDate}
            onChange={(value) => setOption('targetDate', value)}
          />
          <SelectField
            label="Status"
            value={effectiveOptions.status}
            onChange={(value) => setOption('status', value)}
            options={PLANNING_STATUSES.map((value) => ({ value, label: labelPlanningStatus(value) }))}
          />
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending || !rawNote.trim()}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Capture
      </button>
    </form>
  );
}

function PlanningCard({ item, onStatus, onEdit, onProgress, pendingId }) {
  const [progressNote, setProgressNote] = useState('');
  const [nextAction, setNextAction] = useState(item.nextAction || '');
  const isPending = pendingId === item.planningId;
  const isPauseReminder = isPausePlanningItem(item);
  const pausePaymentConfirmed = hasPausePaymentConfirmation(item);
  const linkFacts = [
    item.linkedWorkflowId ? `Workflow: ${item.linkedWorkflowId}` : '',
    item.linkedStudentId ? `Student: ${item.linkedStudentId}` : '',
    item.linkedTutorId ? `Tutor: ${item.linkedTutorId}` : '',
  ].filter(Boolean);
  const linkedWorkflowHref = workflowHref(item.linkedWorkflowId);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {item.itemTypeLabel}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${momentumClasses(item.momentum)}`}>
              {item.momentumLabel}
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
        </div>
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span>{item.owner}</span>
        <span>·</span>
        <span>{item.areaLabel}</span>
        <span>·</span>
        <span>Updated {formatDateTime(item.updatedAt || item.createdAt)}</span>
      </div>

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

      {item.targetDate ? (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <span className="font-semibold">Do by: </span>
          {formatTargetDate(item.targetDate)}
        </div>
      ) : null}

      {item.notes && <p className="mt-3 text-sm leading-6 text-slate-600">{shortPreview(item.notes)}</p>}

      {linkFacts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkFacts.map((fact) => (
            <span key={fact} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {fact}
            </span>
          ))}
        </div>
      )}

      {linkedWorkflowHref ? (
        <Link
          href={linkedWorkflowHref}
          className="mt-3 inline-flex rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white"
        >
          Open linked workflow
        </Link>
      ) : null}

      {item.latestProgress && (
        <div className="mt-4 border-l-2 border-slate-200 pl-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Latest progress</p>
          <p className="mt-1">{item.latestProgress.progressNote}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.latestProgress.createdAt)}</p>
        </div>
      )}

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

      {isPauseReminder ? (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
          <label className="flex items-start gap-2 text-sm font-medium text-amber-950">
            <input
              type="checkbox"
              checked={pausePaymentConfirmed}
              disabled={isPending || pausePaymentConfirmed}
              onChange={(event) => {
                if (event.target.checked) {
                  onProgress(item, {
                    progressNote: PAUSE_PAYMENT_CONFIRMATION_NOTE,
                    nextAction,
                  });
                }
              }}
              className="mt-1 h-4 w-4 rounded border-amber-300 text-slate-900"
            />
            <span>
              Payment pause confirmation message sent
              {!pausePaymentConfirmed ? (
                <span className="block text-xs font-normal text-amber-800">
                  Tick this before marking a pause reminder done.
                </span>
              ) : null}
            </span>
          </label>
        </div>
      ) : null}

      <form
        className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          onProgress(item, { progressNote, nextAction });
          setProgressNote('');
        }}
      >
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
        <button
          type="submit"
          disabled={isPending || !progressNote.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Log
        </button>
      </form>
    </article>
  );
}

export default function AdminPlanningPageClient({ initialPlanning }) {
  const [planning, setPlanning] = useState(initialPlanning || { items: [], summary: {} });
  const [quickNote, setQuickNote] = useState('');
  const [quickOptions, setQuickOptions] = useState({});
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saveState, setSaveState] = useState({ pending: false, error: '', savedAt: '' });
  const [pendingId, setPendingId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [showDone, setShowDone] = useState(false);

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (planning.items || []).filter((item) => {
      if (!showDone && filter !== 'done' && item.status === 'done') {
        return false;
      }
      if (search && !buildSearchText(item).includes(search)) {
        return false;
      }
      if (filter === 'all') {
        return true;
      }
      if (filter === 'done') {
        return item.status === 'done';
      }
      if (['idea', 'initiative', 'action'].includes(filter)) {
        return item.itemType === filter;
      }
      return item.momentum === filter;
    });
  }, [planning.items, query, filter, showDone]);

  async function postPlanning(payload, targetId = '') {
    setSaveState({ pending: true, error: '', savedAt: '' });
    setPendingId(targetId);
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
    setSaveState({
      pending: false,
      error: '',
      savedAt: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    });
    setPendingId('');
    return data.planning;
  }

  async function handleCapture(event) {
    event.preventDefault();
    const rawNote = quickNote.trim();
    if (!rawNote) {
      setSaveState({ pending: false, error: 'Write a note before capturing.', savedAt: '' });
      return;
    }

    const item = buildQuickCaptureItem(rawNote, quickOptions);

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

  const summary = planning.summary || {};

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

      <section className="grid gap-3 md:grid-cols-5">
        {[
          ['Open planning', summary.open || 0],
          ['Active', summary.active || 0],
          ['Inbox', summary.inbox || 0],
          ['No next action', summary.noNextAction || 0],
          ['Stalled', summary.stalled || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
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
            expanded={quickExpanded}
            setExpanded={setQuickExpanded}
            onSubmit={handleCapture}
            pending={saveState.pending && !pendingId}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className={cardClasses()}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Review</h3>
              <p className="mt-1 text-sm text-slate-600">Grouped by current state, with initiatives and next actions kept visible.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowDone((current) => !current)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  showDone
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {showDone ? 'Showing done' : 'Hide done'}
              </button>
              {MOMENTUM_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    filter === option.value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
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
            {STATUS_GROUPS.map((group) => {
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
                        onStatus={handleStatus}
                        onEdit={startEdit}
                        onProgress={handleProgress}
                        pendingId={pendingId}
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
            <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Tutor absence</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Start the cancel-or-cover workflow for a tutor being off.
              </p>
              <Link
                href="/admin/workflows/tutor-absence"
                className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Open workflow
              </Link>
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
            <div className={cardClasses('sticky top-4')}>
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
                  onSubmit={handleEdit}
                  submitLabel="Save changes"
                  pending={pendingId === editingItem.planningId}
                />
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
