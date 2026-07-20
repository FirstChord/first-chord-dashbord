---
status: canonical
audience: [human, agent]
last_verified: null
---
# V3 Loop Architecture

## Purpose

V3 is about closing operational loops.

A loop means:

1. detect or surface a recurring admin problem
2. show enough context to make the right decision
3. provide a bounded action path
4. store the outcome
5. log the action when the outcome affects operational truth

This document defines the current loop pattern so future work can extend the system without creating separate, incompatible workflow models.

## Current Assessment

The architecture is sound enough to keep building.

The important foundation is already in place:

- `/admin/flags` has persistent issue state through `Issue_Queue`
- sensitive issue actions append audit rows to `Event_Log`
- payment issues now have explicit `payment_mode` and `payment_expectation`
- pause intent is visible through `Pause History`
- waiting-list, showcase, and holiday workflows have persistent state
- expensive vendor reads, especially Stripe, are manual or bounded rather than automatic on every page load

The main architectural risk is not a broken foundation.
The risk is allowing each new loop to invent its own state, action, and audit semantics.

## Loop Types

Not every loop needs the same weight.

### 1. Issue loops

Use for detected problems that should remain visible until cleared or intentionally ignored.

Current examples:

- review flags
- payment setup issues
- live Stripe mismatches
- pause expectation issues

Pattern:

- generated/current source creates an issue
- `Issue_Queue` stores status and source presence
- `Event_Log` stores meaningful actions
- issue remains active until source state changes or a human explicitly resolves/ignores it

This is the right pattern for high-friction or high-risk problems.

### 2. Workflow loops

Use for recurring operations where the main state is task progress.

Current examples:

- `/admin/showcase`
- `/admin/holidays`

Pattern:

- static workflow definition lives in code
- per-instance task state lives in Sheets
- checklist items represent true done/not-done actions
- guidance, timings, and message templates stay separate from checklist state

These do not need `Issue_Queue` unless a task becomes a detected operational problem.

### 3. Queue loops

Use for lightweight progression through a human process.

Current example:

- `/admin/waiting`

Pattern:

- source list comes from MMS
- admin state lives in a narrow state sheet
- status and note are enough for now
- notable status changes can append `Event_Log`

This should stay lighter than the issue system.

### 4. Vendor truth loops

Use for systems where live truth is expensive, risky, or externally authoritative.

Current examples:

- Stripe live status
- MMS lesson and billing profile state

Pattern:

- do not poll on every page load
- prefer explicit refresh, scheduled snapshot, or webhook later
- normalize raw vendor state before showing it to agents or workflow logic
- never let raw vendor facts override school intent automatically

## State And Audit Rules

### Use `Issue_Queue` when

- the item can reappear
- source presence matters
- humans need keep-active / ignore / resolved states
- the issue should survive page reloads and source refreshes

### Use a dedicated workflow state sheet when

- the work is a recurring checklist or queue
- task completion is the main state
- source presence is not meaningful
- the work is operational but not a detected defect

### Use `Event_Log` when

- an admin action changes operational truth
- an issue is acknowledged, ignored, resolved, reopened, or acted on
- a payment expectation or payment mode changes
- a waiting-list status changes
- future communication is drafted, approved, or sent

Routine checklist toggles do not need full audit rows unless they become consequential.

## Payment Loop Position

The payment loop is now correctly positioned as an issue loop plus bounded action layer.

Current boundary:

- Sheets owns `payment_mode`, `payment_expectation`, and stored Stripe IDs
- Stripe owns live customer/subscription/invoice truth
- `Pause History` owns intentional pause windows
- `/admin/flags` owns issue review and action state

The recent audit change was the right direction:

- bounded, reversible payment-expectation toggles on the issues page auto-record an audit note (action + issue type + summary); a free-text human note is no longer required for these self-documenting actions, but every action is still logged. (Updated 2026-06-22 — the old blanket "require a note" was friction without information gain when the action *is* the reason, e.g. "set active expected" on a `PAUSE EXPECTATION STALE` flag. A free-text note is still warranted for less-bounded/consequential actions.)
- payment field changes are logged
- issue-level payment actions are logged
- the issue is not auto-resolved simply because a field changed

Keep this conservative.
Do not add Stripe mutation commands until the internal action trail is consistently useful.

## Pause Loop Position

Pause handling is ready to become the next mature loop.

Current state:

- pause intent is read from `Pause History`
- payment expectation mismatches are visible as issues
- student detail gives guidance and quick expectation fixes
- live Stripe refresh can confirm whether billing agrees

Recommended next slice:

- make pause issues clearer as a closed loop
- add explicit audit notes to pause expectation quick actions where they originate from an issue
- clarify whether the source of truth is Pause History, payment expectation, or live Stripe for each mismatch
- keep Stripe pause/resume API commands out of scope for now

## Communication Layer Gate

Do not wire WhatsApp sending yet.

Before sending exists, the system needs:

- reusable message draft records
- approval state
- event log entries for draft / approve / send
- clear category policy for payment, pause, onboarding, and waiting-list messages
- a way to distinguish copy-ready text from actual communication history

Drafting can come before WhatsApp Cloud API integration.
Auto-send should remain out of scope until approval state is working.

## Near-Term Recommendations

1. Keep extending `/admin/flags` as the high-risk issue workbench, but avoid making it the home for every workflow.
2. Mature the pause loop next, using the same conservative action/audit pattern as payment.
3. Add a reusable communication draft layer before any WhatsApp integration.
4. Add cached Stripe snapshots before any broad payment automation or finance planning.
5. Keep recurring workflows lightweight unless they generate real issues.

## Non-Goals For The Next Few Slices

- no new database just to replace Sheets
- no automatic parent messaging
- no Stripe mutation commands from `/admin/flags`
- no broad assignment/owner system until issue volume proves it is needed
- no generic workflow engine unless the third or fourth recurring workflow exposes real duplication

## Implementation Guardrails

- Use normalized helper functions for issue, payment, pause, and workflow state.
- Keep raw vendor payloads out of UI decisions where possible.
- Prefer small, typed payloads in `payload_json` over new Sheets columns unless filtering/reporting requires columns.
- Log every issue-originated action that changes operational truth. Require a free-text human note for less-bounded/consequential actions; bounded reversible toggles (e.g. payment-expectation flips) may auto-record the note since the action is self-documenting.
- Keep checklist completion fast and low-friction.
- Let source refresh clear issues; do not resolve them just because an admin clicked a field fix.
