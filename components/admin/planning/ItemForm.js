'use client';

import { Loader2, Plus } from 'lucide-react';
import {
  PLANNING_PRIMARY_ITEM_TYPES,
  PLANNING_STATUSES,
  PLANNING_OWNERS,
  PLANNING_PRIMARY_AREAS,
  labelPlanningType,
  labelPlanningStatus,
  labelPlanningArea,
} from '@/lib/admin/planning-helpers.mjs';
import { applySmartDefaults } from '@/lib/admin/planning-client-helpers.mjs';
import { SelectField, TextField, TextAreaField, DateField, StudentSearchField } from './fields';

// The full planning-item edit form (also used in a `compact` mode for quick creation).
// Controlled by the orchestrator via `form` + `onChange`.
export default function ItemForm({
  form,
  onChange,
  studentOptions = [],
  onSubmit,
  submitLabel = 'Save',
  pending = false,
  compact = false,
}) {
  const setValue = (key, value) => onChange({ ...form, [key]: value });
  const typeOptions = PLANNING_PRIMARY_ITEM_TYPES.includes(form.itemType)
    ? PLANNING_PRIMARY_ITEM_TYPES
    : [form.itemType, ...PLANNING_PRIMARY_ITEM_TYPES];
  const areaOptions = PLANNING_PRIMARY_AREAS.includes(form.area)
    ? PLANNING_PRIMARY_AREAS
    : [form.area, ...PLANNING_PRIMARY_AREAS];
  const isProject = form.itemType === 'initiative';
  const isAction = form.itemType === 'action';
  const actionNeedsDate = isAction && ['active', 'waiting'].includes(form.status) && !form.targetDate;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Title"
        value={form.title}
        onChange={(value) => setValue('title', value)}
        placeholder="What are you doing or keeping track of?"
      />

      <div className="grid gap-3 md:grid-cols-3">
        <SelectField
          label="Kind"
          value={form.itemType}
          onChange={(value) => onChange(applySmartDefaults({ ...form, itemType: value }))}
          options={typeOptions.map((value) => ({ value, label: labelPlanningType(value) }))}
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
      </div>

      {!compact && (
        <>
          <TextAreaField
            label="Notes"
            value={form.notes}
            onChange={(value) => setValue('notes', value)}
            placeholder="Context, rough thinking, links, constraints, or why this matters"
          />
          {isProject ? (
            <TextAreaField
              label="Done when"
              value={form.outcome}
              onChange={(value) => setValue('outcome', value)}
              placeholder="What will be true when this project is complete?"
              rows={2}
            />
          ) : null}
          <details className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">More details</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <SelectField
                label="Area (optional)"
                value={form.area}
                onChange={(value) => setValue('area', value)}
                options={areaOptions.map((value) => ({ value, label: labelPlanningArea(value) }))}
              />
              <TextField
                label="Linked Workflow"
                value={form.linkedWorkflowId}
                onChange={(value) => setValue('linkedWorkflowId', value)}
                placeholder="parent-understanding"
              />
              <StudentSearchField
                label="Linked Students"
                multiple
                value={form.linkedStudentIds ?? form.linkedStudentId}
                onChange={(ids) => onChange({ ...form, linkedStudentIds: ids, linkedStudentId: ids[0] || '' })}
                studentOptions={studentOptions}
              />
              <TextField
                label="Linked Tutor"
                value={form.linkedTutorId}
                onChange={(value) => setValue('linkedTutorId', value)}
                placeholder="Fennella"
              />
            </div>
          </details>
        </>
      )}

      {isAction || isProject ? (
        <DateField
          label={isProject ? 'Review next (optional)' : 'Do on'}
          value={form.targetDate}
          onChange={(value) => setValue('targetDate', value)}
        />
      ) : null}
      {actionNeedsDate ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          Choose the day this Action should appear. Leave it in Inbox if you are not ready to schedule it.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || actionNeedsDate}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {submitLabel}
      </button>
    </form>
  );
}
