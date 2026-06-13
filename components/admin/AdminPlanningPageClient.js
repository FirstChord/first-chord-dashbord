'use client';

import Link from 'next/link';
import { Check, Loader2, Pencil, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  PLANNING_AREAS,
  PLANNING_ITEM_TYPES,
  PLANNING_OWNERS,
  PLANNING_STATUSES,
  buildPauseLessonDateSuggestions,
  buildStructuredPausePlanningDraft,
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
  { value: 'due_now', label: 'Due Now' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'no_next_action', label: 'No Next Action' },
  { value: 'waiting_status', label: 'Waiting' },
  { value: 'linked', label: 'Linked' },
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
const PAUSE_EXPECTATION_SET_NOTE = 'Set Stripe paused expected from linked pause planning item.';

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

function formatDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normaliseSearchText(value = '') {
  return `${value || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isDueNowPlanningItem(item = {}, now = new Date()) {
  const targetDate = `${item.targetDate || ''}`.trim();
  return !['done', 'parked'].includes(item.status)
    && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    && targetDate <= formatDateInput(now);
}

function isOpenPlanningItem(item = {}) {
  return !['done', 'parked'].includes(item.status);
}

function hasPlanningLink(item = {}) {
  return Boolean(
    `${item.linkedWorkflowId || ''}`.trim()
    || `${item.linkedStudentId || ''}`.trim()
    || `${item.linkedTutorId || ''}`.trim()
    || `${item.parentPlanningId || ''}`.trim(),
  );
}

function studentLabel(student = {}) {
  return [
    student.fullName || student.mmsId,
    student.tutor ? `Tutor: ${student.tutor}` : '',
    student.instrument || '',
  ].filter(Boolean).join(' · ');
}

function findStudentById(studentOptions = [], mmsId = '') {
  return studentOptions.find((student) => student.mmsId === mmsId) || null;
}

function findStudentSuggestions(studentOptions = [], query = '', limit = 6) {
  const search = normaliseSearchText(query);
  if (!search) {
    return [];
  }
  const terms = search.split(/\s+/).filter(Boolean);

  return studentOptions
    .map((student) => {
      const haystack = normaliseSearchText([
        student.fullName,
        student.mmsId,
        student.tutor,
        student.instrument,
      ].filter(Boolean).join(' '));
      const score = terms.reduce((sum, term) => (
        haystack.includes(term) ? sum + (haystack.startsWith(term) ? 2 : 1) : sum
      ), 0);
      return { student, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.student.fullName.localeCompare(b.student.fullName))
    .slice(0, limit)
    .map((entry) => entry.student);
}

function inferStudentFromText(studentOptions = [], rawText = '') {
  const text = normaliseSearchText(rawText);
  if (!text) {
    return null;
  }

  const exactMatches = studentOptions
    .map((student) => {
      const name = normaliseSearchText(student.fullName);
      if (!name || !text.includes(name)) {
        return null;
      }
      return { student, score: name.length };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (exactMatches.length) {
    return exactMatches[0].student;
  }

  const studentQuery = text
    .replace(/\b(please|can|could|you|we|need|to|for|from|until|pause|paused|pausing|lesson|lessons|away|off|holiday|holidays)\b/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (studentQuery) {
    const queryTerms = studentQuery.split(/\s+/).filter(Boolean);
    const exactFirstNameMatches = studentOptions.filter((student) => {
      const firstName = normaliseSearchText(student.fullName).split(/\s+/)[0] || '';
      return queryTerms.some((term) => firstName === term);
    });
    if (exactFirstNameMatches.length === 1) {
      return exactFirstNameMatches[0];
    }
  }

  const suggestions = findStudentSuggestions(studentOptions, studentQuery || rawText, 3);
  if (suggestions.length > 1 && studentQuery) {
    const queryTerms = studentQuery.split(/\s+/).filter(Boolean);
    const firstNameMatches = suggestions.filter((student) => {
      const firstName = normaliseSearchText(student.fullName).split(/\s+/)[0] || '';
      return queryTerms.some((term) => firstName === term || firstName.startsWith(term));
    });
    if (firstNameMatches.length === 1) {
      return firstNameMatches[0];
    }
  }
  return suggestions.length === 1 ? suggestions[0] : null;
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

function isPauseCaptureText(raw = '') {
  return /\bpaus(?:e|ed|ing)\b/iu.test(`${raw || ''}`);
}

function buildQuickCaptureItem(rawNote = '', overrides = {}, studentOptions = []) {
  const inferred = inferQuickCapture(rawNote);
  const {
    structuredCapture,
    pauseType,
    pauseLessonDate,
    pauseFirstPauseDate,
    pauseReturnDate,
    pauseExtraNote,
    showPauseBuilder,
    hidePauseBuilder,
    studentSelectionSource,
    ...safeOverrides
  } = overrides;
  const hasStudentOverride = Object.prototype.hasOwnProperty.call(safeOverrides, 'linkedStudentId');
  const inferredStudent = hasStudentOverride ? null : inferStudentFromText(studentOptions, rawNote);
  const item = {
    ...EMPTY_FORM,
    ...inferred,
    ...safeOverrides,
    title: safeOverrides.title || truncateTitle(rawNote),
    notes: safeOverrides.notes || rawNote.trim(),
    linkedStudentId: hasStudentOverride ? safeOverrides.linkedStudentId : inferredStudent?.mmsId || '',
    targetDate: safeOverrides.targetDate || inferPlanningTargetDateFromText(rawNote),
    progressNote: safeOverrides.progressNote || 'Captured from quick brain capture.',
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

function StudentSearchField({ label = 'Linked Student', value, onChange, studentOptions = [] }) {
  const selectedStudent = findStudentById(studentOptions, value);
  const [query, setQuery] = useState('');
  const suggestions = findStudentSuggestions(studentOptions, query);

  return (
    <div className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
      {selectedStudent ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 normal-case tracking-normal">
          <span className="text-sm font-medium text-slate-900">{studentLabel(selectedStudent)}</span>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
          >
            Clear
          </button>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a student name"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:text-slate-400"
          />
          {suggestions.length ? (
            <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-white p-2 normal-case tracking-normal">
              {suggestions.map((student) => (
                <button
                  key={student.mmsId}
                  type="button"
                  onClick={() => {
                    onChange(student.mmsId);
                    setQuery('');
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                >
                  {studentLabel(student)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
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

function studentHref(studentId = '') {
  const key = `${studentId || ''}`.trim();
  return key ? `/admin/students/${encodeURIComponent(key)}` : '';
}

function LinkPill({ label, href = '' }) {
  const classes = 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-slate-900';
  return href ? (
    <Link href={href} className={classes}>
      {label}
    </Link>
  ) : (
    <span className={classes}>{label}</span>
  );
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
  studentOptions = [],
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
            <StudentSearchField
              value={form.linkedStudentId}
              onChange={(value) => setValue('linkedStudentId', value)}
              studentOptions={studentOptions}
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
  studentOptions = [],
  expanded,
  setExpanded,
  onSubmit,
  pending = false,
}) {
  const inferred = inferQuickCapture(rawNote);
  const inferredTargetDate = inferPlanningTargetDateFromText(rawNote);
  const hasManualStudentOverride = options.studentSelectionSource === 'manual';
  const inferredStudent = hasManualStudentOverride ? null : inferStudentFromText(studentOptions, rawNote);
  const effectiveOptions = {
    ...inferred,
    targetDate: inferredTargetDate,
    linkedStudentId: hasManualStudentOverride ? options.linkedStudentId : inferredStudent?.mmsId || options.linkedStudentId || '',
    ...options,
    linkedStudentId: hasManualStudentOverride ? options.linkedStudentId : inferredStudent?.mmsId || options.linkedStudentId || '',
  };
  const pauseBuilderVisible = !effectiveOptions.hidePauseBuilder
    && (isPauseCaptureText(rawNote) || effectiveOptions.showPauseBuilder);
  const pauseType = effectiveOptions.pauseType === 'range' ? 'range' : 'single';
  const pauseStudent = findStudentById(studentOptions, effectiveOptions.linkedStudentId);
  const pauseDateSuggestions = buildPauseLessonDateSuggestions(pauseStudent?.scheduleContext, {
    count: 6,
    startDate: pauseType === 'range' ? effectiveOptions.pauseFirstPauseDate || '' : '',
  });
  const pauseDraft = buildStructuredPausePlanningDraft({
    studentName: pauseStudent?.fullName || '',
    pauseType,
    lessonDate: effectiveOptions.pauseLessonDate || '',
    firstPauseDate: effectiveOptions.pauseFirstPauseDate || '',
    returnDate: effectiveOptions.pauseReturnDate || '',
    extraNote: effectiveOptions.pauseExtraNote || '',
  });

  function setOption(key, value) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function setStudentOption(value) {
    setOptions((current) => ({
      ...current,
      linkedStudentId: value,
      studentSelectionSource: value ? 'manual' : '',
    }));
  }

  function applyPauseDraft() {
    if (!pauseDraft.isComplete) {
      return;
    }
    setRawNote(pauseDraft.title);
    setOptions((current) => ({
      ...current,
      structuredCapture: 'pause',
      title: pauseDraft.title,
      notes: pauseDraft.notes,
      itemType: 'action',
      status: 'active',
      area: 'admin',
      targetDate: pauseDraft.targetDate,
      nextAction: pauseDraft.nextAction,
      progressNote: pauseDraft.progressNote,
      showPauseBuilder: true,
      hidePauseBuilder: false,
    }));
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

      {pauseBuilderVisible ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Structured pause</p>
              <p className="mt-1 text-sm text-violet-950">
                Use this when a pause covers one lesson or an away period. For away periods, “returning from” means the first lesson/date they are expected back.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOption('showPauseBuilder', false);
                setOption('hidePauseBuilder', true);
              }}
              className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
            >
              Hide
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SelectField
              label="Pause type"
              value={pauseType}
              onChange={(value) => setOption('pauseType', value)}
              options={[
                { value: 'single', label: 'One lesson' },
                { value: 'range', label: 'Away period' },
              ]}
            />
            <div>
              <StudentSearchField
                label="Student"
                value={effectiveOptions.linkedStudentId}
                onChange={setStudentOption}
                studentOptions={studentOptions}
              />
            </div>
          </div>

          {pauseStudent?.scheduleContext?.status === 'found' ? (
            <div className="mt-4 rounded-xl border border-violet-100 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                Suggested lesson dates
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Usual lesson: {[
                  pauseStudent.scheduleContext.usualWeekday,
                  pauseStudent.scheduleContext.usualTime,
                  pauseStudent.scheduleContext.teacherName ? `with ${pauseStudent.scheduleContext.teacherName}` : '',
                ].filter(Boolean).join(' ') || 'cached schedule found'}
              </p>
              {pauseDateSuggestions.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {pauseDateSuggestions.map((suggestion) => (
                    <div key={suggestion.date} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                      <p className="text-sm font-semibold text-slate-900">{suggestion.lessonLabel}</p>
                      {pauseType === 'single' ? (
                        <button
                          type="button"
                          onClick={() => setOption('pauseLessonDate', suggestion.date)}
                          className="mt-2 rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                        >
                          Use this lesson
                        </button>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setOption('pauseFirstPauseDate', suggestion.date)}
                            className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-50"
                          >
                            First missed
                          </button>
                          <button
                            type="button"
                            onClick={() => setOption('pauseReturnDate', suggestion.date)}
                            className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                          >
                            Returning
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No upcoming cached lesson dates available.</p>
              )}
            </div>
          ) : effectiveOptions.linkedStudentId ? (
            <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No cached lesson schedule for this student yet. Use the date fields manually, or refresh schedule context from the student record later.
            </p>
          ) : null}

          {pauseType === 'single' ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <DateField
                label="Lesson to pause"
                value={effectiveOptions.pauseLessonDate || ''}
                onChange={(value) => setOption('pauseLessonDate', value)}
              />
              <TextField
                label="Extra note"
                value={effectiveOptions.pauseExtraNote || ''}
                onChange={(value) => setOption('pauseExtraNote', value)}
                placeholder="Optional reason or context"
              />
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <DateField
                label="First lesson to pause"
                value={effectiveOptions.pauseFirstPauseDate || ''}
                onChange={(value) => setOption('pauseFirstPauseDate', value)}
              />
              <DateField
                label="Returning from"
                value={effectiveOptions.pauseReturnDate || ''}
                onChange={(value) => setOption('pauseReturnDate', value)}
              />
              <TextField
                label="Extra note"
                value={effectiveOptions.pauseExtraNote || ''}
                onChange={(value) => setOption('pauseExtraNote', value)}
                placeholder="Summer holiday, illness, etc."
              />
            </div>
          )}

          <div className="mt-4 rounded-xl border border-violet-100 bg-white p-3 text-sm text-slate-700">
            {pauseDraft.isComplete ? (
              <>
                <p className="font-semibold text-slate-900">{pauseDraft.title}</p>
                <p className="mt-1 whitespace-pre-line">{pauseDraft.notes}</p>
                {pauseDraft.targetDate ? (
                  <p className="mt-2 text-xs font-semibold text-amber-800">Do by {formatTargetDate(pauseDraft.targetDate)}</p>
                ) : null}
              </>
            ) : (
              <p>
                Add {pauseDraft.missingFields.join(' and ')} to generate a clear pause task.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={applyPauseDraft}
            disabled={!pauseDraft.isComplete}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use these pause details
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOption('showPauseBuilder', true);
            setOption('hidePauseBuilder', false);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-50"
        >
          Structure a pause
        </button>
      )}

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
          {effectiveOptions.linkedStudentId ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
              Student: {findStudentById(studentOptions, effectiveOptions.linkedStudentId)?.fullName || effectiveOptions.linkedStudentId}
            </span>
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
          <div className="md:col-span-5">
            <StudentSearchField
              value={effectiveOptions.linkedStudentId}
              onChange={setStudentOption}
              studentOptions={studentOptions}
            />
          </div>
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

function PlanningCard({ item, studentOptions = [], paymentExpectationOverrides = {}, onStatus, onEdit, onProgress, onSetPauseExpected, pendingId }) {
  const [progressNote, setProgressNote] = useState('');
  const [nextAction, setNextAction] = useState(item.nextAction || '');
  const isPending = pendingId === item.planningId;
  const isPauseReminder = isPausePlanningItem(item);
  const pausePaymentConfirmed = hasPausePaymentConfirmation(item);
  const linkedWorkflowHref = workflowHref(item.linkedWorkflowId);
  const linkedStudent = findStudentById(studentOptions, item.linkedStudentId);
  const linkedStudentPaymentExpectation = paymentExpectationOverrides[item.linkedStudentId] || linkedStudent?.paymentExpectation || '';
  const pauseExpectationAlreadySet = linkedStudentPaymentExpectation === 'stripe_paused_expected';
  const linkFacts = [
    item.linkedWorkflowId ? { label: `Workflow: ${item.linkedWorkflowId}`, href: linkedWorkflowHref } : null,
    item.linkedStudentId ? {
      label: `Student: ${findStudentById(studentOptions, item.linkedStudentId)?.fullName || item.linkedStudentId}`,
      href: studentHref(item.linkedStudentId),
    } : null,
    item.linkedTutorId ? { label: `Tutor: ${item.linkedTutorId}`, href: '' } : null,
  ].filter(Boolean);

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
            <LinkPill key={fact.label} label={fact.label} href={fact.href} />
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
          {item.linkedStudentId ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-amber-100 pt-3">
              <button
                type="button"
                disabled={isPending || !pausePaymentConfirmed || pauseExpectationAlreadySet}
                onClick={() => onSetPauseExpected(item)}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pauseExpectationAlreadySet ? 'Paused expected set' : 'Set Stripe paused expected'}
              </button>
              <span className="text-xs text-amber-800">
                {pausePaymentConfirmed
                  ? 'Updates the linked student payment expectation and logs the action.'
                  : 'Tick the confirmation message first.'}
              </span>
            </div>
          ) : (
            <p className="mt-3 border-t border-amber-100 pt-3 text-xs text-amber-800">
              Link a student before changing payment expectation from Planning.
            </p>
          )}
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

export default function AdminPlanningPageClient({ initialPlanning, initialFilter = 'all', studentOptions = [] }) {
  const [planning, setPlanning] = useState(initialPlanning || { items: [], summary: {} });
  const [quickNote, setQuickNote] = useState('');
  const [quickOptions, setQuickOptions] = useState({});
  const [quickExpanded, setQuickExpanded] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saveState, setSaveState] = useState({ pending: false, error: '', savedAt: '' });
  const [pendingId, setPendingId] = useState('');
  const [paymentExpectationOverrides, setPaymentExpectationOverrides] = useState({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(initialFilter);
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
      if (filter === 'due_now') {
        return isDueNowPlanningItem(item);
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

  async function handleSetPauseExpected(item) {
    if (!item.linkedStudentId) {
      setSaveState({ pending: false, error: 'Link a student before setting pause expectation.', savedAt: '' });
      return;
    }

    try {
      setSaveState({ pending: true, error: '', savedAt: '' });
      setPendingId(item.planningId);
      const response = await fetch(`/api/admin/students/${encodeURIComponent(item.linkedStudentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentExpectation: 'stripe_paused_expected',
          auditContext: {
            source: 'admin_pause_workflow_action',
            actionLabel: 'Set Stripe paused expected from Planning',
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
      }, item.planningId);
      setPaymentExpectationOverrides((current) => ({
        ...current,
        [item.linkedStudentId]: 'stripe_paused_expected',
      }));
    } catch (error) {
      setSaveState({ pending: false, error: error.message || 'Pause expectation update failed', savedAt: '' });
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
            studentOptions={studentOptions}
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
                        studentOptions={studentOptions}
                        paymentExpectationOverrides={paymentExpectationOverrides}
                        onStatus={handleStatus}
                        onEdit={startEdit}
                        onProgress={handleProgress}
                        onSetPauseExpected={handleSetPauseExpected}
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
    </div>
  );
}
