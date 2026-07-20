---
status: canonical
audience: [human, agent]
last_verified: 2026-07-20
---
# Workflow design principles

Read this before adding or materially changing an admin workflow. A workflow
earns its place when it reduces repeated mental juggling and leaves the next
person able to understand what happened.

## Core pattern

```text
Context and evidence
-> recommended safe action
-> explicit human confirmation where required
-> deterministic write
-> progress/audit record
-> clear open or closed state
```

This is the operating loop in workflow form:

```text
Detected / captured -> Guided -> Actioned -> Logged -> Resolved / Kept Active
```

The goal is not more forms. It is a calm path from “I need to remember several
things” to a completed, inspectable outcome.

## Cognitive-load test

A strong workflow:

- shows only the context needed for the current decision;
- makes source, freshness, uncertainty, and the safest next action clear;
- reuses known data instead of asking for it again;
- separates review from consequential action;
- reports partial success and what remains unfinished;
- logs meaningful outcomes without creating another inbox;
- can be followed by Tom or Fenella without relying on Finn's memory.

A weak workflow exposes every field, hides which system changed, makes `Done`
ambiguous, or creates another list someone must remember to check.

## Source-of-truth boundary

Workflows must name what they read and write. MMS owns lesson/calendar facts;
Stripe owns provider payment facts; the registry owns portal configuration;
Sheets owns First Chord operating records and workflow state; Gmail and WhatsApp
are delivery channels.

Derived context, issue queues, classifications, and proposals never become
underlying truth merely because they are displayed or stored. Use
[ownership](../architecture/data/ownership.md) and
[state tabs](../architecture/data/state-tabs.md) before adding a source or lane.

Avoid live vendor reads on ordinary page load. Prefer an explicit or scheduled
refresh and show freshness where it affects a decision.

## Approval boundary

Keep these deterministic and explicitly human-approved:

- payment-expectation or Stripe changes;
- parent-facing messages, except the narrow tutor-approved Practice Chat email;
- WhatsApp sending;
- student archive/deletion;
- MMS student, attendance, or lesson changes;
- issue resolution when the source still disagrees.

The server must revalidate consequential input rather than trust a preview or a
model-supplied confirmation. Existing workflow code performs the action and logs
the outcome. AI output may explain or propose; it never supplies human approval.

Communication-specific rules:

- `Communication_Log` records copied-to-send, not proven delivery.
- Inbound messages and classifications are evidence for review, not commands.
- Reply drafts remain proposals even when policy-validated.
- Practice Chat's lesson-note email exception does not authorise payment,
  onboarding, pause, marketing, or general-message automation.

## Page and navigation rules

The `/admin` overview is a meeting-start surface, not a complete status board.
A front-page card should answer at least one:

- What must be done today?
- What needs attention soon?
- Which actionable loop is open?
- Which prompt protects time for improving the school?

Background health and passive numbers stay lower or inside their workflow unless
something is wrong. Navigation represents modes of work, not every data object:

```text
Overview | Issues | Workflows | Planning
```

Use [copy and tone](./copy-and-tone.md) and [UI conventions](./ui-conventions.md)
for action wording, async feedback, density, and error states.

## Existing workflow boundaries

| Surface | Distinctive boundary | Focused document |
|---|---|---|
| Issues | Detected problems have workflow state; reads do not change payment truth | [Admin loop](../architecture/system/admin-loop.md) |
| Waiting/onboarding | Placement hints do not reserve; multi-system onboarding preserves partial results | [School policy](./school.md) |
| Parent understanding | Manual campaign state; copies follow-up text but does not send or edit MMS | AGENTS workflow map |
| Tutor absence | Per-date decisions remain auditable; repeated cancellations may group parent/pause work without deleting source rows | [Absence bridge](../workflows/tutors/absence-to-pause.md) |
| Planning | Human work, reflection, and notes; not project management or a second issue queue | [State tabs](../architecture/data/state-tabs.md) |
| Pause completion | Requires confirmation, logs progress and `Event_Log`, then aligns expectation through the existing route | [Payments](./payments.md) |
| Payroll | Review and export prepare provider work; a human pays in Wise | [Paying tutors](../workflows/finance/paying-tutors.md) |
| Incoming messages | Capture, match, classify, and draft are proposals; no automatic school action or send | [WhatsApp bridge](../operations/integrations/whatsapp-incoming-bridge.md) |
| Practice Chat | Recipient-specific confirmation, narrow tutor/student check, and delivery-key claim precede MMS/Gmail work | [Delivery contract](../workflows/practice-chat/delivery.md) |

`/admin/insights` is a read-only learning surface, not another queue. Individual
family concerns close in their existing workflow; recurring patterns may become
one bounded Planning experiment with an owner and review date.

## What not to build yet

- a generic workflow engine or full CRM;
- heavy owner/permission/project-management layers;
- automatic WhatsApp or Stripe actions;
- AI as the reason an operational action occurs;
- a new state tab where an existing lane safely fits;
- passive dashboards without a decision or action they improve.

## Shipping test

Before shipping, ask:

1. Does this remove a real repeated burden?
2. Is every source and owner clear?
3. Are missing, stale, and conflicting facts fail-safe?
4. Is the risky step explicit and human-approved?
5. Can the final state be inspected and recovered later?
6. Does the UI handle loading, success, failure, empty state, narrow screens, and
   keyboard/focus use without relying on a reload?
7. Are the focused tests, state contract, current status, and recovery notes
   updated where the behaviour actually changed?
