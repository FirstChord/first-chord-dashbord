# Tutor Absence To Pause Bridge

## Purpose

This document maps the workflow that turns cancelled tutor absences into structured pause planning.

It exists because this logic is valuable and easy to misunderstand: a tutor can be away for a period, the dashboard stores exact dated absence records, but Finn/Tom should see one clear payment-pause action per affected student where possible.

## Operating Principle

Keep precise operational records underneath, but collapse the visible action into the simplest safe shape.

```text
exact dated records underneath
  -> grouped human-facing action on top
  -> parked superseded cards, not deleted history
```

## Data Lanes

| Lane | Owner | What It Means Here |
| --- | --- | --- |
| MMS calendar | MMS truth | Which lessons exist on which tutor/date. |
| `Planning_Items` tutor absence cards | Dashboard workflow state | Human-captured "Tom is away on this date" work. |
| `Tutor_Absence_State` | Dashboard workflow state | Per tutor/date decision: cover or cancel, affected lessons, message state. |
| `Planning_Items` pause cards | Dashboard workflow state | Structured pause work for each affected student. |
| `Planning_Progress_Log` | Dashboard append-only log | Evidence that a card was created, parked, or completed. |
| `Event_Log` | Dashboard append-only log | Consequential payment expectation changes after human completion. |
| Finance pause forecast | Derived context | Reads structured pause cards; ignores parked cards. |

## End-To-End Flow

```text
Tutor away period
  -> Planning previews MMS date range
  -> keeps actual teaching dates only
  -> writes one tutor-absence Planning card per teaching date

Tutor-absence card
  -> choose cover or cancel directly in Planning

If cover
  -> no pause Planning card is created
  -> the dated absence stays in the short cover checklist for tutor/calendar/parent confirmation

If cancel
  -> writes/updates one Tutor_Absence_State row for that tutor/date
  -> bridge scans that tutor's cancelled rows
  -> creates structured pause Planning for affected students
  -> dated absence leaves the direct-attention list

One cancelled lesson for a student
  -> single-date pause card

Repeated weekly cancelled lessons for same student
  -> grouped away-period pause card
  -> older single-date/shorter-period cards parked

Grouped pause card completed
  -> human confirms pause tool was run
  -> human confirms parent message was sent/copied
  -> dashboard aligns payment_expectation if needed
  -> Event_Log + Planning_Progress_Log record the completion
  -> every linked dated tutor absence is marked resolved automatically
  -> its original tutor-absence Planning capture card is marked done automatically
```

## Superseding Rule

The dashboard does not mutate old cards in place.

When a better grouped card exists, it:

1. creates or updates the grouped away-period pause card
2. parks the smaller card(s)
3. writes progress log notes explaining the parking
4. leaves all rows visible in history

Example:

```text
Pause Rosie Ward lesson on Mon, 6 Jul 2026
  -> parked

Pause Rosie Ward from Mon, 6 Jul 2026; returning Mon, 20 Jul 2026
  -> parked

Pause Rosie Ward from Mon, 6 Jul 2026; returning Mon, 27 Jul 2026
  -> active
```

This is expected. The active card is the one Finn/Tom should complete.

## Finance Rule

Finance reads structured pause windows from `Planning_Items`.

- active pause cards count
- done pause cards still count, because done means the admin action was completed, not that the future pause is over
- parked pause cards do not count

This prevents old single cards and old shorter-period cards from double-counting the same absence.

## Important Invariants

- `Tutor_Absence_State` stays per dated tutor absence.
- Parent messages can group by period, but the stored workflow state remains per date.
- Cover decisions must not create pause cards.
- Cancellation decisions can create pause cards.
- Cancelled dates are a hand-off to grouped pause cards, not a second payment/message checklist in the Tutor Absence workflow.
- A cancelled date resolves only when every current linked pause card is done; a missing card is never treated as completion.
- A student already marked `stripe_paused_expected` or explicitly marked payment-not-needed is skipped.
- Parked cards are retained for audit; they are not active work and should not drive finance.
- `Returning from date` means the first lesson/date back, not the last date to pause.

## Code Map

| Concern | File/function |
| --- | --- |
| Save tutor absence decision | `saveTutorAbsenceWorkflow()` in `lib/admin/tutor-absence.js` |
| Bridge cancellation to pause cards | `createStructuredPausePlanningFromCancellation()` in `lib/admin/tutor-absence.js` |
| Build single/grouped pause plans | `buildTutorAbsencePausePlanningBundle()` in `lib/admin/tutor-absence-helpers.mjs` |
| Split repeated lessons into blocks | `splitCandidatesIntoBlocks()` in `lib/admin/tutor-absence-helpers.mjs` |
| Single pause ID | `buildTutorAbsencePausePlanningId()` in `lib/admin/tutor-absence-helpers.mjs` |
| Period pause ID | `buildTutorAbsencePausePeriodPlanningId()` in `lib/admin/tutor-absence-helpers.mjs` |
| Parent message grouping | `buildTutorAbsenceCancellationMessageGroups()` in `lib/admin/tutor-absence-helpers.mjs` |
| Finance forecast parser | `parsePauseWindowsFromPlanning()` in `lib/admin/pause-forecast.mjs` |
| Planning card remove/park | `handleArchiveItem()` in `components/admin/AdminPlanningPageClient.js` |

## Tests

Relevant focused tests live in:

- `tests/admin/tutor-absence-helpers.test.mjs`
- `tests/admin/pause-forecast.test.mjs`

The important behaviours to keep covered:

- single cancelled lesson creates a single-date pause card
- repeated weekly cancelled lessons create one away-period card
- superseded single/shorter period cards are parked
- fortnightly-looking or widely spaced gaps do not become one broad period accidentally
- finance ignores parked pause cards

## Live Verification

Verified on 2026-06-25 with Tom's July 2026 cancellations.

Rosie Ward had:

- `Tutor_Absence_State` rows for 2026-07-06, 2026-07-13, and 2026-07-20
- an original single pause card for 2026-07-06, now parked
- an interim 2026-07-06 to 2026-07-20 card, now parked
- an active grouped card: `Pause Rosie Ward from Mon, 6 Jul 2026; returning Mon, 27 Jul 2026`

That is the intended behaviour.

## Manual Operating Guidance

For a multi-week tutor absence:

1. Capture the tutor absence period from Planning.
2. On each actual teaching-date card, choose **Cover lessons** or **Cancel lessons → pause cards**.
3. For cover, finish the short cover checklist in Tutor Absence.
4. For cancellation, let the dashboard build/park pause cards automatically.
5. Complete the final grouped pause card for each affected student, not the early single-date card. The dated absence cards then close themselves.

If a cancellation later changes to cover, manually park/remove the related pause card until a reconciliation tool exists.

### Reverse-order overlap (student's own pause arrives after the absence)

If a tutor absence is recorded first and the student *then* says they're away for that period (and maybe longer), the bridge already created a "pause them for the absence dates" card for that student (the at-entry `payment_expectation` snapshot said active). The bridge does **not** auto-retire that card when the student later pauses on their own — it only fires on the tutor-absence save, and only drops/aligns students already paused *at entry time*.

The reconciliation maths is unaffected (it recomputes from live state, order-independent — the student shows as "covered", net-new £0). To tidy the now-redundant card: open `/admin/finance/reconciliation`, filter to the tutor, and use **Close redundant card** on the covered student (`selectRedundantTutorAbsencePauseCards` + the page's guarded server action). It only appears for covered students, so the date-coverage is already guaranteed. Fully-automatic retirement (a sweep wired into the pause auto-sync) was considered and deferred — this one-click on the verification surface was preferred.

## What Not To Change Casually

- Do not replace per-date `Tutor_Absence_State` with one broad range row.
- Do not make finance read `Tutor_Absence_State` directly unless you redesign payment-handling assumptions.
- Do not hard-delete superseded planning cards.
- Do not make grouped parent messages the only source of truth.
- Do not auto-run Stripe from this bridge.
