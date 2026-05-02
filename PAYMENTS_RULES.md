# Payments Rules

## Purpose

This document defines the payment-state model for the First Chord admin dashboard.

It exists to keep Stripe-related issue detection:

- cheap to evaluate
- explicit enough for smaller/local agents
- safe around pauses, manual-payment exceptions, and setup edge cases

This is the policy layer that should sit between:

- canonical admin data in the `Students` sheet
- live or cached Stripe state
- issues shown in `/admin/flags`

---

## Core Principle

Do not flag raw Stripe facts by themselves.

Only flag a Stripe issue when:

1. the student is expected to be Stripe-managed, and
2. the live or cached Stripe state disagrees with that expectation

This prevents false alarms for:

- approved manual-payment exceptions
- intentionally paused subscriptions
- inactive/stopped students
- onboarding/setup periods

---

## Canonical Admin Fields

### `payment_mode`

Canonical payment-intent field stored in the `Students` sheet.

Allowed values:

- `stripe`
- `manual`
- `unknown`

Current meaning:

- `stripe`
  - normal student who should be evaluated against Stripe rules
- `manual`
  - approved cash or bank-transfer exception
  - suppress Stripe alarms
- `unknown`
  - incomplete or transitional case
  - should only raise low-confidence review issues

### `payment_expectation`

Planned next canonical field for expected Stripe/payment behavior.

Recommended values:

- `setup_pending`
- `stripe_active_expected`
- `stripe_paused_expected`
- `inactive_or_stopped`

This should be used alongside `payment_mode`, not instead of it.

---

## Expected Payment States

| Expected state | When to use it | Stripe should look like | Flag? | Notes |
|---|---|---|---|---|
| `manual_payment` | Cash or bank transfer exceptions | Ignore Stripe state | No | Katrina Caldwell, Kenny, Hayleigh, Hudson, Angie Godard |
| `setup_pending` | New student not fully set up yet | Customer/subscription may be missing | Usually no | Info-only at most |
| `stripe_active_expected` | Normal active paying student | Active subscription, not intentionally paused | Yes if broken | Main default state |
| `stripe_paused_expected` | Payment intentionally paused | Subscription paused or equivalent expected state | Yes only if mismatch | Should suppress failure alarms |
| `inactive_or_stopped` | Left, stopped, or no longer operational | Stripe may be canceled or absent | Usually no | Only flag if obviously contradictory |

---

## Stripe Snapshot Model

Do not query Stripe on every admin page view for every student.

Instead, aim for a normalized Stripe snapshot per Stripe-managed student.

Recommended snapshot fields:

| Snapshot field | Meaning | Source |
|---|---|---|
| `customer_found` | Stripe customer exists | Stripe API |
| `subscription_found` | Subscription exists | Stripe API |
| `subscription_status` | Active/canceled/etc | Stripe API |
| `pause_state` | Paused or not | Stripe API and/or Payment Pause state |
| `last_invoice_status` | Paid/failed/open/etc | Stripe API |
| `last_checked_at` | When snapshot was refreshed | Internal cached state |

---

## Stripe Issue Rules

| Expected state | Stripe condition | Issue | Severity |
|---|---|---|---|
| `manual_payment` | Any | None | — |
| `setup_pending` | Missing customer/subscription | None or info-only | Info |
| `stripe_active_expected` | No customer and no subscription | `STRIPE_SETUP_INCOMPLETE` | Warning |
| `stripe_active_expected` | Customer missing | `STRIPE_CUSTOMER_MISSING` | Warning |
| `stripe_active_expected` | Subscription missing | `STRIPE_SUBSCRIPTION_MISSING` | Warning |
| `stripe_active_expected` | Subscription canceled | `SUBSCRIPTION_CANCELLED_UNEXPECTEDLY` | Needs action |
| `stripe_active_expected` | Recent payment failed | `PAYMENT_FAILED` | Needs action |
| `stripe_active_expected` | Subscription paused | `SUBSCRIPTION_STATE_MISMATCH` | Warning |
| `stripe_paused_expected` | Subscription paused correctly | None | — |
| `stripe_paused_expected` | Subscription active instead of paused | `SUBSCRIPTION_STATE_MISMATCH` | Warning |
| `stripe_paused_expected` | Payment failed while paused | Usually none | — |
| `inactive_or_stopped` | Missing/canceled subscription | None | — |
| `inactive_or_stopped` | Active subscription still billing | `ACTIVE_WITH_SUBSCRIPTION` | Warning |

---

## Cheap vs Expensive Checks

Keep the expensive checks out of normal admin rendering.

| Check | Cost | When |
|---|---|---|
| `payment_mode` missing/invalid | Cheap | Every admin read |
| Missing Stripe IDs | Cheap | Every admin read |
| Active/manual/pending classification | Cheap | Every admin read |
| Live subscription status | Expensive | Scheduled sync or manual refresh |
| Live invoice failure state | Expensive | Webhook or scheduled sync |
| Pause-state verification | Medium | Prefer cached Payment Pause state |

---

## Cost Strategy

Avoid:

- querying Stripe for every student on every page load
- putting Stripe API calls in list views by default
- letting agents reason directly from raw Stripe responses

Prefer:

- cheap local checks from Sheets/admin state on every read
- scheduled or webhook-based Stripe snapshot refresh
- issue rules running against normalized state

---

## Agent-Safe Rule Shape

Smaller/local agents should only need to:

1. read `payment_mode`
2. read `payment_expectation`
3. read cached Stripe snapshot
4. apply deterministic issue rules
5. emit issue / no issue

Agents should not need to:

- reason from raw Stripe API payloads
- infer intent from scattered exception logic
- guess whether a pause is intentional

---

## Relationship to Payment Pause PWA

The Payment Pause PWA is the natural future source of pause intent.

Short-term:

- use current admin payment intent and Stripe setup fields
- avoid flagging manual-payment exceptions

Medium-term:

- treat pause state from Payment Pause as authoritative intent for `stripe_paused_expected`

Long-term:

- the admin dashboard should consume normalized pause/payment state, not re-implement pause logic independently

---

## Recommended Next Implementation Order

1. Add `payment_expectation`
2. Keep `payment_mode` as canonical payment intent
3. Add a cached Stripe snapshot layer
4. Add live Stripe failure/cancellation rules using this document
5. Later integrate Payment Pause state as authoritative pause intent
