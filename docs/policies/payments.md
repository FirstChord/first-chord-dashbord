---
status: canonical
audience: [human, agent]
last_verified: 2026-07-20
---
# Payments Rules

## Purpose

This is the policy boundary between dashboard-owned payment intent and Stripe
provider facts. It governs issue detection and reconciliation; it does not
authorise Stripe mutation.

## Ownership

- `Students.payment_mode` and `Students.payment_expectation` express First
  Chord's operational intent.
- Stripe owns customers, subscriptions, invoices, payment intents, and whether
  provider-side money movement occurred.
- Stripe snapshot tabs are timestamped caches, not provider truth.
- Pause History is evidence used only by the explicit reconciliation workflow.

Allowed payment modes are `stripe`, `manual`, and `unknown`. Approved manual
payment students are not evaluated as broken Stripe students.

Allowed expectations are:

- `setup_pending`: Stripe setup is not yet expected to be complete
- `stripe_active_expected`: normal active billing is expected
- `stripe_paused_expected`: an intentional payment pause is expected
- `inactive_or_stopped`: billing should no longer be active

For a Stripe-managed student with a blank expectation, no Stripe IDs means
setup-pending. Existing linkage means active-expected unless explicit evidence
says otherwise; stale or incomplete linkage must remain visible.

## Deterministic Issue Rules

Issue type names are API/storage contracts. Search every consumer and update
tests before changing one.

| Intent/evidence | Current issue |
| --- | --- |
| local links: neither Stripe customer nor subscription ID recorded | `STRIPE SETUP INCOMPLETE` |
| local links: customer ID absent but subscription ID recorded | `STRIPE CUSTOMER MISSING` |
| local links: customer ID recorded but subscription ID absent | `STRIPE SUBSCRIPTION MISSING` |
| live check: active-expected but no subscription found | `ACTIVE_WITHOUT_SUBSCRIPTION` |
| active-expected, subscription cancelled | `SUBSCRIPTION_CANCELLED_UNEXPECTEDLY` |
| expected state disagrees with provider pause/activity state | `SUBSCRIPTION_STATE_MISMATCH` |
| inactive/stopped but subscription remains active | `INACTIVE_STILL_BILLING` |
| latest payment evidence has failed and no retry is scheduled | `PAYMENT_FAILED` |
| failed payment has a Stripe retry scheduled | `PAYMENT_RETRYING` |
| setup-pending but both Stripe links exist | `SETUP PENDING STRIPE LINKED` |

Manual-payment cases suppress Stripe mismatch alarms. Setup-pending is normally
workflow work, not a payment failure. A paused subscription's normal void invoice
must not be misclassified as failure; a remaining balance combined with
`past_due`/`unpaid` evidence may still be a failure.

Unknown, stale, missing, or conflicting evidence must produce a reviewable
unknown/warning state—not a guessed provider fact or a consequential action.

The implementation authority is `lib/admin/stripe-snapshot-helpers.mjs`,
`lib/admin/issue-detectors.mjs`, and their focused tests. This table describes
intent; code and tests win if a new condition has been deliberately introduced.

## Read And Refresh Rules

Ordinary page reads use cheap local state and cached normalized snapshots. Live
Stripe checks are explicit or scheduled; list rendering must not query Stripe
once per student.

Every Stripe-derived display must retain `checked_at` and clearly distinguish
cached from live evidence. Agents and UI helpers consume normalized projections,
not arbitrary raw Stripe responses.

`STRIPE_API_KEY` is a restricted read key. Customers, Subscriptions, Invoices,
Prices, and Payment Intents require Read; write permissions stay disabled.
Missing Payment Intents Read must fail the refresh visibly rather than silently
classifying partial invoice evidence.

## Pause-Expectation Reconciliation

Overview, Issue Queue, and Stripe reads never update
`Students.payment_expectation`.

`/admin/flags` provides the only high-confidence Pause History reconciliation:

1. authenticated GET builds an exact preview
2. the admin reviews affected students and transitions
3. authenticated POST requires `confirm: true` and reloads current evidence
4. only eligible changes write `Students.payment_expectation`
5. each attempt and applied change appends an `Event_Log` record

Eligibility is deliberately narrow: Stripe-managed student, subscription-ID
Pause History match, high confidence, and coverage of a usual lesson.
Setup-pending, inactive/stopped, low-confidence, missing-schedule, invalid-window,
and no-usual-lesson cases are excluded. This action never changes Stripe.

## Action Boundary

- Issue Queue state is not payment truth.
- Marking an issue handled does not prove provider repair.
- Drafts, summaries, or AI output never authorise payment action.
- No dashboard workflow auto-pays, auto-pauses, resumes, or cancels Stripe.
- Provider changes require their established human preview/confirmation path and
  audit evidence.

Relevant tests include `payments-helpers`, `payment-*`, `stripe-*`,
`issue-detectors`, and `issue-queue*` under `tests/admin/`.
