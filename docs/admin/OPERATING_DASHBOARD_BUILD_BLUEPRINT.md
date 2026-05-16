# Operating Dashboard Build Blueprint

## Purpose

This document turns the FirstChord admin-dashboard build into a reusable playbook.

It is for three audiences:

- future FirstChord agents continuing this system
- Finn/Tom if writing a blog or case study later
- another small service business that wants to build a similar internal operating dashboard

The core lesson is simple:

```text
Do not start by building a giant CRM.
Start by closing one recurring loop.
Then add context layers only when they make decisions clearer.
```

## The Pattern

The FirstChord dashboard is an internal operating system for recurring admin work.

The useful pattern is:

```text
Detected -> Guided -> Actioned -> Logged -> Resolved / Kept Active
```

This works because it does not just surface information. It helps a human move from noticing a problem to doing the next safe thing, while preserving enough state for someone else to continue later.

## What To Build First

### 1. Pick One Expensive Recurring Problem

Start with a problem that already costs human attention every week.

Good first loops:

- payment setup gaps
- failed payments
- mismatched records between two systems
- waiting-list follow-up
- recurring event checklist
- missing or stale operational data

Avoid starting with:

- a generic task manager
- a full CRM
- automated messaging
- AI agents
- a broad analytics dashboard

Those can come later, but they are poor foundations.

### 2. Define The Loop

For the chosen problem, write the loop in plain English:

```text
How is the problem detected?
What does the human need to understand?
What is the safest next action?
Where is the action recorded?
How does the problem disappear or reappear?
```

If you cannot answer those questions, the feature is probably too vague.

### 3. Separate Source Truth From Workflow State

Most small businesses already have truth spread across systems.

FirstChord example:

- Google Sheets `Students` = operational school truth
- Registry file = portal/dashboard configuration truth
- MMS = student status, lesson, calendar, and waiting-list truth
- Stripe = payment-provider truth
- `Issue_Queue` = dashboard workflow state
- `Event_Log` = append-only action history
- `Schedule_Context` = selected MMS facts cached for dashboard use

The key design rule:

```text
Do not pretend the dashboard owns facts that belong to another system.
Let the dashboard own workflow state, decisions, and audit history.
```

## Core Data Structures

### Issue Queue

Use an issue queue when the system detects a problem that may reappear.

Useful fields:

- issue_id
- issue_type
- mms_id or entity_id
- title
- severity
- status
- source_present
- first_seen_at
- last_seen_at
- last_action_at
- action_note

FirstChord uses this for `/admin/flags`.

The critical behavior is source presence:

- If the source still detects the problem, it stays active.
- If the source stops detecting it, the dashboard can show it as system-cleared.
- If it comes back later, it reappears with the same stable identity where possible.

### Event Log

Use an append-only event log for consequential actions.

Useful fields:

- event_id
- event_type
- actor
- entity_id
- issue_id
- created_at
- summary
- payload_json

Log actions that change operational truth:

- resolving or ignoring an issue
- changing payment expectation
- marking waiting-list status
- onboarding completion
- future message draft/approval/send events

Do not over-log trivial UI state. Checklist toggles can be lightweight unless they affect another person or external system.

### Dedicated Workflow State

Use a small state sheet/table when the work is a queue or recurring checklist rather than a detected defect.

Examples:

- `Waiting_List_State`
- `Showcase_Task_State`
- `Holiday_Workflow_State`

Keep the first version narrow:

- entity/workflow id
- status
- note
- updated_at

Add owners, due dates, categories, and permissions only after the workflow proves it needs them.

## Recommended Build Sequence

### Phase 1: Read-Only Operating View

Build a page that shows the current state from existing systems.

For example:

- students in Sheets
- waiting students in MMS
- current review flags
- Stripe linkage gaps
- paused students

Do not write yet. The first goal is visibility and trust.

### Phase 2: Persistent Issue Loop

Add stable issue state.

The page should answer:

1. Who is this?
2. What is wrong?
3. What is the safest next action?
4. What can I do now?
5. Where can I see more detail?

Keep issue cards calm. Show the operational summary by default and move debug/source details into a collapsed area.

### Phase 3: Bounded Actions

Add narrow actions that are safe, reversible, or easy to audit.

Good early actions:

- keep active
- ignore
- mark resolved
- update a local expectation field
- copy a message
- open the relevant record

Avoid early actions that mutate external provider state, such as pausing Stripe or sending WhatsApp messages.

### Phase 4: Context Layers

After loops are working, add small context helpers.

FirstChord examples:

- derived lifecycle status
- cached schedule context
- payment value context
- capacity context from MMS Free slots
- waiting-list instrument and sign-up context

The rule:

```text
Add context only when it reduces guessing or makes delegation safer.
```

Each context layer should be explainable:

- source
- confidence
- reasons
- warnings
- last refreshed time

### Phase 5: Workflow Hubs

Once there are multiple surfaces, stop adding every page to the top nav.

FirstChord uses:

```text
Overview | Issues | Workflows | Planning
```

With:

- `Overview` = today’s operating summary
- `Issues` = detected problems and issue actions
- `Workflows` = waiting list, onboarding, showcase, holidays, future tasks/messages
- `Planning` = capacity, schedule health, finance/capacity context

Student records are context, not a top-level operating mode. They are reached through search, issue links, and workflow links.

## UI Principles

### Make Cards Answer Operational Questions

Every card should quickly answer:

- who or what is this?
- why does it matter?
- what is the safest next step?
- what can I do now?
- where is the evidence?

### Hide Detail Without Hiding Risk

Show by default:

- severity
- status
- student/entity name
- plain-English issue summary
- key fact
- recommended action
- primary actions

Collapse:

- raw IDs
- source keys
- full source payload details
- debug text
- rarely used actions

Keep visible:

- urgent severity
- reappeared state
- resolved-but-still-detected state
- contradictions between systems

### Keep Navigation Action-Led

Do not use the top nav as a site map.

Use it for modes of work.

If a new page is just a tool inside an existing mode, put it inside that hub.

## Performance And Cost Rules

Small internal dashboards often fail because every page tries to be live.

Use these rules:

- Do not poll expensive vendors on every page load.
- Prefer cached snapshots and explicit refresh buttons.
- Use TTL caches for repeated read-only vendor calls.
- Store derived context when it is expensive to recompute.
- Keep live checks manual until the value is proven.
- Make cache freshness visible to users.

FirstChord examples:

- Stripe reviews are manual rather than automatic on every Railway load.
- MMS schedule context is cached in `Schedule_Context`.
- MMS Free calendar slots have a short server-side cache shared by Waiting and Capacity.

## Automation Guardrails

Add automation in this order:

1. summarize
2. classify
3. recommend
4. draft
5. require approval
6. act

Do not jump straight to sending messages, changing billing provider state, or resolving issues automatically.

For future AI/Brain assistance, structured context is more valuable than a clever prompt.

Good structured inputs:

- lifecycle status
- source-of-truth lane
- issue type
- current status
- recent actions
- contact role
- payment expectation
- schedule context
- known exceptions

## What Not To Build Too Early

Avoid early:

- generic workflow engines
- broad assignment systems
- complex permission models
- full CRM/contact databases
- WhatsApp auto-send
- Stripe mutation commands
- finance forecasting dashboards
- AI agents required for correctness

These can become useful later. They are risky foundations.

## Minimal Technical Architecture

You can build a useful operating dashboard with:

- one web app
- one operational data source
- one workflow-state table or sheet
- one append-only event log
- normalized helper functions
- conservative cached vendor reads

The important part is not the stack. The important part is the separation:

```text
External systems own external truth.
The dashboard owns workflow state and decision history.
Helpers normalize messy facts into explainable context.
UI turns those facts into bounded next actions.
```

## Example FirstChord Sequence

The actual FirstChord path looked roughly like this:

1. Read-only admin overview.
2. Persistent `/admin/flags` issue loop.
3. Calmer issue cards and system-cleared resolution.
4. Payment mode and payment expectation fields.
5. Manual Stripe checks and payment issue detection.
6. Pause expectation issues from `Pause History`.
7. Waiting-list state, notes, and welcome message copy.
8. Waiting-list closeout after onboarding.
9. Showcase and holiday recurring workflow state.
10. Derived lifecycle context.
11. MMS schedule context cache.
12. Payment value context.
13. Capacity context from MMS `Free` slots.
14. Waiting-list capacity hints.
15. Scalable navigation hubs.

That order matters. The system became more connected after it had reliable loops.

## Blog Or Case Study Outline

If turning this into a public article, a useful structure would be:

1. The problem: internal admin work lives between tools.
2. The mistake to avoid: building a giant CRM first.
3. The loop-closing model.
4. The first issue queue.
5. Why audit logs matter before automation.
6. Adding context layers once the loop is trusted.
7. Keeping automation approval-first.
8. Navigation as operating modes, not a sitemap.
9. What changed operationally.
10. Lessons for other service businesses.

Possible title:

```text
How We Built an Internal Operating Dashboard Without Building a CRM
```

## Reusable Checklist

Before building a new slice, ask:

- What recurring problem is this closing?
- What system detects or owns the source truth?
- What state does the dashboard need to remember?
- Does this need `Issue_Queue`, workflow state, or just read-only context?
- What action should be logged?
- What should clear or reappear?
- What should stay manual?
- What context would make this easier to delegate?
- What should not be built yet?

If the answers are clear, the slice is probably worth building.
