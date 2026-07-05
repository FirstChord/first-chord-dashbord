# Tutor-facing payroll — Phase 2 & 3 roadmap

Design home for the "tutors confirm what they're owed, then get paid" loop.
Phase 1 shipped 2026-07-02; **Phase 2 shipped 2026-07-05** (see below). **Phase 3
is the remaining unbuilt work.**

**Key correction (2026-07-05):** Phase 2 did **not** need the tutor-auth layer
after all — the signed statement link already proves identity ("this tutor, this
reviewed row"), so a Confirm button on the link works with no login (option 1
below). Only **Phase 3** genuinely needs a persistent tutor login.

Read first: the Phase 1 Learning Log entry (why + the frozen-statement design) and
the code — `lib/admin/tutor-statement-helpers.mjs`, `lib/admin/tutor-statement.js`,
`app/pay/statement/[token]/page.js`. This doc records *decisions and open
questions*, not code behaviour.

## Where Phase 1 left off (the foundation)

- A read-only pay statement exists per reviewed/paid tutor, with a **signed,
  no-login share link** `/pay/statement/<token>` (HMAC via `NEXTAUTH_SECRET`,
  30-day expiry, carries only the `payroll_id`; the view re-derives from the
  sheet). `/pay/*` is outside the auth middleware matcher.
- The statement's total is **frozen** from the reviewed `Payroll_Runs` row — the
  same source `selectPayableReviewedRuns` feeds into the Wise CSV.
- **No money moves and nothing auto-sends.** The admin pastes the link/text.

## The gating decision for BOTH phases: tutor auth

There is **no tutor auth today** — `isAdmin` (an allow-listed email) is the only
role (`lib/admin/auth.js`, `middleware.js`). Phase 2/3 can't land without one of:

1. **Magic-link identity via the statement token (recommended for Phase 2).**
   The signed `/pay/statement/<token>` link *already* proves "this tutor, this
   row". A Confirm button can POST that same token back — no accounts, no login
   UI, matches a ~15-person team. Bind confirmation to the token's `pid`/`t`.
   - Trade-off: it's a **bearer** link — whoever holds the URL can confirm. Fine
     for a low-stakes "yes this looks right" gesture (it does **not** move money;
     the admin still approves the batch). Tighten with shorter expiry + a
     one-time confirm (once confirmed, the token can't re-confirm/redispute
     without a fresh link).
2. **Google login + `isTutor` allow-list (needed for Phase 3 / a real portal).**
   Mirror the admin pattern: an allow-list of tutor emails, `session.user.isTutor`,
   a `/tutor/*` area outside the admin matcher. Heavier, but required once tutors
   self-serve cadence or see history across periods.

**Recommendation:** Phase 2 on the magic-link (option 1) to stay light; introduce
option 2 only when Phase 3 needs a persistent tutor portal.

---

## Phase 2 — tutor confirms (or disputes) their statement — ✅ SHIPPED 2026-07-05

*Built as described below, on the magic-link (no login). Confirm/"Something's off"
on `/pay/statement/<token>` → `recordTutorStatementResponse` writes
`tutor_response`/`tutor_responded_at`/`tutor_note`; the payroll board shows a
per-card banner + confirmations tally; disputed rows are held out of the Wise
batch until re-reviewed. Details in the 2026-07-05 Learning Log entry.*

Original design (kept for reference):


**Goal:** replace "chase the invoice" with the tutor actively agreeing the figure,
and surface disagreements *before* payment.

**Flow:** reviewed → statement link sent → tutor opens it → **Confirm** ("Yes,
this is right") or **Something's off** (free-text note) → admin sees the
confirmed/disputed state on the payroll card → admin still does the final batch
approve → Wise CSV. **Confirm ≠ auto-pay** (keep the approval-first guardrail).

**Surface:** add Confirm / dispute controls to `/pay/statement/[token]` (Phase 1
built it read-only for exactly this). POST to a new action/route that:
- re-verifies the token (`verifyStatementToken`) and loads the row by `pid`;
- writes the tutor response idempotently;
- is safe against double-submit and a stale/expired link.

**Data (new `Payroll_Runs` columns — update `STATE_TABS_SCHEMA.md` when built):**
- `tutor_response` ∈ `''` / `confirmed` / `disputed`
- `tutor_responded_at` (ISO)
- `tutor_note` (free text, dispute reason)

  Keep it on the existing row (not a new tab) — it's per-run state, alongside
  `reviewed_by`/`paid_by`. A dispute should **not** block the admin from paying
  (they may override), but should show loudly on the card and ideally hold the
  row out of the default Wise batch until acknowledged.

**Payroll page changes:** show `confirmed ✓ by tutor` / `disputed — see note` on
each card; optionally let the Wise batch prefer confirmed rows (a filter toggle,
not a hard gate).

**Open decisions:**
- Does a dispute *remove* the row from the Wise batch, or just flag it? (Lean:
  flag + keep out of the default batch, admin can force-include.)
- One-time confirm vs re-confirmable? (Lean: confirm is sticky; re-issue a link
  to change it.)
- What exactly is the tutor attesting — "I taught these" or "I agree the £"? Word
  the button/consent line carefully (it leans on MMS attendance being right,
  which also nudges tutors to keep the register accurate).

---

## Phase 3 — tutors self-select cadence + scheduled delivery

**Goal:** "ask tutors weekly or bi-weekly", then statements arrive automatically
each pay period.

**3a — cadence self-service.** Tutor sets weekly / biweekly / three-weekly →
writes `Tutor_Pay.invoice_cadence` (already the field that drives the pay
window). Needs tutor auth (option 2 above) and a small write path to `Tutor_Pay`
(operational config — treat writes carefully; it changes everyone's pay window
logic). Consider admin confirmation on a cadence change rather than silent.

**3b — scheduled statement delivery.** A cron per cadence generates + delivers
each tutor's statement on their pay day. Pattern already exists
(`app/api/cron/*`, e.g. `refresh-schedules`, `finance-snapshot`).
- **Prerequisite: a real tutor contact email.** `Tutor_Pay` has none;
  `Tutor_Wise.recipient_email` is the **banking payee** address, not a contact
  field. Add `contact_email` to `Tutor_Pay` before any dashboard send.
- **Email infra exists** — reuse the Gmail sender pattern
  (`lib/admin/practice-notes-email.js`). Transactional lesson-note email is
  already the one approved automated-email exception; a tutor pay statement is
  similar-risk and defensible, but **start behind an admin trigger** (a "send all
  statements for this run" button) before fully scheduling.
- Keep the signed-link body so scheduled emails still lead to the confirm surface.

**Open decisions:**
- Fully scheduled vs admin-triggered batch send? (Lean: admin-triggered first,
  schedule once trusted — matches the Practice Chat Level 2 caution.)
- Does a cadence change mid-period need a proration / window guard? (Reuse the
  existing since-last-paid window logic — it already catches up.)

---

## Cross-cutting guardrails (do not regress)

- **No auto-pay, ever.** Tutor confirm and scheduled statements never move money;
  the admin approves the Wise batch and uploads to Wise manually. No Wise API
  mutation.
- **Approval-first for outbound.** Automated email only extends the existing
  narrow exception; WhatsApp stays copy-paste; marketing/payment stay manual.
- **PII.** Statements contain student names + a tutor's pay. The bearer link and
  any stored/sent statement are personal data — fold into the same
  PII/retention note still owed for incoming messages (see `CURRENT_STATUS.md`
  → Next / Not now). Prefer short link expiry and no long-term statement storage.
- **Auth is the real cost.** Everything downstream (compute, freeze, statement,
  Wise CSV, audit stamps) already exists — budget Phase 2/3 mostly as the
  tutor-identity surface, not payroll logic.

## Definition of done (per phase)

- **Phase 2:** tutor can confirm/dispute from the link; state shows on the payroll
  card; disputes are visible and held out of the default batch; idempotent +
  token-verified; `STATE_TABS_SCHEMA.md` updated for the new columns; Learning
  Log entry.
- **Phase 3:** `Tutor_Pay.contact_email` added; cadence self-service writes safely;
  admin-triggered (then scheduled) statement send via Gmail; schema + Learning
  Log updated.
