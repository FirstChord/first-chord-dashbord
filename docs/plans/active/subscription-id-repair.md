---
status: active-plan
audience: [human, agent]
last_verified: 2026-08-17
---
# Subscription ID repair — audit and decision needed

**Status:** audit complete, no writes made. **Finn decided on 2026-08-17 not to
repair the cells** — the `Starts <date>` notes are doing a job and the recovered
IDs are not worth the risk of overwriting them. Kept because the audit is the
expensive part and the finding below will resurface.
**Date:** 2026-08-17

## Why this exists

The 2026-08-17 issue audit found 8 students whose `Pause History` could only be
matched by email-and-name, so they can never auto-resolve through the nightly
pause-expectation sync. The obvious fix was "repair their subscription IDs". The
audit below says the premise was half right and the fix is not what it looked
like.

## What is actually true

**`Pause History` is the healthy side.** All 797 rows carry a real
`sub_...` value. Payment Pause resolves a subscription by ID → customer → email
and writes whatever it actually paused, so that tab is trustworthy.

**The `Students` tab is where the gaps are.** Of 193 Stripe-managed students:

| Cell state | Count | Verdict |
|---|---:|---|
| Real `sub_...` | 167 | fine |
| Blank | 8 | **fine** — all `setup_pending`, no customer yet |
| Prose instead of an ID | 18 | the actual finding |

**The prose is a convention, not a typo.** Every one of the 18 reads like
`Starts august 12th`, `Starts 22nd of August`, `starts July 31st`. It is Finn
recording *when billing begins* for a student who is not yet on a live
subscription. Overwriting it with an ID would destroy that information, which is
why this is a decision and not a cleanup.

## The 18, in three classes

### A. Prose written over a subscription that already exists (11)

`Pause History` holds exactly one subscription ID under this student's exact
name, so the ID is recoverable and unambiguous.

| Student | MMS ID | Current cell | Recoverable ID |
|---|---|---|---|
| Mehul Kumar Singh | `sdt_rJmYJ6` | `starts July 18th` | `sub_1TuKjlKNcRnp5ci2hh5JkWVX` |
| Omar Mukhtar | `sdt_6RJkJp` | `Starts 24 August` | `sub_1SF0uyKNcRnp5ci2m8AFby8W` |
| Rohan Nazir | `sdt_D9rnJT` | `Starts august 12th` | `sub_1SF0uSKNcRnp5ci28DP4O1XF` |
| Max Toner | `sdt_v1lcJ0` | `Starts 13th august` | `sub_1SDCX9KNcRnp5ci2xV68aGlp` |
| Chiara Cavanna | `sdt_39hsJY` | `Starts august 20th` | `sub_1SK5a7KNcRnp5ci2DSmWYe3z` |
| Solomon Nazir | `sdt_LfgNJC` | `Starts August 13th` | `sub_1SPBBlKNcRnp5ci2O8VtgiK0` |
| Daniela Alvarez | `sdt_BDHTJN` | `Starts August 18th ` | `sub_1SDCXUKNcRnp5ci2gMO69Dla` |
| Roque Neto | `sdt_s2JpJx` | `starts August 12th` | `sub_1SDCWjKNcRnp5ci2AaT5BrSt` |
| Carol Turner (Bass) | `sdt_rzL8Jx` | `Starts 28th July ` | `sub_1TxxVBKNcRnp5ci2rwu6ZjZy` |
| Rowan Moore | `sdt_w6TBJ3` | `Starts 27th July` | `sub_1TLWz1KNcRnp5ci2Idvhozjg` |
| Theodore Henderson | `sdt_fl9nJD` | `starts June 16th` | `sub_1TijUbKNcRnp5ci27TwvHMdx` |

Note Rohan and Solomon Nazir share an email; the IDs above are separated by
exact student name and are different subscriptions. Carol Turner (Bass) is the
bass enrolment — her singing row (`sdt_BtxmJ4`) already holds the other, and
both subscriptions being active is correct, not double billing.

### B. Ambiguous — two candidate subscriptions on the exact name (2)

| Student | MMS ID | Candidates | Stripe says |
|---|---|---|---|
| Katerina Skouras | `sdt_vcJPJj` | `sub_1TSQ2S…`, `sub_1SEHxX…` | 4 subscriptions on the customer, **all canceled** |
| Emily Grifa | `sdt_f50CJ3` | `sub_1TQbeo…`, `sub_1TE8Mj…` | 2 subscriptions, **both canceled** |

Needs a human to say which enrolment is current, or whether either is.

### C. No `Pause History` at all, and Stripe shows only cancelled subs (5)

| Student | MMS ID | Current cell | Only Stripe subscription |
|---|---|---|---|
| Genie Hawley | `sdt_rGdJJH` | `Starts september 4th` | `sub_1U4225…` canceled |
| Lylah Donald | `sdt_rmm2JN` | `Starts 22nd of August` | `sub_1U0oO2…` canceled |
| Sinead Smollett | `sdt_m4rFJC` | `Starts August 25th` | `sub_1U4jZK…` canceled |
| Cameron Bryce | `sdt_rGXFJW` | `Starts 25th August` | `sub_1U4g3K…` canceled |
| Rhys Neil | `sdt_rYVwJN` | `starts July 31st` | `sub_1TygSW…`, `sub_1TsXql…` both canceled |

For these the prose may be the only fact there is. Writing a cancelled
subscription ID into the cell would be worse than leaving the note. **Do not
repair this class** without understanding why a just-created subscription is
already cancelled — four of the five were created in August 2026 and cancelled,
all carrying the `VAT UPDATE` price nickname, which suggests a billing migration
this audit did not investigate.

## Two cases that are not ID repairs at all

- **Yarah Love Sing** (`sdt_mG3LJ2`) already has a correct, distinct
  subscription. Her low-confidence match happens because there is no
  `Pause History` for the *singing* subscription, so the email-only matcher
  picks up her sister row Yarah Love's guitar pauses. Repairing an ID fixes
  nothing here.
- **Kristina and Lena Maclachlan** (`sdt_rJqnJf`, `sdt_rJq0Jm`) share one
  subscription `sub_1U1Dny…` between two students. The matcher has no concept of
  one subscription covering two people. They have no `Pause History` at all, so
  there is nothing to match.

## The blocker

`CLAUDE.md` → Forbidden Actions:

> Do not write to Stripe columns (`stripe_customer_id`, `stripe_subscription_id`)
> in the Students tab — Payment Pause owns those.

Class A is mechanical and low-risk, and repairing it would let those students
auto-resolve through the nightly sync instead of generating recurring issues.
It is still exactly the write that rule forbids. **No agent should make it
without Finn explicitly lifting the rule for this specific batch.**

Repairing would not break Payment Pause — it resolves by ID → customer → email,
so a correct ID moves it onto its fast path. The rule exists for ownership, not
because the value is unusable.

## Outcome

No cells were changed. The live consequence is simply that these students never
reach a high-confidence Pause History match, so they keep producing issues a
human has to read rather than resolving through the nightly sync. That is a
known, bounded cost.

The one thing still worth doing, whenever it next comes up: **the
`Starts <date>` convention needs its own column.** While it lives in
`stripe_subscription_id` it will keep breaking the matcher for every new
student, and the `VAT UPDATE` cancellations in Class C are an unrelated
question that probably belongs to Payment Pause.
