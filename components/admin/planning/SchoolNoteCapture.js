'use client';

import { Loader2, Plus } from 'lucide-react';
import { PLANNING_AREAS, PLANNING_OWNERS, labelPlanningArea } from '@/lib/admin/planning-helpers.mjs';
import { SelectField, TextField, TextAreaField } from './fields';

// Learning/strategic "work on the school" note capture — a structured wrapper around
// an open body (title, area/owner/status, main note, key ideas, applications, optional
// next action). Controlled by the orchestrator via `form` + `onChange`.
export default function SchoolNoteCapture({ form, onChange, onSubmit, pending = false }) {
  const setValue = (key, value) => {
    const next = { ...form, [key]: value };
    if (key === 'noteKind') {
      next.area = value === 'learning_note' ? 'learning' : (form.area === 'learning' ? 'growth' : form.area);
    }
    onChange(next);
  };
  const isLearning = form.noteKind === 'learning_note';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { value: 'learning_note', label: 'Learning note' },
          { value: 'strategic_note', label: 'Strategic note' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setValue('noteKind', option.value)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              form.noteKind === option.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <TextField
        label="Title"
        value={form.title}
        onChange={(value) => setValue('title', value)}
        placeholder={isLearning ? 'Book, podcast, conversation, or idea source' : 'Strategic thought or question'}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <SelectField
          label="Area"
          value={form.area}
          onChange={(value) => setValue('area', value)}
          options={PLANNING_AREAS.map((value) => ({ value, label: labelPlanningArea(value) }))}
        />
        <SelectField
          label="Owner"
          value={form.owner}
          onChange={(value) => setValue('owner', value)}
          options={PLANNING_OWNERS}
        />
        <SelectField
          label="Status"
          value={form.status}
          onChange={(value) => setValue('status', value)}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'parked', label: 'Parked' },
            { value: 'done', label: 'Finished' },
            { value: 'inbox', label: 'Inbox' },
          ]}
        />
      </div>

      <TextAreaField
        label="Main note / transcript summary"
        value={form.mainNote}
        onChange={(value) => setValue('mainNote', value)}
        placeholder="Paste the summary from a conversation, audiobook notes, or rough thinking here."
        rows={6}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <TextAreaField
          label="Key ideas"
          value={form.keyIdeas}
          onChange={(value) => setValue('keyIdeas', value)}
          placeholder="What ideas are worth keeping?"
          rows={4}
        />
        <TextAreaField
          label="Possible First Chord applications"
          value={form.applications}
          onChange={(value) => setValue('applications', value)}
          placeholder="How could this affect teaching, parents, growth, systems, or culture?"
          rows={4}
        />
      </div>
      <TextField
        label="Optional next action"
        value={form.nextAction}
        onChange={(value) => setValue('nextAction', value)}
        placeholder="If this should become work, name the next concrete step"
      />

      <button
        type="submit"
        disabled={pending || !form.title.trim() || !form.mainNote.trim()}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Save note
      </button>
    </form>
  );
}
