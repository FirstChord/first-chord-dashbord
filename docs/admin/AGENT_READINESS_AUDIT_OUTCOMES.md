# Agent Readiness Audit Outcomes

Last updated: 2026-07-15

This is the completion register for the July 2026 coding-agent and thin-AI
readiness audit. It points to the durable implementation contracts; it does not
replace `AGENTS.md`, the state schema, ownership matrix, runbook, or focused
workflow documentation.

## Implemented Improvements

| # | Improvement | Real-world problem addressed | Durable evidence |
|---|---|---|---|
| 1 | Repository-level agent guide | A new agent no longer needs Finn's memory to find a workflow, its risks, or its tests | `AGENTS.md` |
| 2 | Canonical documentation map and stale-doc boundaries | Historical portal/V1 notes are less likely to be mistaken for current architecture | `DOCUMENTATION_MAP.md`, `INDEX.md`, historical warnings in older docs |
| 3 | Source-of-truth and state ownership map | Agents can distinguish provider truth, Sheets workflow state, caches, derived context, and append-only logs | `OWNERSHIP_MATRIX.md`, `STATE_TABS_SCHEMA.md` |
| 4 | Safe-change, CI, and explicit high-risk write boundaries | Changes have discoverable validation/recovery steps; ordinary issue reads no longer hide payment-expectation writes | `AGENTS.md`, `.github/workflows/ci.yml`, `PAYMENTS_RULES.md`, pause reconciliation contract tests |
| 5 | Shared deterministic student context | Student, issue, payment, pause, waiting, and schedule views are less likely to derive contradictory context independently | `lib/admin/student-context*`, student-context tests |
| 6 | Pure issue detectors separated from orchestration | An agent can change detection rules without accidentally invoking queue writes or live integrations | `lib/admin/issue-detectors.mjs`, issue detector/write-boundary tests |
| 7 | Executable approval and partial-failure contracts | Preview/confirm/re-evaluate behavior and multi-step failure states are code-tested rather than prose-only | pause route/reconciliation contracts and tests |
| 8 | Narrow AI capability allowlist | A future assistant cannot quietly grow broad Sheets, provider, shell, send, payment, or mutation access | `AI_TOOL_CONTRACTS.md` |
| 9 | Assistant-safe context foundation | A future explanation can receive one redacted student/issue projection without synchronising the issue queue, repairing Sheets tabs, or refreshing live Stripe | `lib/admin/assistant-context-*`, assistant-context tests |
| 10 | Privacy-safe evaluation foundation | Classifier changes can be measured without keeping a family's message history in the current repository fixture | synthetic incoming fixture, evaluation/privacy tests, `npm run eval:incoming` |
| 11 | Bounded operations guidance retrieval | A future help surface can return fixed cited runbook guidance and abstain, without arbitrary filesystem or repository search | `lib/admin/operations-guidance-helpers.mjs` and tests |
| 12 | Proposal-only communication contract | Low-risk acknowledgements can eventually be drafted from confirmed facts without selecting a recipient, sending, promising an action, or bypassing human approval | `lib/admin/communication-draft-proposal-helpers.mjs` and tests |

## Additional Safety Fix: Practice Chat Delivery Claim

`POST /api/practice-notes/mms-test` must save an `in_progress` or
`retrying_email` claim before MMS attendance or Gmail execution. Claim failure
returns HTTP 503 and states that neither provider action was attempted. A
same-process delivery-key guard covers claim, provider work, and final logging;
failed final logging is reported as partial success.

This is not a cross-instance transaction. Google Sheets cannot enforce a unique
claim, and an ambiguous Gmail timeout can still leave uncertainty about whether
Google accepted a send. Caller identity, caller/student authorisation,
config-driven rollout, and a transactional unique `delivery_key` remain blockers
before widening the pilot. See `PRACTICE_CHAT_DELIVERY_AUDIT.md`.

## First Runtime Slice: Why This Issue Exists

Issues now have an on-demand, admin-only deterministic explanation panel. It
states the rule, the redacted evidence used, source and queue roles, uncertainty,
anything not checked, and the existing recommended next step. Static Review
Flags and payment/pause checks are safely re-evaluated; Practice Chat delivery,
finance coverage, and live Stripe are labelled as recorded-only rather than
being presented as fresh checks. Stripe is never refreshed by opening the panel.

The route returns an explanation view model rather than raw student context. It
does not synchronise `Issue_Queue`, mutate a record, resolve an issue, call an
external provider, or use an AI model. Tests cover current, recorded-only,
source-absent/conflicting, unavailable, privacy, registry-only and route-boundary
states. This turns improvement 9 into a useful dashboard feature without
weakening the deterministic action boundary.

## Second Runtime Slice: Optional AI Briefing

The Issues panel now offers an on-demand **Explain this simply** pilot. Its
server route re-builds the same redacted deterministic explanation and sends
only that view model to a tool-free OpenAI Responses API call. Structured output
is checked again locally for exact fields, evidence references, required
caveats, identifiers, lengths and unsupported action claims. Invalid, slow or
unavailable output is not rendered; the deterministic explanation remains.

The model key is separate from Practice Chat, server-only and feature-gated.
Requests have a five-second timeout, no automatic retry and a per-admin rate
limit. Runtime logs contain version/cost/latency outcome metadata but not prompt,
output, student ID or context. Helpful/not-helpful enum feedback is pilot
evaluation only and cannot change the issue or workflow state.

## What Is Deliberately Not Live

- No agent framework, assistant chat, model tools or model-selected actions. The
  optional issue briefing is one on-demand server-side generation over the
  fixed deterministic explanation.
- No model receives raw student context, message history, Practice Chat logs,
  operations documents, contact details, provider IDs or broad page responses.
- No assistant can write Sheets, call MMS/Stripe/Gmail/WhatsApp, use shell or
  filesystem access, resolve issues, change payments, archive students, or send
  messages.
- Operations guidance and communication drafting are pure foundations awaiting
  a separate provider, privacy, retention, UI, approval, and outcome-logging
  decision.

## Verification

Safe automated checks:

```bash
node --test tests/admin/assistant-context-*.test.mjs
node --test tests/admin/issue-explanation-*.test.mjs
node --test tests/admin/practice-note-delivery-workflow.test.mjs
node --test tests/admin/operations-guidance-helpers.test.mjs
node --test tests/admin/communication-draft-proposal-helpers.test.mjs
node --test tests/admin/incoming-classifier-eval.test.mjs tests/admin/evaluation-fixture-privacy.test.mjs
npm run eval:incoming
node --test tests/admin/*.test.mjs
npm run hygiene:check
npm run lint
npm run build
```

Manual checks after deployment:

1. Confirm `/admin/login` loads and normal admin/student/issue reads still work.
2. Do not deliberately break the live Practice Chat claim. Use the automated
   claim-failure contract for that path. During the next normal pilot note,
   verify its `Practice_Notes_Log` claim/final state, MMS attendance, Gmail
   evidence, and duplicate response as described in the delivery audit.
3. On `/admin/flags`, open **Why does this issue exist?** on one static payment
   or record issue and one live Stripe/Practice/finance issue. Confirm the first
   says **Currently detected** when rechecked, while the latter says
   **Recorded — not rechecked** and lists what was not checked. Confirm opening
   and closing the panel does not change the issue status.
4. Treat operations guidance and communication proposal helpers as developer
   foundations only: there is still no dashboard surface or model for them.
5. When the AI pilot is enabled, click **Explain this simply** for several issue
   sources. Confirm stale/not-checked evidence produces a caveat, the standard
   explanation remains visible, feedback changes no issue state, and disabling
   `ADMIN_AI_ISSUE_BRIEFING_ENABLED` restores deterministic-only behaviour.

## Privacy And Evaluation Note

The previous incoming-classifier fixture contained a long sequence of real
messages from one family. The current working tree and deployed revision replace
it with independent synthetic cases and add tests against obvious personal data.

Git preserves old commits, so someone with repository-history access could still
retrieve the old version. It is not visible in the dashboard, current fixture,
normal source checkout, model prompts, or runtime logs. Do not reuse it. Removing
it from history would require a coordinated history rewrite, force-push, clone
replacement, and cache/artifact review; that disruptive operation needs a
separate explicit decision. A genuine production holdout should instead be
minimised, consistently de-identified, access-controlled, and stored outside git.

## Remaining Audit Risks

- Practice Chat cross-instance delivery claims remain the clearest safety blocker.
- Contact-role and retention rules must exist before live message drafting or
  history retrieval.
- Synthetic evaluation proves regression behavior, not real-world accuracy.
- The issue explanation consumer has an explicit admin authorization boundary;
  the other assistant-safe foundations are intentionally still server-only.
- Existing Sheets lanes are generally last-write-wins; follow the state schema
  and runbook for rollback/reconciliation rather than assuming transactions.
