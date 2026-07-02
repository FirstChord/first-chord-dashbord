# Admin Current Status

Last updated: 2026-06-30

Tracked current-status entrypoint for agents working from the `music-school-dashboard` repo.

> **This file is a SNAPSHOT, not a changelog.** It holds what's true *now*, what's next, and the durable rules. **History lives elsewhere: `git log` (what changed, in order — commit messages are detailed) and the Obsidian `06 Learning Log` (why).** Keep **Recently shipped** to the last session or two and prune the oldest when you add. Don't restate code behaviour here — the code is the truth; record only decisions, contracts, and direction. The workspace `../CURRENT_HANDOVER.md` holds only machine/in-flight context, not a duplicate of this.

## Active Direction

V3 established the dashboard's loop-closing pattern:

1. detect or surface a recurring admin problem
2. show enough context to make the right decision
3. provide a bounded action path
4. store the outcome
5. log consequential actions

V4 adds lightweight context layers on top of those loops — making each student, issue, payment, and workflow easier to understand and delegate without a large state machine or new database. Guiding principle: **reduce admin cognitive load** — turn recurring memory-heavy admin into clear context, safe next actions, and logged outcomes.

The admin overview is a strict meeting-start surface, not a complete status board: cards earn their place by showing what needs doing today, what needs attention soon, or where to spend leadership energy. The active surface is the private admin dashboard under `/admin`.

## Recently shipped

*Last working arc only — older work is in `git log --oneline` + the Learning Log.*

- **Tutor pay statement — Phase 1 (2026-07-02):** read-only per-tutor statement (line items + frozen total from the reviewed `Payroll_Runs` row) at `/admin/finance/payroll/statement?pid=…`, reached from each reviewed/paid tutor card. **Copy text** + **Copy share link**; the link is a signed, no-login public URL (`/pay/statement/<token>`, HMAC via `NEXTAUTH_SECRET`, 30-day expiry) the admin pastes to the tutor. Nothing auto-sends; no money moves. First step of the tutor-facing payroll loop (Phase 2 = tutor confirm on that same link; Phase 3 = tutor self-select cadence + scheduled delivery — **both need real tutor auth, which doesn't exist yet**). Why: [[Learning Log 2026-07-02 tutor statement]].
- **Payroll fixes (2026-07-02):** (1) **Wise CSV now pays from saved reviewed `Payroll_Runs` rows** (`selectPayableReviewedRuns`), not a re-resolved preview — a tutor reviewed under a manually-adjusted window (e.g. David Husz) was silently dropped because the window-derived `payroll_id` no longer matched; this also fixes the "CSV won't update after reviewing more". Duplicate reviewed rows per tutor collapse to one payment (all ids cleared on batch-paid; amount disagreement surfaces a warning). (2) **60s attendance cache** so window adjusts don't re-hit MMS (the slow/fast variance). (3) **Submit feedback** on Mark reviewed / Mark paid (spinner → "… ✓"). Why: [[Learning Log 2026-07-02]].
- **Incoming inbox — loop close + audit + group map (2026-07-01→02):** (1) `Convert to plan + draft reply` creates an idempotent linked `Planning_Items` action, stamps `created_planning_id`, returns a per-category WhatsApp reply (copy-paste only; tone "Hi/Hello/Hey", never "Heya"). (2) Every review action stamps `reviewed_by`/`reviewed_at`. (3) WhatsApp group map: bulk sync (bridge pre-filter → batched writes), roster-based bucketing (matched→review, unmatched→hidden), **weekly auto re-sync** (launchd `SIGUSR1`), and **sibling groups** (`additional_mms_ids` + "+ Student" button; matching disambiguates by named student, flags ambiguous for review). Doc: `docs/admin/WHATSAPP_INCOMING_BRIDGE.md`.
- **Monolith split — planning + Sheets complete (2026-06-30):** `AdminPlanningPageClient.js` 3,732 → 1,167 lines (thin orchestrator), and `lib/admin/sheets.js` 2,466 → 8 lines (barrel re-export). Sheets domain code now lives under `lib/admin/sheets/` with the shared cache/client/header logic in `core.mjs`; all existing call sites still import `@/lib/admin/sheets`. Behaviour unchanged. Map: `docs/admin/MONOLITH_SPLIT_MAP.md`; why: [[Monolith Split — Why and How]].
- Finance layer, payroll V1+Wise pay-out, temporal reconciliation L1, roster movement → `git log` + Learning Log.

## Standing context & policy

Durable rules (don't grow per session). The state-tab map is `docs/admin/STATE_TABS_SCHEMA.md` — treat it as canonical before adding any Sheets tab.

- **V4 context is read-only:** `deriveStudentLifecycleStatus()`, `Schedule_Context` (cached MMS calendar, refreshed per-student / bulk / cron — not per page load), and payment value context are baseline operational context only — they don't change issue generation, onboarding, Stripe, or stored state.
- **Shared MMS slots = group lessons** when multiple students share teacher + next-lesson start + duration; price as group, not 1:1.
- **Capacity:** `/admin/capacity` reads MMS `Free` calendar slots (don't duplicate into a Sheets tab); `/admin/capacity` + `/admin/waiting` share a short-lived `Free`-slot cache; capacity page also shows schedule-cache health. `/admin/waiting` shows possible slots only where the tutor teaches the parsed instrument — hints only, no auto-assign/onboard.
- **Navigation is action-led:** Overview = today's operating summary; Issues = detected problems + loop actions; Workflows = waiting/onboarding/showcase/holidays/comms; Planning = capacity, schedule health, seasonal + finance/capacity layers. Student records are reached via search/links, not a top-nav mode.
- **Overview placement:** top cards = work to do today / needs attention / deliberate school-improvement prompts; background health belongs lower down unless something's wrong; prefer human labels over big counts; don't add a panel just because data exists. (`docs/admin/COPY_AND_TONE.md` records the language layer.)
- **Planning state is dashboard-owned work state** (`Planning_Items` + append-only `Planning_Progress_Log`), not external truth. Linked student IDs point at `Students` rows. The Friday school-forward + Monday scheduling prompts are seeded planning items, not a workflow engine. Learning/strategic notes are planning items, not finance forecasts.
- **Pause guardrail:** pause reminders link to a student before billing actions; generic `Done` never changes payment state — **`Mark pause completed`** is the guarded action that logs confirmation, sets `stripe_paused_expected` via the student PATCH route, appends `Event_Log`, and closes the task. The dashboard generates the parent message but does **not** send WhatsApp. Parked pause cards are ignored by the finance forecast.
- **Parent understanding** (`Parent_Understanding_State`) is a manual, approval-first campaign workflow — not a CRM or message automation. Contact-detail fixes are flag/note only; don't edit MMS from it yet.
- **Practice Chat** note ownership bridges admin↔learning via `Practice_Notes_Log`. Level 2 (Gmail-delivered parent notes) is a **controlled pilot** limited to Finn/Tom/Fennella (+ test student), idempotent via `delivery_key = student + MMS attendance + note hash`; transactional lesson-note email is the one automated-email exception — payment/pause/onboarding/WhatsApp/marketing stay approval-first. Before widening, update `docs/admin/PRACTICE_CHAT_DELIVERY_AUDIT.md` (caller identity, authorisation, config-driven rollout, duplicate-send concurrency are the blockers).
- **Finance lanes** (see [[Financial Layer]]): `Expenses` = recurring overhead; `Expense_Log` = actual spend to reconcile at month-end (replaces the old `General` buffer); `Finance_Snapshot` = dated estimates, not accounting; `Payroll_Runs` = payroll review/paid ledger; `Tutor_Pay`/`Tutor_Wise` = pay config + Wise recipients (salaries/banking never in git).

Before deploying, verify with:

```bash
npm run hygiene:check
npm run test:admin
npm run build
```

`hygiene:check` is deliberately non-blocking. It scans changed files and project size signals, then prints prompts for judgement: large files, meaningful code without docs, Sheets/state-layer touches without `STATE_TABS_SCHEMA.md`, and admin workflow/route changes without a current-status note.

## Next / Not now

Open candidates (the Obsidian `08 Operations/Active Roadmap` is the fuller list):

- Pause-loop maturity — make pause issue cards clearer about whether a mismatch is from `Pause History`, sheet expectation, or live Stripe (Stripe mutation stays out of scope).
- Contact-role model before any message automation.
- Communication draft→approve layer before any WhatsApp Cloud API (no auto-send).
- **Incoming/WhatsApp groups — deferred (from the 2026-07 build):** (a) **PII/retention + lawful-basis note** for stored parent/child message content — not yet written; (b) **capture a student's WhatsApp group at onboarding** rather than relying only on the weekly re-sync; (c) **sibling groups are add-only in the UI** — removing a mis-added student means editing `WhatsApp_Group_Map.additional_mms_ids` directly (add a remove affordance if it bites); (d) **"open the group from a planning card" — explored and shelved:** desktop invite-link (browser interstitial + "Open WhatsApp?" handoff) is clunkier than just searching the predictable group name, so we surface nothing; a phone-only invite-link button is possible later at a one-time ~189 **admin-gated** `groupInviteCode` fetch (codes are revocable) — only worth it if the phone flow specifically annoys; (e) the **last-active/inactivity filter is inert** (Baileys history doesn't deliver `conversationTimestamp` in the sync window; `skippedInactive` stays 0) — roster bucketing covers old-student removal, so the timestamp path is prunable dead-ish code.
- Practice Chat Level 2 delivery audit (read-only first) before widening beyond Finn/Tom/Fennella.
- Future capacity overlay (tentative/hire availability) — only after the MMS `Free` view proves useful; keep separate from real calendar data.
- **Monoliths to split:** planning client and `sheets.js` are done (see Recently shipped). Remaining candidates are feature/section-component peels where helpers already exist: `AdminIssuesPageClient.js`, `AdminStudentDetailClient.js`, `AdminParentUnderstandingPageClient.js`. See `docs/admin/MONOLITH_SPLIT_MAP.md` + [[Monolith Split — Why and How]].

**Do not do next:** heavy assignment/owner systems; WhatsApp auto-send; Stripe mutations from `/admin/flags`; a new database to replace Sheets; editing generated config files directly.

## Source of truth & fragile contracts

Canonical/derived ownership and full forbidden-actions list live in the workspace `CLAUDE.md`. In short: Google Sheets `Students` = operational school truth; `lib/config/students-registry.js` = portal/registry truth (regenerate the rest); MMS = lesson/billing truth (calendar `Free` = free-slot truth); Stripe = payment truth; dashboard-owned state tabs are mapped in `STATE_TABS_SCHEMA.md`.

Fragile format contracts (don't change without updating the parser + tests — recorded in `STATE_TABS_SCHEMA.md` → Format Contracts):

- MMS sign-up labels `Preferred days` / `Preferred times` → waiting-list availability matching.
- The Google Sheets `Students` header row is a system contract (protect with an edit-warning; update dashboard + FC-regeneration readers deliberately).
- MMS `AttendanceStatus` strings → payroll classification; Wise CSV columns; pause-notes date format → pause forecast.
- GitHub scheduled workflows can silently stop after long inactivity — keep in the operations/health rhythm.

## Read order for a new agent

1. workspace `CURRENT_HANDOVER.md` (in-flight + machine context) → `CLAUDE.md` (rules) → this file (current + policy)
2. `git log --oneline -20` (recent change history) + Obsidian `06 Learning Log` (why)
3. `docs/admin/STATE_TABS_SCHEMA.md` (state lanes) and the relevant Obsidian `03 Architecture` note for the area you're touching
4. the code itself for behaviour — don't trust prose descriptions of code over the code
