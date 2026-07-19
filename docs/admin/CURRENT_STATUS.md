# Admin Current Status

Last updated: 2026-07-18

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

- **Legacy triptych (2026-07-19, committed, deploy pending):** three arcs chosen
  explicitly for longevity. **(1) Teaching layer:** 115 tutorNotes + 145
  studentNotes (never invented — RSL originals/exercises stay blank), 12
  curation fixes, path templates for bass/electric/piano (every instrument now
  has an entry path), and [`DISTILLATION_PLAYBOOK.md`](DISTILLATION_PLAYBOOK.md)
  making the termly telemetry→notes rhythm executable. **(2) Disaster
  recovery:** the first real restore test found five non-rebuildable tabs
  missing from the backup; fixed, and `npm run restore:drill` now rehearses a
  full restore into a guarded scratch spreadsheet (run for real: 30 tabs,
  10,809 rows, PASSED) — SPOF register + cold-start runbook in
  [`DISASTER_RECOVERY.md`](DISASTER_RECOVERY.md). **(3) Contract guards:**
  `backup-tabs.mjs` + `state-tab-contracts.test.mjs` pin managed↔backup
  coverage (exclusions need written reasons), header hygiene, and
  builder↔header agreement; `hygiene:check` prompts when a contract file
  changes without its paired guard. Why: the three 2026-07-19 Learning Log
  entries.

- **Song requests + `add-song` skill (2026-07-18, deployed `8ec6fe4`):** a
  Song Browser search miss now offers one *Request "X"* button, appending a
  `status='new'` row to the new `Song_Requests` tab (query, instrument, tutor
  from token, student context) — the catalogue's intake shifts from "what Finn
  seeded" toward "what tutors reach for". **Deliberately no admin surface:**
  the machine-level `add-song` skill (`~/.claude/skills/add-song/SKILL.md`) is
  the curation checklist (secret-link-first, entry shape, every
  `SONG_CATALOGUE_COVERAGE.md` ingestion trap) *and* the queue's consumer via
  `node scripts/list-song-requests.mjs`; resolution (`added`/`declined` +
  `song_id`) is a sheet edit during curation, not a dashboard action. The
  noticing layer is a Monday-morning launchd agent on Finn's Mac
  (`scripts/check-song-requests.mjs` + installer) that notifies only when open
  requests exist — automation of attention, while merge and deploy stay
  supervised. Why:
  [[2026-07-18 - Song Requests and the Add-Song Skill (Curation as a Queue)]].

- **Song loop telemetry (2026-07-18, deployed `8c98c41`):** two append-only
  tabs behind the existing song loop, the first slice of the
  institutional-learning direction. `Song_Status_Log` records every real
  assignment status transition as a **best-effort side effect** of the existing
  assign/status writes (an append failure never fails the tutor's request —
  evidence, not a complete ledger). `Song_Outcomes` captures the tutor's
  optional one-tap "How was it for them?" when a song hits done/parked —
  *cruised it / about right / a battle* chips + optional ≤300-char note, inline
  in the SongBrowser manage strip; a chip saves, the X skips. Contract
  decisions: `Song_Assignments.status` stays the only current-state truth; the
  new tabs are mined later (termly, approval-first distillation into catalogue
  `tutorNote`s and path ordering), **never** a dashboard panel, action queue,
  or tutor scoreboard. Pure logic in `lib/songs/outcome-helpers.mjs` (tested);
  new `POST /api/song-outcomes` uses the same per-student signed-token guard as
  song-assignments. Why: [[2026-07-18 - Song Loop Telemetry (Free Data Before Asked Data)]].

- **Cover loop rungs 1–2 (2026-07-16, deployed):** the tutor-absence "Find
  cover" choice now shows ranked cover-bank candidates for that date's weekday
  (same-day-OK free first, needs-notice next, already-teaching greyed;
  instrument matches as chips; mismatches and externals shown, never hidden —
  the bank informs, it never restricts) plus a per-candidate **"Copy ask"**
  message built from the affected lessons, logged to `Communication_Log`. A
  bank read failure degrades to the old picker. The Tutor Absence card was
  then removed from the Workflows nav page — Planning's absence builder is the
  front door (see Navigation policy below). Rung 3 (MMS lesson reassignment)
  is **parked by decision**: discovery is done (`PLAN_cover-loop.md` — single
  event confirmed, substitution first-class, price untouched), but the write
  endpoint 404s for our ApiKey-profile `MMS_BEARER_TOKEN` and needs a
  monthly-expiring Teacher-session JWT, so the MMS swap stays a manual UI step
  until living with rungs 1–2 shows it's worth the token plumbing.

- **Cover Bank workflow (2026-07-16, deployed `2899749`):** a phone-survey
  campaign page at `/admin/workflows/cover-bank`, mirroring the Parent
  Understanding pattern — Fenella calls each tutor and records the answers
  (happy to cover, yes/no; which days; OK with a same-day ask or needs notice;
  notes) in a new keyed-upsert `Cover_Bank_State` tab. "Maybe" was dropped by
  decision: every cover is arranged by asking anyway, so it carried no
  information — notice tolerance is the nuance that matters. External tutors (not teaching at the school) can be added to the bank
  and exist only as `ext:<slug>` rows. Contract decisions: stated availability
  is stored; **teaching days are never stored** — they're derived live from
  `Schedule_Context` per `teacher_id` at read time, and a tutor already
  teaching a day is *flagged, not hidden* on the per-day cover view (partial
  days exist). Pure logic in `lib/admin/cover-bank-helpers.mjs` (tested).

- **Practice focus + arc folded into the tutor Notes panel (2026-07-16, deployed `8d7e3fe`):**
  the Previous Notes panel now opens with a green **"Lesson Focus"** box
  (last lesson's goals, with a carried-over hint when the goal repeats) and one
  compact **"On the go"** line — pieces mined from phrases recurring across the
  student's own lessons (Title-Cased recurrence = piece; no vocabulary, no AI),
  with lesson counts and same-sentence tempo %. A separate Summary *tab* was
  built first and deliberately subtracted the same day: deterministic prose is
  verbatim ASR, so a prose summary just re-renders the notes — compression is
  the (unapproved) AI layer's job, and the reorder + arc facts fit inside the
  Notes view. Engine: `buildPracticeSummary` in
  `lib/admin/practice-summary-helpers.mjs` (pure, tested), served via
  `?summary=1` on the existing token-gated `/api/notes/[studentId]` route, fed
  only by the owned Practice-Notes path (boundary test guards this). Evidence
  base is thin mid-summer (~¼ of students have 3+ notes) — revisit mining rules
  as notes accumulate. AI rephrasing remains **deliberately not started** —
  a tutor-facing AI surface needs its own `AI_TOOL_CONTRACTS.md` allowlist
  entry and explicit sign-off first.

- **Optional AI issue briefing pilot (2026-07-15, deployed `a85debf`, hardened
  `3930535`):** the deterministic
  issue explanation can now be compressed on demand by a server-side model into
  a short headline, explanation, check and caveat. The model receives only the
  already-redacted explanation view model, has no tools, and cannot change or
  resolve an issue. Strict local validation, a five-second timeout, per-admin
  rate limit, deterministic fallback, enum-only feedback and a dedicated
  feature flag/key keep the integration bounded. The separate restricted
  Railway AI key and flag are configured and the production smoke test works.
  `AI_RUNTIME_INTEGRATION.md` is the canonical implementation, security,
  provider-retention, testing and reuse reference for future AI slices.

- **Human issue labels + corrected Stripe read contract (2026-07-15, deployed):**
  issue cards now expose short deterministic labels such as **Billing stopped
  unexpectedly**, **Pause state mismatch**, and **Practice note not delivered**
  while retaining stable detector types underneath. Railway's restricted Stripe
  key now has—and a no-PII live check verified—Payment Intents Read, required by
  the 12 July `latest_invoice.payment_intent` expansion. The operational minimum
  is now documented as Customers, Subscriptions, Invoices, Prices, and Payment
  Intents Read, with writes and bank-level endpoints still denied.

- **“Why does this issue exist?” deterministic layer (2026-07-15, deployed):**
  each Issues card can now load an admin-only explanation of the exact rule,
  redacted evidence, source role, queue workflow state, ambiguity, unqueried
  context, and safe next step. Static record/payment/pause detectors re-run
  through the strict read-only context service; Practice Chat, finance and live
  Stripe claims are explicitly shown as recorded-only, and opening the panel
  never refreshes a provider, syncs the issue queue, changes a record, resolves
  an issue, or calls a model. This is the first useful runtime consumer of the
  assistant-safe foundation while remaining entirely deterministic.

- **Agent-readiness improvements 9–12 + Practice Chat claim hardening
  (2026-07-15, deployed):** Practice Chat now fails closed when its delivery claim
  cannot be saved, so an MMS/Gmail action cannot start behind a failed audit
  write; a same-process key guard narrows duplicate execution while the existing
  Sheets cross-instance race remains an explicit rollout blocker. Future
  assistant work now has non-mutating strict readers, redacted student/issue
  projections, and a server-only context service with no route or model. The
  incoming-message regression set is 48 independent synthetic cases with
  privacy checks and date/abstention/harmful-archive scoring. Fixed cited
  operations guidance and a low-risk, human-approval-required communication
  proposal contract were implemented as pure seams. The later issue-briefing
  pilot is the sole model consumer; it adds no broad tool access, sending, or
  consequential action. The previous real-family fixture is removed from HEAD but still exists
  in git history; do not reuse it and do not rewrite history without an explicit
  repository-wide decision. The complete 1–12 implementation register,
  verification guide, privacy explanation, and remaining risks are in
  `AGENT_READINESS_AUDIT_OUTCOMES.md`.

- Earlier arcs (agent-readiness 1–12, explicit pause-expectation writes, the
  bass/electric shelf + registry-landmine day — song coverage and ingestion
  traps live in [`SONG_CATALOGUE_COVERAGE.md`](SONG_CATALOGUE_COVERAGE.md) —
  the WhatsApp bridge arc, finance layer, payroll V1–2) → `git log` + Learning
  Log. Tutor-facing payroll Phase 3 remains planned in
  `TUTOR_FACING_PAYROLL_ROADMAP.md`.

## Standing context & policy

Durable rules (don't grow per session). The state-tab map is `docs/admin/STATE_TABS_SCHEMA.md` — treat it as canonical before adding any Sheets tab.

- **V4 context is read-only:** `deriveStudentLifecycleStatus()`, `Schedule_Context` (cached MMS calendar, refreshed per-student / bulk / cron — not per page load), and payment value context are baseline operational context only — they don't change issue generation, onboarding, Stripe, or stored state.
- **Shared MMS slots = group lessons** when multiple students share teacher + next-lesson start + duration; price as group, not 1:1.
- **Capacity:** `/admin/capacity` reads MMS `Free` calendar slots (don't duplicate into a Sheets tab); `/admin/capacity` + `/admin/waiting` share a short-lived `Free`-slot cache; capacity page also shows schedule-cache health. `/admin/waiting` shows possible slots only where the tutor teaches the parsed instrument — hints only, no auto-assign/onboard.
- **Navigation is action-led:** Overview = today's operating summary; Issues =
  detected problems + loop actions; Workflows = tutors, waiting, recurring
  workflows, parent understanding, cover bank, incoming messages, payroll,
  and finance; Planning = due work, meeting review, school notes, ideas,
  initiatives, and linked actions. Student records are reached via search/links,
  not a top-nav mode. **Tutor absence has no nav entry:** it is entered via
  Planning's Quick-capture absence builder (per-day cards deep-link in with
  tutor+date) or the Overview open-absence signal — Planning is the front door,
  the absence page is the per-day decision room.
- **Overview placement:** top cards = work to do today / needs attention / deliberate school-improvement prompts; background health belongs lower down unless something's wrong; prefer human labels over big counts; don't add a panel just because data exists. (`docs/admin/COPY_AND_TONE.md` records the language layer.)
- **Planning state is dashboard-owned work state** (`Planning_Items` + append-only `Planning_Progress_Log`), not external truth. Linked student IDs point at `Students` rows. The Friday school-forward + Monday scheduling prompts are seeded planning items, not a workflow engine. Learning/strategic notes are planning items, not finance forecasts.
- **Pause guardrail:** pause reminders link to a student before billing actions; generic `Done` never changes payment state — **`Mark pause completed`** is the guarded action that logs confirmation, sets `stripe_paused_expected` via the student PATCH route, appends `Event_Log`, and closes the task. The dashboard generates the parent message but does **not** send WhatsApp. Parked pause cards are ignored by the finance forecast.
- **Parent understanding** (`Parent_Understanding_State`) is a manual, approval-first campaign workflow — not a CRM or message automation. Contact-detail fixes are flag/note only; don't edit MMS from it yet.
- **Practice Chat** note ownership bridges admin↔learning via `Practice_Notes_Log`. Level 2 (Gmail-delivered parent notes) is a documented **trusted-tutor rollout**: all registered tutors are enabled by default (or can be constrained with `PRACTICE_NOTES_ENABLED_TUTORS`). The final PWA action names the server-derived parent recipient and requires a specific human confirmation. The selected tutor is self-attested, matched against the student's one clear tutor assignment, and recorded as such rather than treated as verified identity. Each `delivery_key = student + MMS attendance + note hash` is claimed atomically in PostgreSQL before Sheets/MMS/Gmail work. Gmail errors after MMS are manual follow-up, never automatic retry. The recipient-record preflight and recovery procedure are in `PRACTICE_CHAT_DELIVERY_AUDIT.md`; transactional lesson-note email remains the one automated-email exception — payment/pause/onboarding/WhatsApp/marketing stay approval-first.
- **Finance lanes** (see [[Financial Layer]]): `Expenses` = recurring overhead; `Expense_Log` = actual spend to reconcile at month-end (replaces the old `General` buffer); `Finance_Snapshot` = dated estimates, not accounting (each row's `notes` = `PRICE_ASSUMPTIONS_VERSION`); `Stripe_Amounts_Cache`/`Stripe_Collected_Monthly` = weekly-cron Stripe actuals + monthly collections (read-only calibration — live Stripe truth stays in Stripe); `Payroll_Runs` = payroll review/paid ledger; `Tutor_Pay`/`Tutor_Wise` = pay config + Wise recipients (salaries/banking never in git).

Before deploying, verify with:

```bash
npm run hygiene:check
npm run test:admin
npm run lint
npm run build
```

`hygiene:check` is deliberately non-blocking. It scans changed files and project size signals, then prints prompts for judgement: large files, meaningful code without docs, Sheets/state-layer touches without `STATE_TABS_SCHEMA.md`, and admin workflow/route changes without a current-status note.

## Next / Not now

Open candidates (the Obsidian `08 Operations/Active Roadmap` is the fuller list):

**Student Paths — the live thread.** Full detail in [`SONG_CATALOGUE_COVERAGE.md`](SONG_CATALOGUE_COVERAGE.md); the decisions that need Finn are:

- ~~Path templates for bass, electric guitar and piano~~ **DONE (2026-07-19):** `fc_path_bass_grade_1`, `fc_path_electric_debut`, `fc_path_piano_debut` — every instrument now has an entry path (pilot orderings; sanity-check with Tom after ~2026-08-03 only if they feel wrong). Standing rule unchanged: **no templates for John Thompson's books**. The catalogue teaching layer shipped the same day (115 tutorNotes + 145 studentNotes; RSL originals/exercises deliberately blank — never write those without the scores). Termly telemetry→notes rhythm is now an executable recipe: [`DISTILLATION_PLAYBOOK.md`](DISTILLATION_PLAYBOOK.md).
- **Extend the RSL series to Grade 7–8?** A few lines in `SONG_SERIES`. It is the single gate blocking three ingests: bass *Advanced (6–8)* (9 songs), electric *Grade 7*, electric *Old Grade 8*. Nobody on the roster obviously needs those grades yet, which is why it has waited.
- ~~Verify piano's `artist: 'RSL'` songs~~ **DONE (2026-07-14): 13 of 26 were wrong.** *Danny* is Daniel Rosenfeld's, *Arcadia* is Lana Del Rey's, and the whole Classical Grade 1 set had real composers. All corrected, and a test now pins every remaining `'RSL'` song to an explicit `VERIFIED_RSL_ORIGINALS` list. **Open:** piano G2's *"Le Noche En Havana"* may be a garbled *"La Noche En Rio"* — the physical Grade 2 book settles it.
- **Slices Finn must create in Soundslice:** guitar *Songbird* (G5) and *More Than Words* (G6); **all** piano Grade 2 technical exercises; a real **Bass Debut list** (Debut currently holds one orphan song). Plus three artist/title typos to fix at source.
- Fretboard / chord paths — deliberately deferred ("hold off at the moment").
- Slice 8 (recommendations / per-lesson progress log) — unbuilt unless justified.

- **Tutor-facing payroll — Phase 2 shipped; Phase 3 deferred:** reviewed figures produce a signed no-login statement link; tutors can confirm or query; confirmation-required rows wait, disputes are held out of Wise, and the same printable record becomes a dated receipt after payment. The live operating sequence is `docs/workflows/06-paying-tutors.md`; design history and the remaining cadence/scheduled-delivery work are in `docs/admin/TUTOR_FACING_PAYROLL_ROADMAP.md`. Only Phase 3 needs persistent tutor auth/contact email.
- Pause-loop maturity — make pause issue cards clearer about whether a mismatch is from `Pause History`, sheet expectation, or live Stripe (Stripe mutation stays out of scope).
- Contact-role model before any message automation.
- Communication draft→approve layer before any WhatsApp Cloud API (no auto-send).
- **Incoming/WhatsApp groups — deferred (from the 2026-07 build):** (a) **PII/retention + lawful-basis note** for stored parent/child message content — not yet written; (b) **capture a student's WhatsApp group at onboarding** rather than relying only on the weekly re-sync; (c) **sibling groups are add-only in the UI** — removing a mis-added student means editing `WhatsApp_Group_Map.additional_mms_ids` directly (add a remove affordance if it bites); (d) **"open the group from a planning card" — explored and shelved:** desktop invite-link (browser interstitial + "Open WhatsApp?" handoff) is clunkier than just searching the predictable group name, so we surface nothing; a phone-only invite-link button is possible later at a one-time ~189 **admin-gated** `groupInviteCode` fetch (codes are revocable) — only worth it if the phone flow specifically annoys; (e) the **last-active/inactivity filter is inert** (Baileys history doesn't deliver `conversationTimestamp` in the sync window; `skippedInactive` stays 0) — roster bucketing covers old-student removal, so the timestamp path is prunable dead-ish code.
- Practice Chat Level 2: run the production manual checks for the trusted-tutor rollout, especially the two students currently missing a parent email and one real end-to-end send.
- Future capacity overlay (tentative/hire availability) — only after the MMS `Free` view proves useful; keep separate from real calendar data.
- **Monoliths to split:** planning client and `sheets.js` are done (see Recently shipped). Remaining candidates are feature/section-component peels where helpers already exist: `AdminIssuesPageClient.js`, `AdminStudentDetailClient.js`, `AdminParentUnderstandingPageClient.js`. See `docs/admin/MONOLITH_SPLIT_MAP.md` + [[Monolith Split — Why and How]].

**Do not do next:** heavy assignment/owner systems; WhatsApp auto-send; Stripe mutations from `/admin/flags`; a new database to replace Sheets; editing generated config files directly.

## Source of truth & fragile contracts

Canonical/derived ownership lives in `STATE_TABS_SCHEMA.md` and
`OWNERSHIP_MATRIX.md`; repository-wide forbidden and approval-gated action
boundaries live in `AGENTS.md`. Google Sheets `Students` = operational school
truth; `lib/config/students-registry.js` = portal/registry truth (regenerate the
rest); MMS = lesson/billing truth (calendar `Free` = free-slot truth); Stripe =
payment truth.

Fragile format contracts (don't change without updating the parser + tests — recorded in `STATE_TABS_SCHEMA.md` → Format Contracts):

- MMS sign-up labels `Preferred days` / `Preferred times` → waiting-list availability matching.
- The Google Sheets `Students` header row is a system contract (protect with an edit-warning; update dashboard + FC-regeneration readers deliberately).
- MMS `AttendanceStatus` strings → payroll classification; Wise CSV columns; pause-notes date format → pause forecast.
- GitHub scheduled workflows can silently stop after long inactivity — keep in the operations/health rhythm.

## Read order for a new agent

1. repository `AGENTS.md` (map + safety rules) → this file (current direction)
2. `git log --oneline -20` (recent change history); workspace handovers and the Obsidian Learning Log are optional context for why
3. **working on songs, grades, or paths?** `docs/admin/SONG_CATALOGUE_COVERAGE.md` — coverage, every known gap, and the ingestion traps that have already drawn blood
4. `docs/admin/STATE_TABS_SCHEMA.md` (state lanes); a relevant Obsidian `03 Architecture` note is optional design context
5. the code itself for behaviour — don't trust prose descriptions of code over the code
