---
status: canonical
audience: [human, agent]
last_verified: 2026-07-20
---
# Tutor Absence And Pause Contract

## Purpose

Tutor absences retain exact per-date evidence underneath while presenting the
smallest safe human action above it. Cover, cancellation notice, payment work,
and final confirmation remain distinct decisions.

This guided notice flow applies to newly captured cards marked
`Tutor absence notice planning: v1`; older records are not silently backfilled.

## State Ownership

| Lane | Meaning |
| --- | --- |
| MMS calendar | Lessons and current tutor/date truth |
| `Planning_Items` tutor-absence cards | Human capture and dated work |
| `Tutor_Absence_State` | Per-tutor/per-date cover or cancellation decision |
| `Planning_Items` pause/notice cards | Grouped human-facing communication and payment work |
| `Planning_Progress_Log` | Append-only workflow history |
| `Event_Log` | Consequential payment-expectation audit |
| Finance pause forecast | Derived view of structured, non-parked pause cards |

## Normal Flow

```text
capture tutor-away period
  -> preview MMS and retain actual teaching dates
  -> one absence record per tutor/date
  -> around 14 days before: choose cover or cancel

cover
  -> confirm tutor, briefing, calendar and initial parent message
  -> no payment-pause card

cancel
  -> send early notice that says what will happen
  -> create/refresh structured student pause work
  -> group repeated weekly cancellations where safe
  -> nearer the lesson, complete payment action
  -> send final confirmation saying what happened
  -> close every linked dated absence only when its work is complete
```

The dashboard never sends the parent message or changes Stripe automatically.
Copy/send, payment execution, and final confirmation are explicit human actions.

## Timing

| Window | Expected work |
| --- | --- |
| 21+ days | quiet planning visibility |
| 16–14 days | cover/cancel decision and initial parent notice |
| 10 days or fewer | notice is overdue and shown as an exception |
| about 5 days before first missed lesson | payment and final-confirmation work |

One-off, repeated, and summer absences use the same rules.

## Grouping And Superseding

`Tutor_Absence_State` always stays per date. Consecutive weekly cancellations
for the same student may become one away-period pause card. Widely spaced or
fortnightly-looking dates must not be stretched into a broad period.

When a better active grouped card is created, smaller active cards are parked
and a progress-log explanation is appended. Completed, parked, or deliberately
deferred cards are never reopened or overwritten. History is not deleted.

Finance counts active and done structured pause cards because `done` means the
admin action occurred, not that the future pause ended. It ignores parked cards.
`Returning from date` means the first lesson/date back.

## Fail-Loud Exceptions

| Exception | Required behaviour |
| --- | --- |
| MMS cannot load | block capture/decision; never convert failure into “no lessons” |
| MMS changed after capture | block notice/payment/final confirmation until the real date is reviewed |
| multi-student MMS event | block automatic cover/cancel; verify every household and record manual completion |
| payment already paused or not needed | create a non-pause final-confirmation card with no finance effect |
| dates expand after notice | park the earlier open notice; label a replacement `Update:` if the old notice was completed |
| cover changes to cancellation | create normal notice/pause work and check whether a cover correction is owed |
| cancellation changes to cover | manually park/remove related pause work until a reconciliation tool exists |

No missing linked card is treated as completion. Cover never creates pause work.
Students already `stripe_paused_expected` or explicitly payment-not-needed are
excluded from new pause work.

## Reconciliation Boundary

Finance/reconciliation uses only dated cancellation/cover state, structured
pause cards, and the student's own pause coverage. Early notices, manual
group-event records, and no-payment final confirmations have `isPause: false`
and cannot alter payment expectation or finance maths.

If the student's own pause is recorded after a tutor cancellation, the earlier
tutor-absence pause card can become redundant. Reconciliation remains
order-independent and shows the student as covered. Use **Close redundant card**
on `/admin/finance/reconciliation`; it is offered only after date coverage is
established. Do not auto-retire it from incoming text or inferred overlap.

## UX And Safety Rules

1. One card asks for one thing: decide, tell early, complete payment, or confirm
   the final outcome.
2. Message-evidence cards cannot be completed by a generic status button.
3. Every block names the reason and one safe next action.
4. Early notice never claims payment happened; final copy appears only after the
   payment/no-payment outcome is known.
5. Later sync may create missing work or refresh an active generated card, but
   never reopens completed, parked, or deferred work.
6. Parent-facing grouping never replaces exact dated workflow truth.

## Code And Verification

- orchestration: `lib/admin/tutor-absence.js`
- rules/IDs/grouping: `lib/admin/tutor-absence-helpers.mjs`
- forecast parser: `lib/admin/pause-forecast.mjs`
- focused tests: `tests/admin/tutor-absence-helpers.test.mjs`,
  `tests/admin/pause-*.test.mjs`, and planning helper tests

Coverage must include two-week/overdue targeting, schedule mismatch,
multi-student blocks, single versus grouped dates, parked superseded cards,
no-payment cards outside finance semantics, expanded-date update notices, and
reverse-order overlap.

Do not change the exact structured pause labels without checking
`lib/admin/pause-forecast.mjs` and every parser consumer.
