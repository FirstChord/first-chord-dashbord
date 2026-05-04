# School Policy

## Purpose

This document captures the current operating policy of the school in a form that:

- humans can follow consistently
- the admin dashboard can enforce gradually
- smaller/local agents can reason over safely

It is not a legal policy document.
It is an operational policy layer for the system.

---

## Core Principles

- One student normally maps to one tutor.
- If a student genuinely studies with two tutors, prefer two MMS student IDs rather than one shared multi-tutor record.
- The system should prefer warnings and visibility over silent assumptions.
- Parent messaging must not be sent automatically without human approval.
- Manual-payment exceptions remain exceptions until explicitly changed.

---

## Onboarding Policy

### A student is fully onboarded when all onboarding steps are complete

At minimum, this means:

- student exists in the `Students` sheet
- student exists in the registry
- student is active in MMS
- billing profile is ready in MMS
- first lesson has been created in MMS

This is the operational definition of onboarding completion.

### Stripe setup is not required for onboarding completion

Stripe customer/subscription linkage often happens after the first lesson.

So:

- onboarding can be complete even if Stripe IDs are still missing
- Stripe linkage should be tracked separately through payment issues

---

## Payment Policy

### Canonical payment fields

- `payment_mode`
  - `stripe`
  - `manual`
  - `unknown`

- `payment_expectation`
  - `setup_pending`
  - `stripe_active_expected`
  - `stripe_paused_expected`
  - `inactive_or_stopped`

### Manual payment exceptions

Manual exceptions remain valid until manually changed.

Current policy:

- do not raise Stripe failure issues for `payment_mode = manual`
- do not auto-convert manual exceptions back to Stripe

### Setup pending timing

`setup_pending` should remain visible until resolved.

It becomes operationally urgent:

- 7 days after the student’s first lesson

This means:

- before that threshold: warning/visible
- after that threshold: should be treated as overdue and reviewed promptly

### Payment failure policy

Stripe can retry failed payments.

So:

- payment failure should create a dashboard warning/action item
- the system should not assume the first failure is final
- payment failures should be reviewed by a human before any parent action is taken

---

## Pause Policy

### Pause intent

`Pause History` is the operational record of intentional pauses.

### Pause window behavior

The pause includes the weeks inside the pause window.

Operationally:

- paused behavior should remain in effect through the end of the recorded pause window
- normal behavior should resume on the day the lessons outside that pause window begin again

So the system should not treat a pause as ended too early.

### Stripe pause expectations

If a student is intentionally paused:

- `payment_expectation` should be `stripe_paused_expected`
- Stripe should not be actively billing during the pause

If Stripe is still actively billing during a valid pause:

- this should be flagged as a mismatch

---

## Messaging Policy

### Parent messaging

At the current stage:

- the system must not message parents automatically without approval

This applies especially to:

- payment failure messages
- onboarding follow-up
- pause/resume messages
- other sensitive operational communication

### Future WhatsApp integration

Messaging policy should be expanded once WhatsApp is connected.

For now:

- drafting is acceptable later
- autonomous sending is not

---

## Tutor Assignment Policy

### Default model

- one student
- one tutor

### Multi-tutor edge cases

If a student genuinely needs two separate tutor relationships:

- prefer two MMS IDs
- prefer two separate registry/dashboard identities

This keeps:

- lesson identity cleaner
- tutor ownership clearer
- billing/config logic simpler

The system should not treat multi-tutor records as the normal case.

---

## Issue Policy

### Current severity labels

- `Info`
- `Warning`
- `Needs action`

These are acceptable for now.

### Clearable issues

There should be a clear way to clear issues that are no longer relevant.

Policy direction:

- resolved issues should not linger indefinitely without a way to clear them
- queue hygiene matters

This supports future work on persistent issue state and resolution actions.

---

## Current Strategic Goals

### Short term

- strengthen the architecture
- prepare the system for WhatsApp connection

### Mid term

- automate or absorb a meaningful share of communication and admin work
- make the dashboard an organiser and planning partner for Finn and Tom

### Long term

- scale the operating system
- potentially productise it for other schools

---

## Automation Guardrails

The system should not automatically:

- message parents without approval

This is the current explicit hard guardrail.

More guardrails can be added later for:

- payment changes
- tutor changes
- registry deletion
- other high-risk admin actions

---

## Notes For Future Agents

- If business rules are ambiguous, prefer visibility and human review over auto-action.
- If a policy rule conflicts with raw vendor state, treat the mismatch as an issue rather than silently choosing a side.
- Prefer explicit fields and deterministic rules over assumptions based on notes or names.
