'use client';

import Link from 'next/link';
import { Check, ChevronDown, Copy, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function cardClasses() {
  return 'rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm';
}

function seasonHref(season) {
  return `/admin/showcase?season=${season}&year=2026`;
}

function CheckboxButton({ checked, pending, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
        checked
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
      } ${pending ? 'cursor-wait opacity-70' : ''}`}
      aria-pressed={checked}
      aria-label={checked ? 'Mark task incomplete' : 'Mark task complete'}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : checked ? <Check className="h-3.5 w-3.5" /> : null}
    </button>
  );
}

export default function AdminShowcasePageClient({ workflow }) {
  const [taskGroups, setTaskGroups] = useState(workflow.taskGroups);
  const [actionState, setActionState] = useState({ pendingTaskId: '', error: '' });
  const [copiedTemplate, setCopiedTemplate] = useState('');
  const [openPanels, setOpenPanels] = useState({
    timings: false,
    assets: true,
    messages: false,
  });

  useEffect(() => {
    setTaskGroups(workflow.taskGroups);
  }, [workflow.taskGroups]);

  const completedTasks = useMemo(
    () => taskGroups.reduce((sum, group) => sum + group.tasks.filter((task) => task.completed).length, 0),
    [taskGroups],
  );
  const totalTasks = useMemo(
    () => taskGroups.reduce((sum, group) => sum + group.tasks.length, 0),
    [taskGroups],
  );

  const templateCards = [
    { label: `${workflow.seasonLabel} parent announcement`, body: workflow.seasonalAssets.parentAnnouncementTemplate },
    { label: `${workflow.seasonLabel} tutor announcement`, body: workflow.seasonalAssets.tutorAnnouncementTemplate },
    { label: 'Parent follow-up', body: workflow.templates.parentFollowUp },
    { label: 'Tutor helper request', body: workflow.templates.tutorHelperRequest },
    { label: 'Running order message', body: workflow.templates.runningOrderMessage },
    { label: 'Parent thank-you message', body: workflow.templates.parentThankYou },
  ];

  async function handleToggleTask(groupId, task) {
    const nextCompleted = !task.completed;
    setActionState({ pendingTaskId: task.id, error: '' });

    try {
      const response = await fetch('/api/admin/showcase/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowKey: workflow.workflowKey,
          season: workflow.season,
          year: workflow.year,
          groupId,
          taskId: task.id,
          taskLabel: task.label,
          completed: nextCompleted,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setActionState({ pendingTaskId: '', error: payload.error || 'Task update failed' });
        return;
      }

      setTaskGroups((current) => current.map((group) => (
        group.id === groupId
          ? {
            ...group,
            tasks: group.tasks.map((entry) => (
              entry.id === task.id
                ? {
                  ...entry,
                  completed: payload.task.completed,
                  completedAt: payload.task.completedAt,
                  updatedAt: payload.task.updatedAt,
                }
                : entry
            )),
          }
          : group
      )));
      setActionState({ pendingTaskId: '', error: '' });
    } catch (error) {
      setActionState({ pendingTaskId: '', error: error.message || 'Task update failed' });
    }
  }

  async function handleCopyTemplate(label, body) {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = body;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    setCopiedTemplate(label);
    window.setTimeout(() => setCopiedTemplate((current) => (current === label ? '' : current)), 1800);
  }

  function togglePanel(panelKey) {
    setOpenPanels((current) => ({
      ...current,
      [panelKey]: !current[panelKey],
    }));
  }

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Recurring workflow</p>
        <h2
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Showcase Workflow
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Reusable show runbook with persistent task tracking, linked assets, and copy-ready message templates.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href={seasonHref('summer')}
          className={`rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition ${
            workflow.season === 'summer'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-blue-200/70 bg-white/75 text-slate-700 hover:border-blue-300 hover:bg-white hover:text-slate-900'
          }`}
        >
          Summer Show 2026
        </Link>
        <Link
          href={seasonHref('winter')}
          className={`rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition ${
            workflow.season === 'winter'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-blue-200/70 bg-white/75 text-slate-700 hover:border-blue-300 hover:bg-white hover:text-slate-900'
          }`}
        >
          Winter Show Template
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className={cardClasses()}>
          <p className="text-sm text-slate-500">Current workflow</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{workflow.title}</p>
          <p className="mt-2 text-sm text-slate-600">Usual timing: {workflow.defaultWindow}</p>
        </div>
        <div className={cardClasses()}>
          <p className="text-sm text-slate-500">Checklist progress</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{completedTasks} / {totalTasks}</p>
          <p className="mt-2 text-sm text-slate-600">Tasks stay checked off after reload because the state is saved in Sheets.</p>
        </div>
        <div className={cardClasses()}>
          <p className="text-sm text-slate-500">Venue</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{workflow.commonLinks.venue.label}</p>
          <p className="mt-2 text-sm text-slate-600">{workflow.commonLinks.venue.detail}</p>
          <a href={workflow.commonLinks.venue.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
            Open map
          </a>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <section className={cardClasses()}>
            <button
              type="button"
              onClick={() => togglePanel('assets')}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Linked Assets</h3>
                <p className="mt-1 text-sm text-slate-600">Compact reference links for the main files you actually open while building the show.</p>
              </div>
              <ChevronDown className={`h-5 w-5 text-slate-500 transition ${openPanels.assets ? 'rotate-180' : ''}`} />
            </button>
            {openPanels.assets ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  workflow.seasonalAssets.posterTemplate,
                  workflow.seasonalAssets.bannerTemplate,
                  workflow.commonLinks.eventbriteManage,
                  workflow.commonLinks.performerForm,
                  workflow.commonLinks.runningOrderTemplate,
                  workflow.commonLinks.collageTemplate,
                ]
                  .filter(Boolean)
                  .map((item) => (
                    <div key={item.href} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <a href={item.href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-slate-700 underline underline-offset-2">
                        Open link
                      </a>
                    </div>
                  ))}
              </div>
            ) : null}
          </section>

          <section className={cardClasses()}>
            <button
              type="button"
              onClick={() => togglePanel('timings')}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Key Timings</h3>
                <p className="mt-1 text-sm text-slate-600">Planning guidance rather than actions.</p>
              </div>
              <ChevronDown className={`h-5 w-5 text-slate-500 transition ${openPanels.timings ? 'rotate-180' : ''}`} />
            </button>
            {openPanels.timings ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {workflow.timings.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="mt-2 text-sm text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <section className={cardClasses()}>
          <button
            type="button"
            onClick={() => togglePanel('messages')}
            className="flex w-full items-center justify-between gap-4 text-left"
          >
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Core Messages</h3>
              <p className="mt-1 text-sm text-slate-600">Copy-ready templates for WhatsApp and follow-up comms.</p>
            </div>
            <ChevronDown className={`h-5 w-5 text-slate-500 transition ${openPanels.messages ? 'rotate-180' : ''}`} />
          </button>
          {openPanels.messages ? (
            <div className="mt-4 space-y-4">
              {templateCards.map((template) => (
                <div key={template.label} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <button
                    type="button"
                    onClick={() => handleCopyTemplate(template.label, template.body)}
                    className={`absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${
                      copiedTemplate === template.label
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {copiedTemplate === template.label ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedTemplate === template.label ? 'Copied' : 'Copy'}
                  </button>
                  <p className="pr-20 text-sm font-medium text-slate-900">{template.label}</p>
                  <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{template.body}</pre>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </section>

      <section className={cardClasses()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Workflow Stages</h3>
            <p className="mt-1 text-sm text-slate-600">Tick tasks off as you go. The state is saved per showcase workflow instance.</p>
          </div>
          {actionState.error ? <p className="max-w-sm text-sm text-red-700">{actionState.error}</p> : null}
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {taskGroups.map((group) => {
            const groupCompleted = group.tasks.filter((task) => task.completed).length;
            return (
              <div key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-slate-900">{group.label}</h4>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {groupCompleted}/{group.tasks.length}
                  </span>
                </div>
                <ul className="mt-3 space-y-3 text-sm text-slate-700">
                  {group.tasks.map((task) => (
                    <li key={task.id} className="flex gap-3">
                      <CheckboxButton
                        checked={task.completed}
                        pending={actionState.pendingTaskId === task.id}
                        onToggle={() => handleToggleTask(group.id, task)}
                      />
                      <div className="min-w-0">
                        <p className={task.completed ? 'text-slate-500 line-through' : 'text-slate-700'}>{task.label}</p>
                        {task.completedAt ? (
                          <p className="mt-1 text-xs text-slate-500">Completed: {new Date(task.completedAt).toLocaleString('en-GB')}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
                {group.guidance?.length ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Guidance</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-600">
                      {group.guidance.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-[0.15rem] h-1.5 w-1.5 rounded-full bg-slate-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ); 
          })}
        </div>
      </section>
    </div>
  );
}
