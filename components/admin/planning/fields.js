'use client';

import Link from 'next/link';
import { useState } from 'react';
import { parseLinkedStudentIds } from '@/lib/admin/planning-helpers.mjs';
import { findStudentById, findStudentSuggestions, studentLabel } from '@/lib/admin/planning-client-helpers.mjs';

// Shared presentational form fields for the planning surface, extracted from
// AdminPlanningPageClient.js so the feature components (PlanningCard, ItemForm,
// QuickBrainCapture, SchoolNoteCapture, …) can share them. Planning-scoped styling;
// cross-client de-duping with the other admin clients is a separate future call.

export function SelectField({ label, value, options, onChange }) {
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

export function TextField({ label, value, onChange, placeholder = '' }) {
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

export function DateField({ label, value, onChange }) {
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

export function StudentSearchField({ label = 'Linked Student', value, onChange, studentOptions = [], multiple = false }) {
  const [query, setQuery] = useState('');

  // Multi-select: selected students show as removable chips and the search box
  // stays available to add more (e.g. for a group lesson). `value` is an array
  // of MMS ids and `onChange` is called with the updated array.
  if (multiple) {
    const ids = parseLinkedStudentIds(value);
    const selectedStudents = ids.map((id) => findStudentById(studentOptions, id) || { mmsId: id, fullName: id });
    const suggestions = findStudentSuggestions(studentOptions, query).filter((student) => !ids.includes(student.mmsId));

    return (
      <div className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
        {selectedStudents.length ? (
          <div className="mt-2 flex flex-wrap gap-2 normal-case tracking-normal">
            {selectedStudents.map((student) => (
              <span
                key={student.mmsId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-sm font-medium text-slate-900"
              >
                {student.fullName || student.mmsId}
                <button
                  type="button"
                  onClick={() => onChange(ids.filter((id) => id !== student.mmsId))}
                  className="text-base leading-none text-slate-500 hover:text-slate-800"
                  aria-label={`Remove ${student.fullName || student.mmsId}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={selectedStudents.length ? 'Add another student' : 'Type a student name'}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 placeholder:text-slate-400"
        />
        {suggestions.length ? (
          <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-white p-2 normal-case tracking-normal">
            {suggestions.map((student) => (
              <button
                key={student.mmsId}
                type="button"
                onClick={() => {
                  onChange([...ids, student.mmsId]);
                  setQuery('');
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
              >
                {studentLabel(student)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const selectedStudent = findStudentById(studentOptions, value);
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

export function TextAreaField({ label, value, onChange, placeholder = '', rows = 3 }) {
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

// Renders multi-line notes/reflections with line breaks preserved (the box is
// plain text, not Markdown), collapsing long entries to a few lines with a
// Show more/less toggle so a full meeting summary reads cleanly without
// dominating the card.
export function ExpandableText({ text = '', previewLines = 4, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  const full = `${text || ''}`.trim();
  const lines = full.split(/\r?\n/);
  const isLong = lines.length > previewLines || full.length > 400;
  const preview = lines.slice(0, previewLines).join('\n').slice(0, 400);
  const shown = expanded || !isLong ? full : preview;

  return (
    <div className={className}>
      <p className="whitespace-pre-line">{shown}{!expanded && isLong ? '…' : ''}</p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

export function LinkPill({ label, href = '' }) {
  const classes = 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-slate-900';
  return href ? (
    <Link href={href} className={classes}>
      {label}
    </Link>
  ) : (
    <span className={classes}>{label}</span>
  );
}
