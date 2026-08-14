'use client';

import { Loader2, Plus } from 'lucide-react';
import { PLANNING_PRIMARY_AREAS, PLANNING_OWNERS, labelPlanningArea } from '@/lib/admin/planning-helpers.mjs';
import { SelectField, TextField, TextAreaField } from './fields';

// The one capture door for school thinking. It deliberately creates an Idea in
// Inbox; deciding whether it becomes a dated Action or a multi-step Project is a
// later conversation, not a classification tax at capture time.
export default function SchoolNoteCapture({ form, onChange, onSubmit, pending = false }) {
  const setValue = (key, value) => onChange({ ...form, [key]: value });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextField
        label="Title"
        value={form.title}
        onChange={(value) => setValue('title', value)}
        placeholder="A thought, question, opportunity, or thing worth discussing"
      />

      <div className="grid gap-3 md:grid-cols-2">
        <SelectField
          label="Area (optional)"
          value={form.area}
          onChange={(value) => setValue('area', value)}
          options={PLANNING_PRIMARY_AREAS.map((value) => ({ value, label: labelPlanningArea(value) }))}
        />
        <SelectField
          label="Owner"
          value={form.owner}
          onChange={(value) => setValue('owner', value)}
          options={PLANNING_OWNERS}
        />
      </div>

      <TextAreaField
        label="Notes"
        value={form.mainNote}
        onChange={(value) => setValue('mainNote', value)}
        placeholder="Why is this worth keeping or talking about?"
        rows={5}
      />

      <p className="text-xs leading-5 text-slate-600">
        This stays here as an idea until you turn it into a dated Action or a Project.
      </p>

      <button
        type="submit"
        disabled={pending || !form.title.trim()}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Save idea
      </button>
    </form>
  );
}
