# Workflow Design Principles

This is the shared design note for First Chord admin workflows. Read this before adding a new workflow page or changing an existing one.

## Purpose

Workflows should reduce admin cognitive load.

The dashboard should help Finn, Tom, and Fenella move from "I need to remember/check/decide several things" to a calm sequence of:

```text
understand context -> choose a safe action -> complete the loop -> leave an audit trail
```

The aim is not to add forms. The aim is to make recurring admin work easier to trust, delegate, and finish.

The broader aim is to reduce the energy cost of keeping the school running, so leadership attention can be spent improving the school.

## Core Rule

A workflow earns its place when it removes mental juggling.

Good workflow pages:

- show only the context needed for the next decision
- make the safest next action obvious
- keep vendor/source-of-truth boundaries visible
- reduce copy/paste and tab-switching where possible
- log meaningful progress automatically
- keep risky actions human-approved
- show what remains unfinished

Weak workflow pages:

- ask admins to re-enter data the dashboard already knows
- show every possible field before the user needs it
- create another list that must be remembered separately
- hide whether an action actually changed Sheets, MMS, Stripe, Gmail, or registry
- make "Done" mean something vague

## Workflow Pattern

Most admin workflows should follow this shape:

```text
Context
Evidence/source
Recommended action
Human confirmation
System write
Progress/audit log
Closed/open follow-up state
```

This is the V3 loop pattern in workflow form:

```text
Detected / captured -> guided -> actioned -> logged -> resolved / kept active
```

## Cognitive Load Principles

Use these questions when designing a workflow:

- What does the admin need to know right now?
- What can the system infer safely?
- What action is irreversible, payment-affecting, parent-facing, or vendor-facing?
- Can one explicit button replace several remembered manual steps?
- Does the final state clearly say what happened and what is still open?
- Would Tom or Fenella know what to do without asking Finn?
- Does this reduce the energy cost of running the school, or create another thing to manage?

Do not make workflows dense just because more data exists. Details can live behind panels, links, or student pages.

## Overview / Meeting Surface Rule

The `/admin` overview is not a full status board. It is the place Finn and Tom start a meeting or admin session.

Front-page cards should earn attention by answering one of these:

- What must be done today?
- What needs attention soon?
- What loop is open and actionable?
- What prompt helps us work on the school after the admin is clear?

Background context, health checks, and useful-but-passive numbers should stay lower on the page or inside their own workflow pages unless something is wrong. Big numbers should be used sparingly; prefer human labels and smaller count pills when the number is supporting detail.

## Source-Of-Truth Boundaries

Workflows should be explicit about what they read and write:

- Sheets = operational school truth
- MMS = lesson/calendar/billing-profile truth
- Stripe = payment-provider truth
- Registry = portal config truth
- Gmail/WhatsApp = communication delivery channels
- Dashboard state tabs = workflow state and audit memory

A workflow should not silently promote derived context into truth.

Before adding a new state tab or external read, check `docs/admin/STATE_TABS_SCHEMA.md`. It is the canonical lane map for dashboard-owned state: truth, cache, workflow state, append-only log, and derived context.

Do not add page-load MMS calls casually. MMS should be read on explicit refresh, scheduled refresh, or when the workflow genuinely needs live vendor truth. If a page can use `Schedule_Context`, cached free-slot context, or existing state rows, prefer that.

## Approval Boundaries

Keep these approval-first:

- payment expectation changes
- Stripe pause/resume/cancel actions
- parent-facing messages, except the narrow Practice Chat lesson-note email category
- WhatsApp sending
- deleting/archive actions
- MMS status or lesson changes

The dashboard can prepare, prefill, copy, and log. The human approves the consequential step.

Communication boundary:

- `Communication_Log` records messages copied to send.
- Copied is not the same as sent.
- The dashboard currently does not send WhatsApp messages.
- Practice Chat lesson-note email is the narrow automated-email exception; do not treat it as precedent for payment, pause, onboarding, WhatsApp, marketing, or general parent messaging.

## Current Workflow Surfaces

### Issues

`/admin/flags` manages system-detected problems. Issues are operational objects with state, not just warnings.

State:

- `Issue_Queue`
- `Event_Log`

### Waiting List

`/admin/waiting` is the placement/contact decision surface. It shows contact details, MMS sign-up context, waiting state, and possible free slots.

State:

- `Waiting_List_State`
- MMS `Free` calendar slots are source context, not reservations

### Onboarding

`/admin/onboard` is the execution workflow after a waiting-list student is ready.

It writes across Sheets, registry, MMS, and generated portal config paths. Because it is multi-system, it needs visible step status and recovery clarity.

### Parent Understanding

`/admin/workflows/parent-understanding` is a campaign workflow for parent check-ins.

It is deliberately manual/approval-first:

- records understanding and feedback
- copies follow-up templates
- captures risk/follow-up state
- does not auto-send WhatsApp
- does not edit MMS contact details

State:

- `Parent_Understanding_State`
- consequential closes/escalations append to `Event_Log`

### Tutor Absence

`/admin/workflows/tutor-absence` turns "tutor is off" into a visible cover/cancel workflow.

The workflow should answer:

- which lessons are affected?
- can they be covered by a same-instrument tutor?
- which parents still need a message?
- what remains unfinished?

State:

- `Tutor_Absence_State`

### Planning / Brain Inbox

`/admin/planning` captures human-created work: ideas, initiatives, and actions.

Planning is not project management. It exists to stop useful operational thoughts disappearing in WhatsApp, and to make meeting actions visible by owner/date/status.

Planning should stay scoped to capture, ownership, due work, meeting rhythm, initiatives, and student-linked operational tasks. Do not turn it into full project management, a generic ticketing system, or a second issue queue.

Planning has a `Meeting` view that separates the meeting rhythm into:

- keep things running
- move the school forward

It includes due work, waiting items, unassigned items, stalled/no-next-action items, tutor absence work, and the weekly Friday prompt: `Friday: what moved the school forward?`

The Friday prompt is intentionally a reflection record, not just a task. Writing into it appends dated entries to `Planning_Progress_Log`; the Meeting view shows recent reflections so future monthly or quarterly summaries can be built from real operating history.

Planning also supports lightweight school notes:

- `Learning note` = books, podcasts, courses, conversations, or teaching/leadership ideas being worked through
- `Strategic note` = bigger scratchpad thinking that is not yet a task
- the body can be open and messy: transcript summary, rough notes, bullets, or copied ChatGPT summary
- the wrapper should stay structured enough to retrieve later: title, area, owner, status, key ideas, First Chord applications, optional next action
- when something becomes executable, create a linked `Action` rather than replacing the original note

Finance can appear as an area label, but a real finance/forecasting layer should be designed separately. Do not turn school notes into an unreliable finance model.

State:

- `Planning_Items`
- `Planning_Progress_Log`

### Pause Planning

Pause planning is a good example of cognitive-load reduction.

Old mental load:

```text
remember student/date -> open pause PWA -> copy/send message -> return to dashboard -> mark confirmation -> set expectation -> mark task done
```

Current intended flow:

```text
structured pause task -> open prefilled pause PWA -> copy dashboard-generated parent message -> confirm two checks -> Mark pause completed
```

Older unstructured pause captures can be repaired from the card by adding the linked student and structured pause dates. This updates the existing planning item rather than creating a second task.

`Mark pause completed` is guarded. It only runs after the admin confirms:

- the payment pause tool was run
- the parent confirmation was sent/copied

Then it:

- logs the confirmation to `Planning_Progress_Log`
- sets `payment_expectation` to `stripe_paused_expected` through the student update route if needed
- writes the payment-affecting action to `Event_Log`
- marks the planning task `done`

The dashboard still does not run the Stripe pause directly from Planning.

## What Not To Build Yet

- a generic workflow engine
- heavy owner/assignment systems
- automatic WhatsApp sending
- automatic Stripe mutation from Planning or Issues
- AI as the reason a workflow action happens
- new Sheets tabs when an existing state lane can safely hold the workflow

## Design Test

Before shipping a workflow change, ask:

1. Does this reduce a real repeated admin burden?
2. Is the source of truth clear?
3. Is the risky step explicit and human-approved?
4. Is the final state inspectable later?
5. Would this still make sense to a new agent reading the docs?
