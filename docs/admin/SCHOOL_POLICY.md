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

### First lesson payment policy

The introductory lesson is billed at the normal half-hour lesson rate:

- `£25`

This payment must be taken before the first lesson in order to secure the lesson time.

### Current lesson pricing

One-to-one lessons:

- `1 hour` — `£41.50`
- `45 mins` — `£33`
- `30 mins` — `£25`

Group lessons:

- `45 mins` — `£20 per person per week`
- `Adult Ukulele Group (1 hour 45 mins)` — `£42.50 per month`

### How payments are collected

Current default policy:

- First Chord uses Stripe for secure recurring payments
- a payment link is normally sent before the first lesson

This should remain the operational default unless a student is explicitly marked as a manual-payment exception.

### Missed lessons and cancellations

If a student cannot attend an in-person lesson, the standard fallback options are:

- a Zoom lesson in the usual slot
- a tutor practice video with notes for next lesson

Policy notes:

- no-shows or same-day cancellations are not eligible for a practice video
- if a family cancels with one week’s notice, the lesson should not be charged
- if a tutor cancels, payment should be paused for that lesson

### Ending lessons

If lessons are ending:

- ask for `2 lessons notice`

---

## Pause Policy

### Pause intent

`Pause History` is the operational record of intentional pauses.

### Pause window behavior

The pause includes the weeks inside the pause window.

Operationally:

- pause windows should be interpreted against the student's usual lesson schedule
- if the pause window covers one or more usual lesson dates, `payment_expectation` should align to `stripe_paused_expected`
- normal behavior should resume on the day the next usual lesson outside that pause window becomes billable again

So the system should not treat a pause as ended too early.

### Stripe pause expectations

If a student is intentionally paused:

- `payment_expectation` should be `stripe_paused_expected`
- Stripe should not be actively billing during the pause

If Stripe is still actively billing during a valid pause:

- this should be flagged as a mismatch

Exception:

- if the Stripe pause window has ended but the next usual billable lesson has not arrived yet, Stripe may already appear active without needing a mismatch flag
- this short bridge should be explained from Pause History and schedule context, not treated as a payment failure

### Extended lesson break policy

Outside the summer holiday period:

- lessons can be paused for a maximum of `3 weeks`
- on the `4th` and `5th` week, charges occur at the normal lesson rate
- if a break reaches `6 weeks or more`, the default assumption is that the student should step back for now so the slot can be offered elsewhere

Important exception:

- this extended-break charging policy does **not** apply over `July / August`

So summer-holiday handling needs operational tracking, but not the same pause-charge rule as the rest of the year.

### Holiday operations

The school normally operates:

- through bank holidays
- through the summer

The standard school-wide closure is:

- a `2 week` Christmas break

This means holiday workflows should distinguish between:

- true school closure at Christmas
- student/tutor-specific absences at Easter and summer

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

### Transactional lesson-note email exception

Practice Chat lesson-note delivery is the narrow permitted automated email category once the tutor has reviewed the note and clicked the final send/save button.

This is allowed because it is the digital equivalent of the tutor sending the practice note after a completed lesson. It should remain:

- tutor-approved before sending
- editable before sending
- logged with recipient, send status, and lesson context
- limited to lesson/practice notes only

This exception must not be treated as permission for automated payment, pause, onboarding, WhatsApp, or marketing messages. Those remain approval-first.

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
