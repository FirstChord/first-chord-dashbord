'use client';

import { Loader2, Plus } from 'lucide-react';
import {
  PLANNING_ITEM_TYPES,
  PLANNING_STATUSES,
  PLANNING_OWNERS,
  PLANNING_AREAS,
  PLANNING_MODES,
  labelPlanningType,
  labelPlanningStatus,
  labelPlanningArea,
  labelPlanningMode,
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Title"
        value={form.title}
        onChange={(value) => setValue('title', value)}
        placeholder="Write the thought, initiative, or next action"
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <SelectField
          label="Type"
          value={form.itemType}
          onChange={(value) => onChange(applySmartDefaults({ ...form, itemType: value }))}
          options={PLANNING_ITEM_TYPES.map((value) => ({ value, label: labelPlanningType(value) }))}
        />
        <SelectField
          label="Mode"
          value={form.planMode}
          onChange={(value) => setValue('planMode', value)}
          options={PLANNING_MODES.map((value) => ({ value, label: labelPlanningMode(value) }))}
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
