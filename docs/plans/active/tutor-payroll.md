---
status: active-plan
audience: [human, agent]
last_verified: 2026-07-20
---
# Tutor Payroll: Remaining Phase 3

## Shipped Foundation

Payroll review produces a frozen tutor statement from `Payroll_Runs`. A signed,
30-day bearer link at `/pay/statement/<token>` lets the named tutor confirm or
raise a query without login. Responses are idempotently stored on the payroll
row; disputes stay out of the Wise batch. Confirmation never moves money and
paid runs lock further responses.

Do not rebuild the shipped Phase 1/2 flow. Current behaviour lives in
`lib/admin/tutor-statement*`, `app/pay/statement/[token]/`, payroll helpers, and
focused tests.

## Remaining Goal

Phase 3 would let tutors manage pay cadence and receive statement links with less
admin chasing. It is gated by authenticated tutor identity; a statement bearer
link proves access to one run, not persistent authority over `Tutor_Pay`.

### 3a: cadence self-service

- add tutor authentication and authorization for the tutor's own record
- expose weekly/biweekly/three-weekly `Tutor_Pay.invoice_cadence`
- preview the effective next pay window and require confirmation
- consider admin review for a mid-window change
- log actor, before/after value, and effective timing

### 3b: statement delivery

- add a real `Tutor_Pay.contact_email`; do not use
  `Tutor_Wise.recipient_email` as a contact address
- start with an admin-triggered batch preview/send using the existing Gmail
  pattern
- retain the signed statement link and tutor confirm/query surface
- schedule only after the manual batch path has representative evidence

## Decisions Still Needed

- whether cadence changes require admin approval or only tutor confirmation
- how a mid-period cadence change affects the next since-last-paid window
- what evidence is required before admin-triggered delivery becomes scheduled
- tutor statement/link retention and session duration

## Guardrails

- no auto-pay and no Wise API mutation
- tutor confirmation is a review signal, not payment approval
- all outbound batches are previewed before the first send
- statements contain student names and tutor pay; enforce tutor-scoped access,
  short-lived links, minimal logs, and the data-protection policy
- update `Tutor_Pay`/`Payroll_Runs` schema docs and recovery notes with any new
  field or write

## Done When

An authenticated tutor can safely propose/confirm their cadence; admins can
preview and send statement links to verified contact emails; failures are
visible and retry-safe; scheduling, if enabled later, preserves the same human
payment approval boundary.
