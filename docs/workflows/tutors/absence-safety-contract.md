---
status: canonical
audience: [human, agent]
last_verified: null
---
# Tutor Absence Safety and UX Contract

## Purpose

This is the operating contract for tutor absences. The goal is deliberately boring safety: normal work is guided; unusual work stops with one named reason and one safe next action.

It applies to **newly captured** tutor absences carrying `Tutor absence notice planning: v1`. Existing absence and summer-pause records remain on their existing workflow and are not backfilled.

## Normal Path

```text
Capture future absence
  -> Planning card becomes due around 14 days before each real teaching date
  -> choose cover or cancel

Cover
  -> confirm cover tutor, briefing, calendar and parent message

Cancel
  -> send initial parent notice (what will happen)
  -> closer to the lesson, complete the existing payment pause card
  -> send final confirmation (what payment action happened)
  -> linked dated absence closes automatically
```

The dashboard never sends a parent message or runs a payment action itself. Copy/send and final confirmation remain explicit human actions.

## Time Windows

| Window | What the system asks for | Why |
| --- | --- | --- |
| 21+ days | Quiet planning visibility only | Capture early without creating an urgent queue. |
| 16–14 days | Cover/cancel decision and initial parent notice | Gives a normal two-week communication window. |
| 10 days or fewer | Notice card is overdue and therefore an exception | Makes late notice visible rather than silently normal. |
| About 5 days before first missed lesson | Existing payment/final-confirmation work | Keeps finance action close to the affected lesson. |

Long periods and one-off absences use the same rule. A repeated weekly cancellation groups by student; no summer-only mode exists.

## Fail-Loud Exceptions

| Exception | System behaviour | Human next action |
| --- | --- | --- |
| MMS calendar fails to load | Capture/decision is blocked; it cannot become a false “no lessons” result. | Retry/check MMS, then capture or decide. |
| MMS schedule changed after capture | Sending the early notice, completing payment, or sending a no-payment final confirmation is blocked. | Review the real date in MMS and update the absence plan before continuing. |
| Multi-student MMS event | Automatic cover/cancel is blocked. | Verify every household, calendar arrangement and communication manually; then record the manual completion. |
| Payment already paused / payment action not needed | A separate final-confirmation card is created. It is not a pause card and has no finance effect. | Check the recorded outcome, send the truthful final message, and mark it sent. |
| Dates expand after a prior notice | The earlier open notice is parked; if a prior notice was completed, the new card is labelled `Update:`. | Send the revised notice before relying on the final pause card. |
| Cover changes to cancellation | The new cancellation creates the normal early-notice and pause work. | Check whether a parent was already told about cover; send a correction if necessary. |

## Reconciliation Boundary

The finance/reconciliation path continues to use only the established sources:

- `Tutor_Absence_State` cancellation/cover decisions
- structured pause Planning cards
- the student’s own pause coverage

Early-notice cards, manual group-event records, and final no-payment confirmation cards all have `isPause: false`. They cannot change payment expectation, finance forecasts, or reconciliation maths.

## UX Rules

1. One card says one thing: **decide**, **tell early**, **complete payment**, or **confirm final outcome**.
2. A card cannot be marked done by a generic status button when it needs message evidence.
3. Every blocked action explains why in plain English; it does not guess or silently continue.
4. The early notice never claims payment has happened. The final message is available only in the payment/final-confirmation step.
5. Manual exceptions remain visible until a human explicitly records completion.
6. Historical absence work is preserved and never changed merely because this safer version exists.
7. A later absence sync may create missing cards or refresh a still-active generated card, but it never reopens a card a human has completed, parked, or deferred.

## Verification Expectations

Before deployment, retain regression coverage for:

- legacy pause/reconciliation fixtures remaining unchanged
- two-week notice targeting and overdue handling
- schedule mismatch and group-event blocks
- no-payment final confirmation staying outside pause/reconciliation semantics
- date expansion creating a clear notice update

Run `npm run test:admin` and `npm run build` before release.
