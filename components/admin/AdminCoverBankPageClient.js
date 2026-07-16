'use client';

import { Check, Loader2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildExternalTutorKey,
  COVER_BANK_CALL_STATUS_OPTIONS,
  COVER_BANK_NOTICE_OPTIONS,
  COVER_BANK_WEEKDAYS,
  COVER_BANK_WILLING_OPTIONS,
  summariseCoverForDay,
} from '@/lib/admin/cover-bank-helpers.mjs';

const WILLING_CHIP_STYLES = {
  yes: 'bg-emerald-100 text-emerald-800',
  no: 'bg-slate-200 text-slate-600',
};

const NOTICE_CHIP_STYLES = {
  same_day: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  needs_notice: 'bg-amber-50 text-amber-800 border border-amber-200',
};

function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || options[0].label;
}

function willingChip(state) {
  if (!state?.willing) {
    return null;
  }
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${WILLING_CHIP_STYLES[state.willing]}`}>
      {labelFor(COVER_BANK_WILLING_OPTIONS, state.willing)}
    </span>
  );
}

function noticeChip(state) {
  if (!state?.notice) {
    return null;
  }
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${NOTICE_CHIP_STYLES[state.notice]}`}>
      {labelFor(COVER_BANK_NOTICE_OPTIONS, state.notice)}
    </span>
  );
}

function QueueItem({ record, selected, unsaved, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-sm font-semibold text-slate-900">{record.tutor.tutorName}</p>
        {record.tutor.tutorType === 'external' ? (
          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-800">External</span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
          {labelFor(COVER_BANK_CALL_STATUS_OPTIONS, record.state.callStatus)}
        </span>
        {willingChip(record.state)}
        {unsaved ? (
          <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-900">Unsaved</span>
        ) : null}
      </div>
    </button>
  );
}

function DayCoverList({ records, weekday }) {
  const { free, alreadyTeaching } = summariseCoverForDay(records, weekday);

  if (!free.length && !alreadyTeaching.length) {
    return <p className="text-sm text-slate-500">No one has said they can cover {weekday}s yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {free.map((record) => (
        <li key={record.tutor.tutorKey} className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">{record.tutor.tutorName}</span>
          {noticeChip(record.state)}
          {record.tutor.tutorType === 'external' ? (
            <span className="rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-800">External</span>
          ) : null}
          {record.state.notes ? <span className="truncate text-xs text-slate-500">{record.state.notes}</span> : null}
        </li>
      ))}
      {alreadyTeaching.map((record) => (
        <li key={record.tutor.tutorKey} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 opacity-70">
          <span className="text-sm font-semibold text-slate-700">{record.tutor.tutorName}</span>
          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-600">Already teaching {weekday}s</span>
          {noticeChip(record.state)}
        </li>
      ))}
    </ul>
  );
}

export default function AdminCoverBankPageClient({ initialWorkflow }) {
  const [records, setRecords] = useState(initialWorkflow.records);
  const [selectedKey, setSelectedKey] = useState(initialWorkflow.records[0]?.tutor?.tutorKey || '');
  const [dayView, setDayView] = useState('');
  const [unsavedKeys, setUnsavedKeys] = useState(() => new Set());
  const [saveState, setSaveState] = useState({ pending: false, error: '', savedAt: '' });
  const [newExternal, setNewExternal] = useState({ open: false, name: '', phone: '' });

  const selectedRecord = records.find((record) => record.tutor.tutorKey === selectedKey) || records[0] || null;
  const completedCount = useMemo(
    () => records.filter((record) => record.state.callStatus === 'completed').length,
    [records],
  );

  function patchSelected(statePatch) {
    if (!selectedRecord) return;
    const key = selectedRecord.tutor.tutorKey;
    setRecords((current) => current.map((record) => (
      record.tutor.tutorKey === key
        ? { ...record, state: { ...record.state, ...statePatch } }
        : record
    )));
    setUnsavedKeys((current) => new Set(current).add(key));
  }

  function patchSelectedTutor(tutorPatch) {
    if (!selectedRecord) return;
    const key = selectedRecord.tutor.tutorKey;
    setRecords((current) => current.map((record) => (
      record.tutor.tutorKey === key
        ? { ...record, tutor: { ...record.tutor, ...tutorPatch } }
        : record
    )));
    setUnsavedKeys((current) => new Set(current).add(key));
  }

  function toggleDay(day) {
    if (!selectedRecord) return;
    const days = selectedRecord.state.availableDays || [];
    patchSelected({
      availableDays: days.includes(day) ? days.filter((entry) => entry !== day) : [...days, day],
    });
  }

  function addExternalTutor() {
    const name = newExternal.name.trim();
    if (!name) return;
    const tempKey = buildExternalTutorKey(name);
    if (!tempKey) return;
    if (records.some((record) => record.tutor.tutorKey === tempKey)) {
      setSelectedKey(tempKey);
      setNewExternal({ open: false, name: '', phone: '' });
      return;
    }
    const record = {
      tutor: { tutorKey: tempKey, tutorName: name, tutorType: 'external', phone: newExternal.phone.trim(), instruments: [], teachingDays: [] },
      state: { callStatus: 'not_called', willing: '', notice: '', availableDays: [], notes: '', lastContactedAt: '', updatedAt: '', updatedBy: '' },
    };
    setRecords((current) => [...current, record]);
    setUnsavedKeys((current) => new Set(current).add(tempKey));
    setSelectedKey(tempKey);
    setNewExternal({ open: false, name: '', phone: '' });
  }

  async function saveSelected() {
    if (!selectedRecord) return;
    const key = selectedRecord.tutor.tutorKey;
    setSaveState({ pending: true, error: '', savedAt: '' });

    const lastContactedAt = selectedRecord.state.lastContactedAt
      || (selectedRecord.state.callStatus !== 'not_called' ? new Date().toISOString() : '');

    try {
      const response = await fetch('/api/admin/cover-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tutorKey: key,
          tutorName: selectedRecord.tutor.tutorName,
          tutorType: selectedRecord.tutor.tutorType,
          phone: selectedRecord.tutor.phone,
          instruments: selectedRecord.tutor.instruments,
          callStatus: selectedRecord.state.callStatus,
          willing: selectedRecord.state.willing,
          notice: selectedRecord.state.notice,
          availableDays: selectedRecord.state.availableDays,
          notes: selectedRecord.state.notes,
          lastContactedAt,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Save failed');
      }
      setRecords((current) => current.map((record) => (
        record.tutor.tutorKey === key
          ? { ...record, state: { ...record.state, lastContactedAt, updatedAt: payload.state.updatedAt } }
          : record
      )));
      setUnsavedKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setSaveState({ pending: false, error: '', savedAt: payload.state.updatedAt });
    } catch (error) {
      setSaveState({ pending: false, error: error.message || 'Save failed', savedAt: '' });
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Workflow</p>
        <h2 className="mt-2 fc-display text-3xl text-slate-900">Cover Bank</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {completedCount} of {records.length} calls completed.
        </p>
      </section>

      <section className="rounded-[1.2rem] border border-blue-100 bg-white/90 p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDayView('')}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              !dayView ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Call queue
          </button>
          {COVER_BANK_WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setDayView(day)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                dayView === day ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
        {dayView ? (
          <div className="mt-4">
            <DayCoverList records={records} weekday={dayView} />
          </div>
        ) : null}
      </section>

      {!dayView ? (
        <section className="grid gap-5 lg:grid-cols-[minmax(260px,340px)_1fr]">
          <div className="space-y-3">
            {records.map((record) => (
              <QueueItem
                key={record.tutor.tutorKey}
                record={record}
                selected={selectedRecord?.tutor?.tutorKey === record.tutor.tutorKey}
                unsaved={unsavedKeys.has(record.tutor.tutorKey)}
                onSelect={() => setSelectedKey(record.tutor.tutorKey)}
              />
            ))}
            {newExternal.open ? (
              <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                <input
                  value={newExternal.name}
                  onChange={(event) => setNewExternal((current) => ({ ...current, name: event.target.value }))}
                  placeholder="External tutor name"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
                <input
                  value={newExternal.phone}
                  onChange={(event) => setNewExternal((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="Phone (optional)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addExternalTutor}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExternal({ open: false, name: '', phone: '' })}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNewExternal((current) => ({ ...current, open: true }))}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
              >
                <Plus className="h-4 w-4" /> Add external tutor
              </button>
            )}
          </div>

          {selectedRecord ? (
            <div className="space-y-5 rounded-[1.2rem] border border-blue-100 bg-white/90 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{selectedRecord.tutor.tutorName}</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {selectedRecord.tutor.instruments.map((instrument) => (
                      <span key={instrument} className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">{instrument}</span>
                    ))}
                    {selectedRecord.tutor.teachingDays.map((day) => (
                      <span key={day} className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Teaches {day.slice(0, 3)}</span>
                    ))}
                  </div>
                </div>
                <select
                  value={selectedRecord.state.callStatus}
                  onChange={(event) => patchSelected({ callStatus: event.target.value })}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {COVER_BANK_CALL_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">1. Happy to be on the cover bank?</p>
                <select
                  value={selectedRecord.state.willing}
                  onChange={(event) => patchSelected({ willing: event.target.value })}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {COVER_BANK_WILLING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">2. Which days could you generally cover?</p>
                <div className="flex flex-wrap gap-2">
                  {COVER_BANK_WEEKDAYS.map((day) => {
                    const ticked = (selectedRecord.state.availableDays || []).includes(day);
                    const teaches = selectedRecord.tutor.teachingDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          ticked
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200'
                        } ${teaches ? 'opacity-60' : ''}`}
                        title={teaches ? `Already teaches ${day}s` : ''}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">2b. OK with a same-day ask?</p>
                <select
                  value={selectedRecord.state.notice}
                  onChange={(event) => patchSelected({ notice: event.target.value })}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {COVER_BANK_NOTICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">3. Anything we should know?</p>
                <textarea
                  value={selectedRecord.state.notes}
                  onChange={(event) => patchSelected({ notes: event.target.value })}
                  placeholder="Notice needed, travel limits, instruments for external tutors..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
                />
              </div>

              {selectedRecord.tutor.tutorType === 'external' ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Phone</p>
                  <input
                    value={selectedRecord.tutor.phone}
                    onChange={(event) => patchSelectedTutor({ phone: event.target.value })}
                    className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  />
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveSelected}
                  disabled={saveState.pending}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {saveState.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </button>
                {saveState.error ? <span className="text-sm text-red-600">{saveState.error}</span> : null}
                {selectedRecord.state.lastContactedAt ? (
                  <span className="text-xs text-slate-500">
                    Last contacted {new Date(selectedRecord.state.lastContactedAt).toLocaleDateString('en-GB')}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
