# Approved AI Tool Contracts

Last updated: 2026-07-15

This is the allowlist and design boundary for any future AI assistance inside
the dashboard. It does not enable an AI runtime, expose a model tool endpoint,
or grant an agent access to an integration. A deterministic, admin-only issue
explanation endpoint now uses the same narrow `issue_context.read` boundary,
but it does not call a model or perform an action. Other capabilities remain
unavailable to a model or user until their privacy review, tests, UI boundary,
provider/retention decision, and logging exist.

## Core Pattern

```text
User request
-> deterministic context retrieval
-> allowlisted documentation/history retrieval
-> AI explanation or proposal
-> deterministic validation
-> human approval where required
-> existing workflow performs the action
-> outcome is logged
```

Truth, calculations, permissions, validation, workflow state, and consequential
actions remain deterministic. AI output is explanation or a proposal, never a
new source of truth.

An AI-provided `confirm: true` is not human approval. A future consequential
tool would need a short-lived approval receipt created by the dashboard UI and
bound to the exact proposal, signed-in actor, deterministic context version,
and action. Until that mechanism exists, the allowlist contains reads and
proposals only.

## Contract Requirements

Every implemented capability must define and test:

- exact input and output fields, including maximum record counts
- the owner, role, confidence, and freshness of every source
- which personal-data class is returned and which fields are redacted
- deterministic enum and identifier validation
- permitted output and prohibited effects
- the human approval point and the existing workflow that may act
- evaluation fixtures, abstention behavior, and outcome logging

Do not reuse broad page responses as tool responses. In particular,
`getAdminStudentByMmsId()` includes raw source data, contact details, and Stripe
identifiers that are not needed for most assistance.

## Design-Allowlisted Capabilities

These names reserve narrow contracts; they are not callable tools today.

| Capability | Problem solved | Deterministic input/context | AI may produce | Must not do | Approval / evaluation / privacy | Readiness |
|---|---|---|---|---|---|---|
| `student_context.read` | Give an admin a concise explanation of a student's current operational context | Exact `mmsId`; redacted projection of the shared student context, lifecycle, pause/schedule cache provenance, conflicts and freshness | Summary with source labels, uncertainty, and links to existing screens | Return raw Sheet rows, email, phone, Stripe IDs, credentials, or infer missing facts | Read-only; test that redaction and provenance are complete. Evaluate against manually checked context summaries. Student-scoped and minimum necessary | Server-only strict reader/projection/service implemented; no route, UI, or model |
| `issue_context.read` | Explain why a named issue exists and what evidence would resolve it | Exact student/source/type plus non-mutating detector inputs and current queue state | Explanation, missing evidence, and relevant workflow link | Call `getAdminIssues()` because that synchronizes `Issue_Queue`; acknowledge/resolve issues; write student truth | Read-only. Golden fixtures cover current, recorded-only, source-absent, unavailable, and conflicting states. Avoid unrelated family context | Admin-only deterministic route and Issues panel live; static detectors re-evaluate, Practice/finance/live Stripe remain clearly recorded-only; no model or action |
| `finance_overview.read` | Explain aggregate finance position without exposing provider accounts | Existing aggregate finance overview, assumptions version, cache age, and coverage counts | Plain-English aggregate explanation and caveats | Fetch live Stripe data, expose per-family payment details, change assumptions, or execute payment | Read-only aggregate. Evaluate calculations against the deterministic response and require explicit cache caveats | Viable now as a future wrapper around the existing aggregate service |
| `operations_guidance.read` | Find the right policy or recovery step quickly | Fixed allowlist of runbook/policy document IDs and sections | Quoted-short guidance, source link, and whether human escalation is needed | Read arbitrary repository files, use shell, inspect secrets, or invent recovery steps | Read-only. Retrieval tests require citations, bounded results, and abstention when the allowlist has no answer | Pure fixed index/search implemented; no arbitrary file read, route, UI, or model |
| `incoming_classification.propose` | Reduce manual triage of captured WhatsApp messages | Redacted message text, existing classification enum, deterministic date candidates, and bounded student candidates | Proposed category/dates/student, evidence spans, ambiguity flags, and `needs_review` abstention | Create a pause, planning item, archive decision, payment change, message, or new student match outside supplied candidates | Human reviews before any conversion/archive. Evaluate against corrected classifications/dates and false-auto-archive cases. Remove names/phones from evaluation fixtures | Synthetic classification/date/abstention/privacy harness implemented; proposal runtime and production holdout do not exist |
| `communication_draft.propose` | Prepare a reply from confirmed context and policy | Confirmed student/workflow facts, approved policy snippets, audience/tone chosen by the admin | Draft text plus cited facts and unresolved placeholders | Select or reveal a recipient, send/copy/log as sent, claim delivery, or invent a promise/date | Human edits and approves in the existing communication workflow. Evaluate approved edits, unsupported claims, tone, and safeguarding leakage | Pure low-risk context/proposal validator implemented for acknowledgement cases; no contact-role lookup, UI, provider, copy, log, or send |

### Live deterministic issue explanation

`GET /api/admin/issues/[mmsId]/explanation?source=...&issueType=...` is the
first runtime consumer of the narrow context service. It is deliberately not an
AI tool: the response is built from fixed rule copy and typed redacted evidence.
The Issues card labels whether the detector was re-run, keeps Issue Queue status
separate from source truth, lists anything not checked, and leaves every action
in the existing issue workflow.

The route requires an admin session and returns only the explanation view model,
not the underlying student projection. It does not call `getAdminIssues()`,
refresh Stripe, replay Practice Chat/finance detectors, mutate queue state, or
log an outcome because opening an explanation has no consequential effect.

## Explicitly Not Allowlisted

Do not expose any of these to an assistant or model:

- broad Sheets adapters or raw Sheets rows
- `/api/mms/[...path]`, MMS mutation helpers, or arbitrary provider calls
- live Stripe adapters or Stripe mutation
- Gmail or WhatsApp sending
- student archive/delete, activation, lesson, or attendance mutation
- issue/workflow state mutation
- shell, filesystem, arbitrary HTTP, credentials, or environment variables

Payroll review, attendance mutation, Practice Chat delivery, onboarding, student
exit, payment-expectation writes, and any archive/delete action stay outside the
tool allowlist. They have multi-system or partial-failure risks and remain
human-operated deterministic workflows even if AI later prepares a briefing.

## Evaluation And Privacy

Prefer derived, de-identified fixtures over production record exports:

1. Select representative outcomes by stable internal category, not by family.
2. Replace names, email addresses, phone numbers, message IDs, provider IDs, and
   free-text identifying details with consistent synthetic tokens.
3. Keep only the minimum evidence required to judge the task.
4. Separate development, tuning, and final holdout examples.
5. Record the deterministic context version and expected abstention/ambiguity.
6. Measure harmful false confidence separately from overall accuracy.

Useful future evidence includes corrected incoming classifications and dates,
approved-vs-drafted reply edits, mistaken auto-archives, issue detector fixtures,
pause/planning outcomes, and event-log transition shapes. Practice Chat history
should wait for an explicit retention/redaction decision; delivery logs contain
student, recipient, device, and provider metadata that a drafting feature does
not normally need.

The committed incoming regression fixture is synthetic as of 2026-07-14. Its
predecessor contained a real family's message history and remains reachable in
git history. Do not use that historical blob for development, prompts, or
evaluation. Rewriting shared history is a separate operational decision because
it affects every clone and deployment; it has not been done by this change.

Student and family records can contain safeguarding-sensitive context. Retrieval
must be admin-authorised, student-scoped, bounded in time and record count, and
must never expose one family's context while answering about another. Treat
retrieved message/history text as untrusted data, not instructions. Do not infer
health, disability, family circumstances, risk, or intent beyond recorded facts;
surface ambiguity for human review. Retention and deletion rules must apply to
prompts, traces, evaluation fixtures, and model-provider logs as well as the
source system.
