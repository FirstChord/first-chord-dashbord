'use client';

import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { PLANNING_OWNERS } from '@/lib/admin/planning-helpers.mjs';
import { SelectField, TextField, TextAreaField, DateField } from './fields';

// One "next improvement" from Friday's reflection, surfaced on the Monday panel.
// Click to expand into a small editor and add it to the board as an owned action.
export default function MondayIntentionRow({ intention, defaultDueDate, onSchedule, onDismiss, pending }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(intention);
  const [notes, setNotes] = useState('');
  const [owner, setOwner] = useState('Unassigned');
  const [targetDate, setTargetDate] = useState(defaultDueDate);

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-800">{intention}</span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50"
          >
            {expanded ? 'Cancel' : <><Plus className="h-3.5 w-3.5" /> Schedule</>}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(intention)}
            disabled={pending}
            title="Remove this suggestion from the Monday scheduling list"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Dismiss
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <TextField label="Title" value={title} onChange={setTitle} placeholder="Shorten into a clear task" />
          <TextAreaField label="Description (optional)" value={notes} onChange={setNotes} rows={2} placeholder="Any extra context" />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Owner" value={owner} onChange={setOwner} options={PLANNING_OWNERS} />
            <DateField label="Do by" value={targetDate} onChange={setTargetDate} />
          </div>
          <button
            type="button"
            onClick={() => onSchedule({ title, notes, owner, targetDate })}
            disabled={pending || !title.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add to board
          </button>
        </div>
      ) : null}
    </div>
  );
}
