'use client';

import { useState } from 'react';

const STATUS_CLASSES = {
  attention: 'border-red-200 bg-red-50 text-red-900',
  caution: 'border-amber-200 bg-amber-50 text-amber-900',
  clear: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  neutral: 'border-slate-200 bg-slate-50 text-slate-800',
};

function formatGeneratedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
export default function IssueExplanationPanel({ issue }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: 'idle', explanation: null, error: '', aiBriefingAvailable: false });
  const [aiState, setAiState] = useState({
    status: 'idle',
    briefing: null,
    requestId: '',
    error: '',
    feedback: '',
  });

  async function loadExplanation() {
    setState({ status: 'loading', explanation: null, error: '', aiBriefingAvailable: false });
    try {
      const query = new URLSearchParams({
        source: issue.source || '',
        issueType: issue.type || '',
      });
      const response = await fetch(`/api/admin/issues/${encodeURIComponent(issue.mmsId)}/explanation?${query}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load the explanation');
      setState({
        status: 'ready',
        explanation: body.explanation,
        error: '',
        aiBriefingAvailable: body.aiBriefingAvailable === true,
      });
    } catch (error) {
      setState({
        status: 'error',
        explanation: null,
        error: error.message || 'Could not load the explanation',
        aiBriefingAvailable: false,
      });
    }
  }

  function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && state.status === 'idle') loadExplanation();
  }

  async function loadAiBriefing() {
    setAiState({ status: 'loading', briefing: null, requestId: '', error: '', feedback: '' });
    try {
      const response = await fetch(`/api/admin/issues/${encodeURIComponent(issue.mmsId)}/ai-explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: issue.source || '',
          issueType: issue.type || '',
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The AI pilot is unavailable right now');
      setAiState({
        status: 'ready',
        briefing: body.briefing,
        requestId: body.requestId || '',
        error: '',
        feedback: '',
      });
    } catch (error) {
      setAiState({
        status: 'error',
        briefing: null,
        requestId: '',
        error: error.message || 'The AI pilot is unavailable right now',
        feedback: '',
      });
    }
  }

  async function submitAiFeedback(rating, reason = '') {
    if (!aiState.requestId) return;
    if (rating === 'not_helpful' && !reason) {
      setAiState((current) => ({ ...current, feedback: 'choose_reason' }));
      return;
    }

    setAiState((current) => ({ ...current, feedback: 'saving' }));
    try {
      const response = await fetch('/api/admin/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: aiState.requestId, rating, reason }),
      });
      if (!response.ok) throw new Error('Feedback could not be saved');
      setAiState((current) => ({ ...current, feedback: 'saved' }));
    } catch {
      setAiState((current) => ({ ...current, feedback: 'error' }));
    }
  }

  if (!issue?.mmsId || !issue?.source || !issue?.type) return null;

  const explanation = state.explanation;
  const generatedAt = formatGeneratedAt(explanation?.generatedAt);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="text-sm font-medium text-blue-700 transition hover:text-blue-950"
      >
        {open ? 'Hide explanation' : 'Why does this issue exist?'}
      </button>

      {open ? (
        <section className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4" aria-label="Why this issue exists">
          {state.status === 'loading' ? (
            <p className="text-sm text-slate-600" role="status">Checking the rule and evidence…</p>
          ) : null}

          {state.status === 'error' ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-red-700" role="alert">{state.error}</p>
              <button
                type="button"
                onClick={loadExplanation}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50"
              >
                Try again
              </button>
            </div>
          ) : null}

          {state.status === 'ready' && explanation ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Deterministic explanation</p>
                  <h4 className="mt-1 font-semibold text-slate-950">{explanation.rule.name}</h4>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[explanation.status.tone] || STATUS_CLASSES.neutral}`}>
                  {explanation.status.label}
                </span>
              </div>

              {state.aiBriefingAvailable ? (
              <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-3">
                {aiState.status === 'idle' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">AI pilot</p>
                      <p className="mt-1 text-sm text-violet-950">Turn the checked evidence below into a short briefing.</p>
                    </div>
                    <button
                      type="button"
                      onClick={loadAiBriefing}
                      className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100"
                    >
                      Explain this simply
                    </button>
                  </div>
                ) : null}

                {aiState.status === 'loading' ? (
                  <p className="text-sm text-violet-900" role="status">Preparing a short AI briefing…</p>
                ) : null}

                {aiState.status === 'error' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">AI pilot unavailable</p>
                      <p className="mt-1 text-sm text-violet-950" role="alert">{aiState.error}</p>
                      <p className="mt-1 text-xs text-violet-700">The deterministic explanation below is unaffected.</p>
                    </div>
                    <button
                      type="button"
                      onClick={loadAiBriefing}
                      className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100"
                    >
                      Try again
                    </button>
                  </div>
                ) : null}

                {aiState.status === 'ready' && aiState.briefing ? (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">AI-generated pilot summary</p>
                        <p className="mt-1 font-semibold text-slate-950">{aiState.briefing.headline}</p>
                      </div>
                      <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs text-violet-800">
                        Check against evidence
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-800">{aiState.briefing.explanation}</p>
                    {aiState.briefing.whatToCheck ? (
                      <p className="mt-2 text-sm text-slate-800"><span className="font-medium">What to check:</span> {aiState.briefing.whatToCheck}</p>
                    ) : null}
                    {aiState.briefing.caveat ? (
                      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                        {aiState.briefing.caveat}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-violet-700">
                      This wording is generated from the deterministic explanation below. It cannot change or resolve the issue.
                    </p>

                    <div className="mt-3 border-t border-violet-200 pt-3">
                      {aiState.feedback === 'saved' ? (
                        <p className="text-xs font-medium text-violet-900">Thanks — feedback recorded.</p>
                      ) : (
                        <>
                          <p className="text-xs text-violet-800">Was this clearer than the standard explanation?</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={aiState.feedback === 'saving'}
                              onClick={() => submitAiFeedback('helpful')}
                              className="rounded-md border border-violet-300 bg-white px-2.5 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-60"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              disabled={aiState.feedback === 'saving'}
                              onClick={() => submitAiFeedback('not_helpful')}
                              className="rounded-md border border-violet-300 bg-white px-2.5 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-60"
                            >
                              No
                            </button>
                          </div>
                        </>
                      )}

                      {aiState.feedback === 'choose_reason' ? (
                        <div className="mt-2 flex flex-wrap gap-2" aria-label="Why the AI summary was not helpful">
                          {[
                            ['incorrect_or_unsupported', 'Wrong fact'],
                            ['missed_uncertainty', 'Missed uncertainty'],
                            ['confusing', 'Confusing'],
                            ['no_added_value', 'No added value'],
                          ].map(([reason, label]) => (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => submitAiFeedback('not_helpful', reason)}
                              className="rounded-md border border-violet-300 bg-white px-2.5 py-1.5 text-xs text-violet-900 hover:bg-violet-100"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {aiState.feedback === 'error' ? (
                        <p className="mt-2 text-xs text-red-700">Feedback was not recorded. The issue itself was not changed.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">The rule</p>
                <p className="mt-1 text-sm text-slate-800">{explanation.rule.statement}</p>
                <p className="mt-2 text-sm font-medium text-slate-950">Result: {explanation.rule.result}</p>
                <p className="mt-2 text-xs text-slate-600">{explanation.status.detail}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Evidence source</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{explanation.source.label}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Detector {explanation.source.detectorRechecked ? 'rechecked now' : 'not rechecked'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Issue Queue</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{explanation.queue.label}</p>
                  <p className="mt-1 text-xs text-slate-600">Workflow state, not source truth</p>
                </div>
              </div>

              {explanation.evidence.length ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Evidence used</p>
                  <dl className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-3">
                    {explanation.evidence.map((item) => (
                      <div key={`${item.label}:${item.value}`} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <dt className="text-sm text-slate-600">{item.label}</dt>
                        <dd className="text-sm font-medium text-slate-900 sm:text-right">
                          {item.value}
                          <span className="block text-xs font-normal text-slate-500">{item.sourceRole}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                  No detailed source facts were retrieved; only the recorded issue state is available.
                </p>
              )}

              {explanation.notChecked.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Not checked</p>
                  <ul className="mt-2 space-y-1 text-sm text-amber-950">
                    {explanation.notChecked.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
              ) : null}

              {explanation.ambiguity.length ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Needs human judgement</p>
                  <ul className="mt-2 space-y-1 text-sm text-violet-950">
                    {explanation.ambiguity.map((item) => <li key={item.code}>• {item.explanation}</li>)}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Recommended next step</p>
                <p className="mt-1 text-sm text-emerald-950">{explanation.nextStep.label}</p>
                <p className="mt-2 text-xs text-emerald-800">This panel cannot change records or resolve the issue. Use the existing reviewed action above.</p>
              </div>

              {generatedAt ? <p className="text-right text-xs text-slate-500">Explanation checked {generatedAt}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
