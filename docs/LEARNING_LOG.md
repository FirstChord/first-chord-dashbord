# Learning Log

## Rule

For meaningful architectural changes, suggest a short entry for this file.

Each entry should include:

- Date
- Feature/change
- Why it exists
- Source-of-truth impact
- Files/functions involved
- What to watch out for

Do not append for tiny styling changes.

Use this alongside `docs/admin/ADMIN_IMPLEMENTATION_LOG.md`: the implementation log records what changed chronologically; this learning log captures reusable design lessons and architectural decisions.

## Entries

### 2026-07-01 — Bulk WhatsApp group ID sync

**Feature/change:** Added `npm start -- --sync-groups` to the bridge: it enumerates every group the linked account is in (`groupFetchAllParticipating`, metadata only), gathers last-active times from chat history, and POSTs them (`mode: sync_groups`). The dashboard keeps only First Chord groups (instrument token in the title, active within 6 months), auto-matches a student by participant phone then title name, and stores each as a `review` hint. New group-map panel in the inbox lets an admin confirm/ignore each group directly (`mode: review_group`) without waiting for a message.

**Why it exists:** The group map was purely reactive — a group only became known when someone starred a message from it, so matching coverage grew slowly and "unmatched" messages from known groups were common. Bulk sync makes the roster a one-time triage instead of a slow drip. Key design principle: **decouple "knowing the groups" (cheap, metadata-only, bulk) from "capturing message content" (sensitive, targeted, starred)** — the sync never ingests message text.

**Design decisions:**
- **Instrument-token filter** is the FC/personal-group discriminator (Finn's constraint: every FC group title has an instrument + the student name). Whole-token match avoids substring false positives ("bass" ≠ "embassy"); roster instruments are unioned into the keyword list so new instruments self-register.
- **Participant phone > title name** for matching — deterministic phone match against `contactNumber` beats name guessing. Only `@s.whatsapp.net` participants are used (LID ids excluded to avoid false phone collisions).
- **6-month inactivity cutoff**, fail-open on unknown last-active (a groups-only sync should never silently drop a live group).
- **Confirmed groups are never downgraded** by a sync; ignored groups are left alone.

**Source-of-truth impact:** `WhatsApp_Group_Map` stays workflow state; now has two population paths (reactive capture + bulk sync) and a direct review path. `status` ∈ `review`/`confirmed`/`ignored`.

**Files/functions involved:** `detectInstrumentInName`, `matchGroupToStudent`, `buildGroupSyncPlan` (`incoming-message-helpers.mjs`); `syncWhatsappGroups`, `reviewWhatsappGroup` (`incoming-messages.js`); `sync_groups`/`review_group` route modes; `runGroupSync`/`sendGroupSync` + `--sync-groups` (bridge `bridge.js`); `GroupMapPanel`/`GroupRow` (`AdminIncomingMessagesPageClient`).

**What to watch out for:** `groupFetchAllParticipating` is metadata only — last-active comes from a best-effort history-sync wait (`GROUP_SYNC_WAIT_MS`, default 8s); groups without a timestamp are kept, not dropped. Baileys is unofficial (breakage risk, not ban risk for this read-only/low-volume use). If group-title conventions ever change (instrument dropped from the name), the instrument filter would start excluding real groups — that's the fragile contract.

**Follow-up (same day) — live-socket trigger:** the one-shot `--sync-groups` opens its *own* WhatsApp connection, which collides with the always-on bridge (both share one linked-device session → repeating `connectionReplaced`, status 440). WhatsApp allows only one live connection per device. Fix: the running bridge now syncs on its **own** socket via `SIGUSR1` (`kill -USR1 <pid>`) or `SYNC_GROUPS_ON_START=true`, sharing `collectParticipatingGroups`/`recordChatTimestamps`. The standalone command remains for when the bridge isn't running (and now reconnects on non-logout closes, e.g. 515 restart-required). The always-on bridge is a **launchd agent** (`~/Library/LaunchAgents/com.firstchord.whatsapp-incoming-bridge.plist`, `KeepAlive`) — never hand-launch a second one. Lesson: any second Baileys process on the same auth will fight the first — trigger work on the existing socket, don't spawn a rival.

**Follow-up (same day) — scale:** a real account had **612 groups**; sending all of them and writing matched rows one-per-Sheets-call blew the 30s ingest timeout. Two fixes: (1) the bridge pre-filters to likely lesson groups (`titleLooksLikeFcGroup`: instrument keyword or "lessons" in the title) and caps participant phones (50) before POSTing — no student data needed, dashboard still does authoritative matching; (2) `syncWhatsappGroups` builds all rows in memory and writes them via `batchUpsertWhatsappGroupMapRows` (one `values.batchUpdate` for existing rows + one `append` for new — two API calls total, not N). Bridge POST timeout raised to 120s for headroom. Lesson: any "sync all the things" path over Google Sheets must batch writes — per-row upserts don't scale past a few dozen rows.

**Follow-up (2026-07-02) — roster-based auto-filter:** a real sync kept 433 groups (189 matched), too many to triage. Rather than lean on the flaky Baileys last-active timestamps (`skippedInactive` was 0 — history didn't arrive in the 8s window), the dashboard now buckets by the **current student roster**: matched a current student → `review` (surfaced, sorted best-match first); matched nothing → `unmatched` (old students / non-lesson groups, hidden behind a toggle). `decideSyncedGroupStatus` (never downgrades a `review`/`confirmed`/`ignored`). This is the reliable "filter without manual work" — old students fall out because their name isn't in the active roster, no timestamp needed. History-settle wait still bumped to 25s so inactivity filtering is best-effort on top. UI: `GroupMapPanel` shows matched-first with "show unmatched" / "show confirmed-ignored" toggles.

### 2026-07-01 — Incoming message review audit trail

**Feature/change:** Added `reviewed_by` (admin email) and `reviewed_at` (ISO) columns to `Incoming_Message_Inbox`, stamped on every review action — archive/ignore (`updateIncomingMessageReview`), correction (`correctIncomingMessage`), and convert (`convertIncomingMessageToPlanning`, via correct). Surfaced as a "Last actioned by … · <time>" line on each inbox card.

**Why it exists:** The inbox's whole job is "a human decided" — but archive/ignore recorded no actor or timestamp, so you couldn't later see who handled a message or when. This closes that gap without changing behaviour.

**Source-of-truth impact:** `Incoming_Message_Inbox` stays workflow state; two new audit columns. `updateIncomingMessageReview` now takes `actorEmail` (passed from the route session), matching `correctIncomingMessage`.

**Files/functions involved:** `INCOMING_MESSAGE_INBOX_HEADERS` (`sheets/core.mjs`), build/read mapping (`sheets/incoming-messages.mjs`), `updateIncomingMessageReview`/`correctIncomingMessage` (`incoming-messages.js`), route `review` mode, `MessageCard` (`AdminIncomingMessagesPageClient`).

**What to watch out for:** New columns are appended to the live sheet by `ensureManagedSheet` on next run (reads map by header name, so constant order is cosmetic). `reviewed_at` is overwritten on each action (last-actioned, not first) — the full sequence still lives in nothing; if per-action history is ever needed, that's an append-only log, not this field.

### 2026-07-01 — Incoming message → Planning item + WhatsApp reply draft

**Feature/change:** Added `Convert to plan + draft reply` to the incoming inbox. One action applies the reviewed correction, creates a linked `Planning_Items` action, stamps `created_planning_id` on the inbox row, marks it `converted`, and returns a per-category WhatsApp reply draft shown in an editable copy box. `created_planning_id` was previously plumbed but never written by any flow — this wires it.

**Why it exists:** The inbox captured and triaged messages but then dropped the human back into doing the follow-up by hand, outside the system. "Converted" meant only "archived". Closing the loop means a correct reading now produces both the tracked work item and the reply to send, so intent → action → parent communication all live in one place.

**Design decisions:**
- **Idempotent planning id** `planning_<incoming_id>` — re-converting upserts the same task instead of duplicating (mirrors the first-lesson-checkin deterministic-id pattern).
- **Reply is copy-paste only.** No auto-send, keeping the bridge's transport-only boundary intact. `buildIncomingReplyTemplate` matches `buildTutorAbsenceMessage`'s tone.
- **Category → planning `area`:** absence/schedule → `workflow`, payment/leaving → `finance`, concern/general → `parent`. Original message + suggested reply travel in the item notes so context stays with the plan.
- Just-converted rows stay visible in the UI (via a client-side `conversions` map) even though `converted` is normally hidden, so the reply doesn't vanish on save.

**Source-of-truth impact:** `Incoming_Message_Inbox` and `Planning_Items` both remain workflow state; the link is `created_planning_id`. No new tab.

**Files/functions involved:** `buildIncomingReplyTemplate`, `buildIncomingPlanningDraft` (`incoming-message-helpers.mjs`), `convertIncomingMessageToPlanning` (`incoming-messages.js`), `mode: 'convert'` in the route, `ReplyPanel`/`handleConvert` in `AdminIncomingMessagesPageClient`.

**What to watch out for:** Reply wording is generic per-category — always edited by a human before sending. If planning `area`/`status` conventions change, update `buildIncomingPlanningDraft`. The `/admin/planning?focus=` link param is forward-compatible only (the page doesn't consume `focus` yet).

### 2026-07-01 — Incoming message corrections and WhatsApp group training

**Feature/change:** Added review corrections for incoming WhatsApp/manual messages. Admins can correct the category, matched student, reviewer note, and optionally confirm a WhatsApp group-to-student map. Confirmed group maps now store selected student context: MMS ID, FC ID, parent name/phone, tutor, instrument, `confirmed_by`, and `confirmed_at`.

**Why it exists:** Starred WhatsApp messages are useful evidence, but parent wording is often ambiguous. Corrections turn one-off review work into reusable matching context without letting messages trigger automatic actions.

**Source-of-truth impact:** `Incoming_Message_Inbox` remains workflow state. `WhatsApp_Group_Map` is workflow/context state; confirmed groups become high-confidence matching evidence and communication context, not external truth.

**Files/functions involved:** `classifyIncomingMessage`, `matchIncomingMessageToStudent`, `correctIncomingMessage`, `buildWhatsappGroupMapRecord`, `upsertWhatsappGroupMapRow`, `AdminIncomingMessagesPageClient`.

**What to watch out for:** Group names can change, groups can contain siblings, and historical groups may belong to old students. Confirmed maps should improve matching, but consequential actions still need human review.

**Follow-up UI hardening:** The inbox now hides archived/ignored rows by default. Correction is the primary action: `Save correction` keeps the row open, while `Save + archive` records the training and removes the row from the active inbox once the real action has been handled elsewhere.

### 2026-06-30 — Incoming Message Inbox

**Feature/change:** Added `Incoming_Message_Inbox` as a review inbox for inbound parent/tutor messages. Admins can paste a message manually at `/admin/incoming-messages`; a future n8n/starred-WhatsApp bridge can POST the same shape to `POST /api/admin/incoming-messages` using `INCOMING_MESSAGE_INGEST_SECRET`. The system deterministically labels likely absence/pause/payment/schedule messages and tries to match a student by phone/name.

**Why it exists:** WhatsApp currently holds operational intent such as "we're away next week" or "can we pause lessons?" This gives the dashboard a safe intake lane before those messages become planning items, pause actions, or issue context.

**Source-of-truth impact:** Inbound messages are not source truth and do not trigger actions. The inbox is workflow state: a captured prompt for human review. Sheets/MMS/Stripe still own the underlying operational facts; humans still approve pauses, payment changes, and parent-facing replies.

**Files/functions involved:** `Incoming_Message_Inbox` headers in `lib/admin/sheets/core.mjs`; `lib/admin/sheets/incoming-messages.mjs`; `lib/admin/incoming-message-helpers.mjs`; `lib/admin/incoming-messages.js`; `app/api/admin/incoming-messages/route.js`; `/admin/incoming-messages`; workflow card in `/admin/workflows`.

**What to watch out for:** Classification is keyword-based, not AI. False positives are expected and should remain harmless because review is manual. External bridge writes require a shared secret; CORS is not authentication. Do not auto-create pause/payment actions from inbound messages without designing the approval/recovery loop.

### 2026-06-30 — Practice Chat Side Panel On Tutor Dashboard

**Feature/change:** Practice Chat now opens from the tutor dashboard inside a right-side iframe panel instead of always launching a new tab. The panel includes backdrop/Escape close behaviour and an `Open full page` fallback.

**Why it exists:** Tutors should be able to move from student context into note capture without losing their place in the tutor dashboard. This follows the admin dashboard side-panel pattern already used for the payment pause tool.

**Source-of-truth impact:** No source of truth moved. The tutor dashboard hosts the Practice Chat UI, but Practice Chat and its API routes remain responsible for note capture, delivery, and logging.

**Files/functions involved:** `QuickLinks`, `DashboardClient`, Practice Chat URL builder in `components/navigation/QuickLinks.js`.

**What to watch out for:** The hosted Practice Chat page must allow iframe embedding. Keep the full-page fallback because local Practice Chat testing still depends on the separate `localhost:8000` PWA server.

### 2026-06-30 — Tutor dashboard daily schedule context

**Feature/change:** Added a read-only daily schedule panel to `/dashboard`. `GET /api/tutor-schedule` reads one tutor/date from the MMS calendar, `buildTutorDaySchedule` normalises lessons, and `TutorSchedulePanel` shows the day’s lessons in the empty state and as a compact collapsible panel once a student is selected. Rows also translate MMS attendance statuses into tutor-facing context: expected, absent with notice, absent without notice, present, or mixed.

**Why it exists:** Tutors need the dashboard to answer “who am I teaching today?” before they choose a student. This makes the tutor dashboard more lesson-day useful without adding write actions or changing Practice Chat behaviour yet.

**Source-of-truth impact:** MMS calendar and attendance state remain the schedule/attendance truth. The dashboard returns derived read-only context only; it does not create, edit, cancel, or mark attendance on MMS events.

**Files/functions involved:** `normaliseTutorScheduleEvent`, `buildAttendanceSummary`, `buildTutorDaySchedule`, `/api/tutor-schedule`, `TutorSchedulePanel`, `/dashboard/page-client`.

**What to watch out for:** Schedule rows only open a student when the MMS event student ID is already present in the loaded tutor roster. Free slots are excluded from this tutor-day view. `AbsentNotice` is displayed as absence context only; do not infer practice-video obligations until that workflow is designed separately. Future Practice Chat side-panel work should pass explicit event/attendance context but keep Level 2 guardrails.

### 2026-06-30 — Tutor dashboard identity consolidation

**Feature/change:** Added `lib/tutor-dashboard-helpers.mjs` as the shared tutor-dashboard helper layer. The live tutor dashboard now renders tutor choices from `ADMIN_TUTORS`, and `lib/mms-client.js` resolves tutor MMS teacher IDs from the same generated source instead of maintaining its own hardcoded teacher map.

**Why it exists:** The tutor/student dashboard is older than the admin dashboard and had started to duplicate source-of-truth logic. Centralising tutor identity reduces the chance that a tutor appears in one place but cannot load MMS students, or that future schedule features use a different teacher ID from admin workflows.

**Source-of-truth impact:** No external truth moved. `ADMIN_TUTORS` remains generated tutor identity/context; MMS remains tutor roster and schedule truth. The dashboard helper is derived glue, not a new editable source.

**Files/functions involved:** `getTutorDashboardOptions`, `getTutorDashboardOptionNames`, `resolveTutorTeacherId`, `buildTutorTeacherIdMap`, `filterTutorStudentsBySearch`, `/dashboard` tutor picker, `MMSClient.getStudentsForTeacher`.

**What to watch out for:** old tutor aliases that are not in `ADMIN_TUTORS` are no longer silently supported by the roster helper. Add/correct tutors through the admin tutor source and regeneration process, not by patching `mms-client.js`.

### 2026-06-27 — Payroll hardening: since-last-paid window + override + double-pay guard

**Feature/change:** Reworked the payroll pay-window from a fixed per-tutor cadence to **"since they were last paid → this Wednesday."** Pay date is the constant (every Wednesday); the *period* each invoice covers is variable, so anchoring to the last paid run is the right primitive. `resolveTutorPayrollWindow` (pure) + `overlapsPaidRun` (pure) + `cadenceLengthDays`. `buildPayrollPreview` now derives each tutor's window from their paid runs in `Payroll_Runs`, with a per-tutor override and a max-look-back cap. UI: window basis + day count on each card, a "Window start" adjust control (one tutor at a time, `?tutor=&start=`), and warnings for overlap / already-paid-through / capped. Page fetches 35 days of attendance to cover catch-up windows. 3 new tests; suite 363, build clean.

**Why it's the right design:** it solves three edge cases at once — variable length (auto), catch-up if an invoice was missed (window stretches back to last paid), and **double-pay is structurally impossible** (the window starts *after* the last paid period). Self-perpetuating: marking a run paid sets the next run's anchor; no new storage (reuses `Payroll_Runs` period + status). The override + existing Adjustment field cover irregular invoices and £ deltas.

**Lesson:** when a recurring process has a fixed anchor (the Wednesday) but a variable span, model the span as "since the last completed one," not as a fixed cadence — it removes manual tuning and the double-count class of bug by construction.

**Watch:** the overlap guard is period-level, not lesson-level (good enough with the since-last-paid default; lesson-level cross-run dedup is a future slice if needed). Cover-lesson attribution still deferred to V2.

### 2026-06-27 — Payroll flexibility, reconciliation loop-closing, roster snapshot, read-quota fix (deployed d2c4a00)

**What:** Batch shipped before the hardening. (1) **Reconciliation loop-closing** — a "Confirm paused (fix flag)" action on `/admin/finance/reconciliation` conflicts: sets live `payment_expectation=stripe_paused_expected` + `Event_Log` audit, resolving the lane conflict at source (first write action from the reconciliation layer; auth-gated, reuses the auto-sync write). (2) **Roster into snapshot** — weekly `Finance_Snapshot` now captures `onboarded_count`/`left_count` (`countDatesInRange`). (3) **Payroll** — `three-weekly` cadence option; mark-paid → owed shows £0 (`owedAmount`), headline "Outstanding to pay". (4) **Read-quota fix** — `getSpreadsheetMetadata` is 60s-cached + `withSheetsRetry` + trimmed `fields`, so managed-tab-heavy pages share one metadata read and 429s back off instead of crashing (was crashing the live payroll page).

### 2026-06-27 — Roster movement (onboarded vs left)

**Feature/change:** `lib/admin/roster-movement.mjs` (pure `buildRosterMovement` + `onboardedDatesFromWaitingState` / `leftDatesFromArchive`) + a read-only "Roster movement" panel on `/admin/finance`: onboarded vs left vs net, by month, last 6 months, computed retroactively from dated source records. New `getStudentsArchiveRows` reader. 5 tests; suite 357 pass, build clean.

**Why:** simple growth/churn logging Finn asked for. The aggregate active count is already snapshotted weekly (Finance_Snapshot) so net trend was free; this adds the gross flows (joined / left).

**Sources + honest caveat:** onboarded = `Waiting_List_State` rows with `status = 'onboarded'` (dated by `updatedAt`, fallback `dateStarted`); left = `Students_Archive.archived_at`. **It only counts movements made through the dashboard flows** — a student added straight to the sheet/registry, or who quietly goes inactive without being archived, won't be counted. So sparse months mean "the flow wasn't used," not "nobody moved." Documented in the UI copy.

**Files:** `lib/admin/roster-movement.mjs` (new) + tests; `lib/admin/sheets.js` (`getStudentsArchiveRows`); `app/admin/finance/page.js` (panel). Read-only, no new tab.

**Possible next:** fold `onboarded_count` / `left_count` into the weekly `Finance_Snapshot` so gross flows accrue in the same forward series; tighten sources if the dashboard flows aren't used consistently.

### 2026-06-26 — Reconciliation preview (absence ↔ pause) + live-state fix

**Feature/change:** Wired L1 into a read-only **absence reconciliation preview** at `/admin/finance/reconciliation` (linked discreetly from the finance page). New pure adapter `lib/admin/reconciliation-adapter.mjs` maps `Tutor_Absence_State` facts + `Pause History` into `reconcileEpisode` inputs (priced via existing value/cost helpers); the page renders, per tutor, the net-new finance effect and three groups: **net-new (need pause + message)**, **already covered by their own pause**, and **confirm these (conflicts)**. Read-only — nothing written, sent, or fed into finance. 6 adapter tests; suite 352 pass.

**Validated on Tom's real four-week July absence:** of 20 affected families, 13 net-new, 6 already-paused (suppressed), 1 genuine conflict. The salaried wrinkle is correct — Tom's tutor-pay effect is £0.

**Key bug found + fixed (the lesson):** the adapter first read each student's `payment_expectation` from the **snapshot frozen into the absence row** when the card was made — which goes stale. A student paused *after* the card was made (e.g. Duke) showed `stripe_active_expected` in the snapshot while live state was `stripe_paused_expected`, producing **false conflicts** (4 → 1 once fixed). Fix: live student record (`getOperationalAdminStudents`) overrides the snapshot for `payment_expectation`/email/sub. **Lesson: a reconciliation is only as current as its least-current input — prefer live records over embedded snapshots for cross-lane checks.** The read-only "confirm, don't auto-apply" design is what surfaced this safely before it caused a wrong action.

**Cross-lane confidence rule** lives in the adapter (`resolvePauseMatchConfidence`), not the engine: a dated pause that *agrees* with the live paused flag → high confidence → suppress; a pause that *disagrees* (flag says active) → low confidence → engine routes to `needs_clarification`. Keeps the engine lane-pure.

**Files:** `lib/admin/reconciliation-adapter.mjs` (new) + tests; `app/admin/finance/reconciliation/page.js` (new); `app/admin/finance/page.js` (link). Still no persistence/auto-action — loop-closing (acting from the page) is a deliberate later slice.

### 2026-06-26 — Temporal reconciliation core L1 (pure, read-only)

**Feature/change:** `lib/admin/reconciliation-helpers.mjs` (`reconcileEpisode`, pure) — the foundation slice of a temporal reconciliation layer. Reconciles one episode's lesson instances against overlapping facts, per lesson, then aggregates to finance / family-episode / unresolved. **V1 scope: tutor_absence ↔ student_pause only.** 11 fixture + invariant tests; suite 346 pass, build clean. **Not wired into finance, UI, or persistence** — read-only foundation.

**Why:** today "count an overlapping pause/absence once" is enforced by a *convention* (parking superseded planning cards) that needs manual cleanup. This replaces the convention with a deterministic, explainable, recompute-safe mechanism — the architectural pattern (facts → derived reconciliation → projections) that makes the dashboard safe to extend and delegate.

**Key design decisions:**
- **Per-consequence resolution, not one priority.** Revenue dedups to *net-new* (a pre-existing pause → 0 new effect; partial overlap nets by date). Tutor cost resolves by cover/cancel and dedups per slot (group paid once). Planning/comms resolve by "is there net-new work/dates."
- **`netNewLost` vs `grossLost`:** finance sums net-new (avoids double-counting an already-paused lesson); gross retained as evidence.
- **`cover` + `student_pause` = conflict → `needs_clarification`** (mutually exclusive in reality; never auto-resolved — Finn confirmed a covered lesson means the student isn't paused and vice-versa).
- **Low-confidence pause match** (email-only) → resolve conservatively as the absence, flag `clarify`; never silently suppress on a shaky link.
- **Lesson identity = MMS `eventId`** (student+date was insufficient — group lessons share one event, same-day collisions). Slot key = eventId for tutor-cost dedup.
- Pure: every effect carries `evidence` + `reasonCode`; idempotent (same inputs → deep-equal).

**Source-of-truth note:** L1's student-pause fact is `Pause History` (dated windows) only; `payment_expectation` and live Stripe are deliberately NOT inputs (distinct lanes — billing reconciliation is a later concern).

**Files:** `lib/admin/reconciliation-helpers.mjs` (new) + `tests/admin/reconciliation-helpers.test.mjs` (new). Concept note: `docs/obsidian/03 Architecture/Temporal Reconciliation Layer`.

**Watch / next:** still unwired. Later slices (separate PRs): finance reads net-new effects (shadow-compared against the parked-card forecast before switching), an episode UI card, persisted human decisions only if existing workflow state can't represent them, and a comms-coverage model (parent-knowledge) deferred to V2. Pause coverage is treated inclusive of both window ends to match `derivePauseCoverageContext`.

### 2026-06-25 — Payroll review V1

**Feature/change:** Added a first payroll review surface at `/admin/finance/payroll`. It previews Wednesday tutor pay from MMS attendance, applies `Tutor_Pay` rate/cadence assumptions, flags unrecorded/review lessons, and lets an admin mark each tutor/pay-period row `reviewed` or `paid`.

**Why it exists:** Tom currently checks payroll in MMS. Payroll V1 lets the dashboard start building trust against MMS without taking over payment execution. It reduces the weekly calculation/reconciliation load while keeping a human in charge.

**Source-of-truth impact:** no external truth changes. MMS remains the V1 attendance/payroll comparison source. `Tutor_Pay` is dashboard finance config. `Payroll_Runs` is dashboard workflow state/audit for review and payment decisions, not proof that money left the bank.

**Files/functions involved:** `lib/admin/payroll-helpers.mjs` (`buildPayrollPreview`, `buildPayrollPeriod`, `buildPayrollRunId`), `lib/admin/cost-helpers.mjs` (`calculateTutorSlotPay`, `parseTutorPay` cadence fields), `lib/admin/mms.js` (`searchAttendanceForPayroll`), `lib/admin/sheets.js` (`Payroll_Runs`, expanded `Tutor_Pay` headers), `app/admin/finance/payroll/page.js`, `tests/admin/payroll-helpers.test.mjs`.

**Data read/written:** reads MMS attendance for the relevant weekly/biweekly payroll window, `Tutor_Pay`, and existing `Payroll_Runs`; writes `Payroll_Runs` keyed by tutor + pay period with review/paid state, adjustments, invoice status, notes, timestamps, and acting admin. The local Sheets backup now includes the finance/payroll tabs.

**What to watch:** unrecorded MMS lessons are intentionally flagged for review and not paid automatically. Group lessons are paid once per teaching slot. Salaried tutors add no variable pay. Biweekly tutors require `invoice_cadence` in `Tutor_Pay`; blank means weekly. Adjustments should be explained in notes. This does not create bank payments, payslips, or invoice chasing yet.

**Manual checks:** Tom should compare the first few Wednesday runs against MMS payroll before trusting the dashboard. Check a known group lesson, a covering/absence lesson, a salaried tutor, a weekly hourly tutor, and a biweekly tutor. Mark one tutor reviewed, then paid, and confirm the state persists after refresh.

### 2026-06-25 — Tutor absence pause cards supersede safely

**Feature/change:** Tutor-absence cancellation pause plans now supersede safely as more dates are added. A first cancelled lesson may create a single-date pause card; when the next weekly cancelled date is saved, the dashboard creates a grouped away-period card and parks the single; when a third date is saved, it creates/updates the longer period and parks the shorter period.

**Why it exists:** Summer/tour absences are naturally entered over several dates, but parents, payment handling, and finance need one clear period per student. The dashboard has to reduce repeated work without losing evidence of what was captured along the way.

**Source-of-truth impact:** no external truth changes. MMS remains lesson/schedule truth. `Tutor_Absence_State` remains per-date workflow state. `Planning_Items` holds the active grouped pause card plus parked superseded cards. `Planning_Progress_Log` records the superseding. Finance ignores `parked` pause cards.

**Files/functions involved:** `createStructuredPausePlanningFromCancellation()` in `lib/admin/tutor-absence.js`; `buildTutorAbsencePausePlanningBundle()`, `splitCandidatesIntoBlocks()`, `buildTutorAbsencePausePlanningId()`, and `buildTutorAbsencePausePeriodPlanningId()` in `lib/admin/tutor-absence-helpers.mjs`; `parsePauseWindowsFromPlanning()` in `lib/admin/pause-forecast.mjs`; `tests/admin/tutor-absence-helpers.test.mjs`; `tests/admin/pause-forecast.test.mjs`.

**Verified example:** On 2026-06-25, Tom's July Monday cancellations produced per-date `Tutor_Absence_State` rows. Rosie Ward's `Pause Rosie Ward lesson on Mon, 6 Jul 2026` card was parked after the 6+13 July grouped card appeared; that shorter period was then parked when the active 6+13+20 July card appeared: `Pause Rosie Ward from Mon, 6 Jul 2026; returning Mon, 27 Jul 2026`.

**What to watch:** complete the grouped period card rather than the early single-date card when a multi-week absence is still being entered. If a cancellation later becomes cover, park/remove the corresponding pause Planning card manually unless a future reconciliation tool is added.

### 2026-06-25 — Planning remove is soft-delete via parked state

**Feature/change:** Planning cards can now be removed from active work by parking them from the UI. Parked cards remain in `Planning_Items` and keep their `Planning_Progress_Log` history, but they are no longer active meeting work. The finance pause forecast now ignores parked pause-planning cards while still counting `done` pause cards.

**Why it exists:** Sometimes a card is obsolete, duplicated, or captured in the wrong shape. Hard-deleting planning rows would lose context and make sheet recovery harder; parking gives Finn/Tom a safe way to clear the board without damaging the audit trail.

**Source-of-truth impact:** no external truth changes. `Planning_Items.status = parked` is dashboard workflow state. Finance remains derived-context and treats parked pause cards as intentionally withdrawn.

**Files/functions involved:** `components/admin/AdminPlanningPageClient.js` (`handleArchiveItem`, Remove buttons), `lib/admin/pause-forecast.mjs` (`parsePauseWindowsFromPlanning`), `tests/admin/pause-forecast.test.mjs`.

**What to watch:** use `done` for a real pause/action that has been completed, and `parked` for a card that should no longer drive work or finance forecasting. If a grouped tutor absence card replaces older single-week cards, park the obsolete cards rather than deleting sheet rows.

### 2026-06-25 — Tutor absence parent messages group by cancellation period

**Feature/change:** Repeated cancelled tutor-absence dates for the same student now surface a single period parent message in `/admin/workflows/tutor-absence`. Copying/sending remains manual; clicking "Mark period messaged" updates the per-date `Tutor_Absence_State.messageState[eventId].messaged` flags for all included lessons. Individual lesson messages remain available as fallback controls.

**Why it exists:** Long summer absences may create many dated tutor absence records for operational accuracy, but parents should not receive one repetitive message per week. This keeps the data precise while reducing communication noise and admin cognitive load.

**Source-of-truth impact:** no external truth changes. MMS remains lesson/schedule truth. `Tutor_Absence_State` remains workflow state. Grouped messages are a derived UI/action layer over per-date state, not a new source of truth.

**Files/functions involved:** `lib/admin/tutor-absence-helpers.mjs` (`buildTutorAbsenceCancellationMessageGroups`, `isTutorAbsencePaymentHandled`), `lib/admin/tutor-absence.js` (`markTutorAbsenceCancellationGroupMessaged`, `getTutorAbsenceWorkflow`), `app/api/admin/tutor-absence/route.js`, `components/admin/AdminTutorAbsencePageClient.js`, `tests/admin/tutor-absence-helpers.test.mjs`.

**What to watch:** grouping only appears after relevant absence dates are saved as `cancel_day`; if later changed to cover, check any auto-created pause Planning item and communication state manually. The grouping assumes weekly-looking repeated dates; wider gaps stay separate to avoid turning separate absences into one broad period.

### 2026-06-25 — Tutor absence cancellations feed structured pause planning

**Feature/change:** Cancelled tutor absences now auto-create idempotent structured pause `Planning_Items` for affected students. The bridge uses `buildTutorAbsencePausePlanningBundle` / `buildTutorAbsencePausePlanningItems` in `lib/admin/tutor-absence-helpers.mjs` and is called from `saveTutorAbsenceWorkflow`. Single missed lessons use the existing `Lesson date: YYYY-MM-DD` format. Repeated cancelled dates for the same student are grouped into one finance-readable away-period plan with `First lesson to pause date: YYYY-MM-DD` and `Returning from date: YYYY-MM-DD`. Students already marked `stripe_paused_expected` or explicitly marked "not needed" are skipped; students whose payment expectation was aligned in the absence workflow are created as `done`.

**Why it exists:** Tutor absence cancellation already forces payment handling, but the finance pause forecast only reads structured pause Planning records. This bridge removes duplicate manual entry while preserving the lane model: `Tutor_Absence_State` owns the absence decision, `Planning_Items` stores the structured pause, and finance remains read-only derived context.

**Source-of-truth impact:** no external truth changes. The dashboard writes workflow state only. MMS/Stripe remain external systems for lesson/payment actions; the auto-created Planning items are structured context for follow-through and forecasting.

**Files/functions involved:** `lib/admin/tutor-absence.js` (`createStructuredPausePlanningFromCancellation`), `lib/admin/tutor-absence-helpers.mjs` (`buildTutorAbsencePausePlanningBundle`, `buildTutorAbsencePausePlanningItems`, `buildTutorAbsencePausePlanningId`, `buildTutorAbsencePausePeriodPlanningId`), `tests/admin/tutor-absence-helpers.test.mjs`.

**What to watch:** if a tutor absence is first saved as cancelled and later changed to cover, any already-created pause Planning item is not auto-deleted; remove/park it manually if the cancellation is no longer real. Grouping parks superseded single-lesson plans rather than deleting them, so the audit trail remains visible.

### 2026-06-25 — Tutor absence period capture stays per-day underneath

**Feature/change:** Planning can now preview a tutor's away period by checking MMS across a date range, keeping only dates where the tutor actually has lessons, and then creating one ordinary tutor-absence Planning card per teaching date. This is for cases like "Tom is away for three clean weeks" where manually entering nine lesson days is error-prone.

**Why it exists:** the human input is naturally a period away, but the workflow, parent messaging, pause handling, and finance forecast all work best when each real teaching date has its own explicit record.

**Source-of-truth impact:** MMS remains the source for the tutor's actual lesson dates. The dashboard writes Planning workflow state only; it does not change MMS, Stripe, or payment expectation during period preview.

**Files/functions involved:** `POST /api/admin/planning/tutor-absence` (`mode: "preview_period"`), `buildDateInputRange` in `lib/admin/planning-helpers.mjs`, and the tutor-absence builder in `components/admin/AdminPlanningPageClient.js`.

**What to watch:** the preview is capped and intentionally sequential to avoid hammering MMS. If MMS calendar data is wrong, the generated date list will be wrong too; remove individual date chips before capture if needed.

### 2026-06-25 — Pause forecast ("what's coming")

**Feature/change:** `lib/admin/pause-forecast.mjs` (`parsePauseWindowsFromPlanning` + `buildPauseForecast`, pure) + a "What's coming — planned pauses" section on `/admin/finance`. Reads pause planning items, extracts each pause window, walks forward 12 weeks removing students during their window (returning them after), and runs the existing break-even/margin math per week (reuses `buildFinanceScenario`). Surfaces the trough week, weeks below break-even, and the recovery week. 5 unit tests; suite 317 pass, build clean.

**Why:** completes the forecasting trio — trend (past) · what-if (hypothetical) · **this (grounded, from real planned pauses)**. For a seasonal school it answers "how deep does summer dip, when, and when does it recover" from data already captured, not a slider guess.

**Format contract (important):** pause-window dates are parsed from the planning item *notes* written by `buildStructuredPausePlanningDraft` — `First lesson to pause date: YYYY-MM-DD` + `Returning from date: YYYY-MM-DD` (away period) and `Lesson date: YYYY-MM-DD` (single). The return date is the exclusive end (first day back). Dates are parsed at UTC midnight so half-open `[start, end)` week overlap is clean. Pause items that don't match (freehand) are surfaced as `unparsedCount`, not silently dropped. Recorded in `docs/admin/STATE_TABS_SCHEMA.md` → Format Contracts.

**Files/functions:** `pause-forecast.mjs` (new) + tests; `app/admin/finance/page.js` (loads `getPlanningItemRows`, builds forecast over active mmsIds, renders section + sparkline). Reuses `buildFinanceScenario`.

**Source-of-truth impact:** none — pure derived-context over planning items; read-only.

**Watch:** only counts pauses for currently-active students (so it's a drop from today's base); students who pause without a planning entry don't appear; single-lesson pauses are one-week blips. The forecast is only as complete as how fully pauses are logged ahead (Finn: generally ≥1 week ahead, guided, precise).

### 2026-06-25 — Capacity = money (waiting list valued)

**Feature/change:** `lib/admin/capacity-value.mjs` (`buildCapacityValue`, pure) + a "Waiting list value" panel on `/admin/waiting`. Attaches £ to the waiting list by reusing `getWaitingStudentsWithCapacity` (which already runs `buildWaitingCapacityMatches`): splits demand into **bookable now** (a free tutor slot exists), **blocked on tutor-hours** (taught but full = `no_free_slots`), and **needs a tutor** (`not_taught`), plus a ranked **recruiting-target** list by instrument. 6 unit tests; suite 312 pass, build clean.

**Why:** Finn's constraint is tutor-hours, not rooms or salaried gaps — rooms + demand exist, tutors to fill them don't. So the valuable lens is "how much waiting demand can I book now vs what needs a hire, and in which instrument." Per-tutor profitability was dropped earlier as ≈ headcount; this is the actionable growth lever.

**Freshness (the honest bit):** values only **recent** entries (≤90 days) for the headline £ so a list with stale leads isn't a vanity number; older entries are counted but flagged ("re-confirm or archive"). Each waiting student is valued as a standard 30-min 1:1 (modal lesson) — net after VAT minus an hourly tutor's pay = ~£44/mo contribution. Clearly labelled estimate.

**Live findings at launch:** dashboard sees 30 waiting (MMS `getWaitingStudents` filters to the last 120 days — so a larger "raw" list is mostly stale/excluded). 23 fresh. **Bookable now: 19 → ~£844/mo contribution** (≈ current total margin — i.e. scheduling already-matchable waiting students could roughly double margin). Top capacity target: **Singing, 8 waiting, no free slot → ~£355/mo.**

**Files/functions:** `capacity-value.mjs` (new) + tests; `app/admin/waiting/page.js` (server-rendered panel above the client). Reuses `buildWaitingCapacityMatches`, `VAT_FLAT_RATE`.

**Source-of-truth impact:** none — pure derived-context over the waiting list + free-slot calendar; read-only.

**Watch:** "bookable now" vs "recruiting target" overlap slightly (a student bookable for instrument A may want Singing as a second instrument); directional, not double-counted in the bucket totals. Value assumes a 30-min lesson; a waiting student who becomes a longer/lower-margin lesson will differ. Room-level utilisation (rooms × hours) is a future V2 needing a room data source.

### 2026-06-24 — What-if / break-even modelling + delete logged spend

**Feature/change:** Two finance additions on `/admin/finance`:
- **What-if & break-even** (`lib/admin/finance-scenario.mjs`, `buildFinanceScenario`, pure): a break-even *active-billing* student count + buffer, plus a dependency-free what-if (summer-dip preset links + a GET form for "change in active students" and "price %"). Models the lever correctly — when students pause, revenue **and** variable tutor pay both scale down (paused = no pay); salaries + overhead stay fixed; price % lifts net revenue only. 7 unit tests.
- **Delete logged spend** (`deleteExpenseLogRow` in `sheets.js` + an auth-gated `deleteExpenseLogAction` server action): an × on each `Expense_Log` entry so a mistaken add can be removed.

**Why:** per-tutor profitability was considered and dropped — with a mostly-uniform 30-min/£24-hr roster, tutor contribution ≈ hours, so it just restates headcount. The higher-leverage question on a thin margin (~9%) is fragility + levers: how many can pause before break-even, and what a price change does.

**Key clarity fix (from Finn's review):** break-even is about **active/billing** students, not the whole roster. The school has ~200 on the books but only ~134 currently billing (the rest paused). Wording now says "X actively billing needed · Y active now (Z paused, not billing) · buffer = N more can pause." Confirmed insight: a typical 20% summer pause drops below break-even for the lean months, and it **evens out over the year** — exactly the cash-planning picture this was built to surface.

**Files/functions:** `finance-scenario.mjs` (new) + tests; `app/admin/finance/page.js` (What-if section, delete control, active/billing wording); `sheets.js` (`deleteExpenseLogRow`).

**Source-of-truth impact:** none — scenario is pure derived-context over the run-rate; delete removes an `Expense_Log` (append-only actual-spend) row by `expense_id`.

**Watch:** scenario models *average* students and a *blanket* price % (V1 simplification — fine for the uniform roster; per-band price later). Break-even is computed at current prices.

### 2026-06-24 — VAT Flat Rate Scheme in the finance model

**Feature/change:** Included the school's 11% VAT Flat Rate Scheme. VAT is modelled as a **deduction from revenue** (not an expense line): listed prices are VAT-inclusive, so `vatLiability = grossRevenue × 0.11`, `netRevenue = gross − vatLiability`, and **margin is now computed on net revenue**. Cost side is unchanged (under FRS you can't reclaim input VAT, so the figures already paid stand). `VAT_FLAT_RATE = 0.11` constant in `finance-helpers.mjs`.

**Why:** the run-rate previously counted gross turnover as income, overstating margin by the full VAT liability (~£1.6k/mo). Material — the headline margin roughly halved once VAT was applied.

**Files/functions:** `finance-helpers.mjs` (`VAT_FLAT_RATE`, `buildFinanceOverview` now returns `grossRevenueMonthly`/`vatRate`/`vatLiabilityMonthly`/`netRevenueMonthly`; margin% is on net revenue), `buildFinanceSnapshotRow` (+ `vat_rate`, `vat_liability_monthly`, `net_revenue_monthly`), `sheets.js` `FINANCE_SNAPSHOT_HEADERS` (+ same 3 columns) and a new `deleteFinanceSnapshotRow`, `app/admin/finance/page.js` (gross → −VAT → net → −costs → margin breakdown).

**Day-0 snapshot re-taken:** the first `Finance_Snapshot` row predated VAT (overstated margin). Since it was day-0 (no real history lost) and the method changed materially, the stale row was deleted and a fresh VAT-correct row written — so the trend doesn't show a fake ~£1.6k "drop" at week 2. This is the documented exception to append-only: a same-day methodology correction, not rewriting genuine history.

**Source-of-truth impact:** none new — VAT is derived from the (configurable) flat-rate constant. Assumptions: prices are VAT-inclusive; all lesson revenue is taxable turnover under FRS. If FRS rate or scope changes, update `VAT_FLAT_RATE` (upgrade path: a `Finance_Settings` sheet for no-deploy edits).

**Watch:** margin % is now over net (after-VAT) revenue; `revenueMonthly` is kept as gross turnover for back-compat with `netRevenueMonthly` explicit.

### 2026-06-24 — Finance trend view (V1, dependency-free)

**Feature/change:** `lib/admin/finance-trend.mjs` (`buildFinanceTrend`, pure) + a "Trend" section on `/admin/finance` with a weekly/monthly toggle and dependency-free inline-SVG sparklines for revenue, margin, and active students, each with a week-over-week delta chip. 9 unit tests; suite now 298 pass, build clean.

**Why:** the snapshots only pay off once you can see *direction* (and, after a cycle, the seasonal summer dip). This is the rung between "snapshot" and "forecasting".

**Foundation decisions (built so it scales + serves future agents):**
- Data separated from chart: the pure helper returns a typed series; the UI is a thin replaceable layer. A future agent/tool consumes the helper output, not the DOM.
- Append-only history is never rewritten; **gaps are represented as holes, never zeros** (a zero would fake a crash). Each point carries a monotonic `periodIndex` for gap math.
- **Period keys** (`2026-W26`, `2026-06`) on every point → like-for-like and future year-over-year comparison with no rework.
- Dedupe per period (keeps latest snapshot if the cron double-fires); deltas + min/max/latest computed in the helper so every consumer gets the same numbers.
- **Provenance carried forward** (`source` estimate/mixed) so the estimate→actuals transition (slice B) shows honestly. Data only — no interpretation baked in (keeps it agent-reusable).

**UI:** server-component section; period toggle via `?trend=weekly|monthly` query param (no client JS). Sparkline is a pure inline `<svg><polyline>`. With <2 points it shows an honest "collecting data" note (currently 1 real snapshot).

**Deliberately deferred (slot onto this foundation later):** a charting library, a read-only `/api/admin/finance/trend` agent endpoint, forecasting/scenarios, year-over-year seasonal comparison.

**Files:** `lib/admin/finance-trend.mjs` (new), `tests/admin/finance-trend.test.mjs` (new), `app/admin/finance/page.js` (Trend section + Sparkline/TrendMetric/DeltaChip components, `searchParams`).

### 2026-06-24 — Finance estimate-coverage / data-health panel

**Feature/change:** `lib/admin/finance-coverage.mjs` (`buildFinanceCoverage`, pure) + an "Estimate coverage" section on `/admin/finance`. Surfaces the input gaps that silently distort revenue/cost/margin/snapshots: per active student it flags `noRevenuePrice`, `noDuration`, `noSchedule`, `lowConfidence`, `noTutor`; plus a tutor-level list of tutors absent from `Tutor_Pay`. Headline = priced active ÷ active. Read-only. 7 unit tests; total suite 289 pass, build clean.

**Why:** every figure inherits its inputs; the weekly snapshot series is only as trustworthy as coverage. We'd already hit real gaps (orchestra, Finn alias, Hayleigh/Kenny), so a standing surface catches the next ones.

**Design refinement from live data:** first run flagged 81 students for "tutor not in pay table" — a false-positive flood, because the 12 hourly tutors *correctly* default to £24 and only the 3 salaried + Finn alias are listed. Reclassified tutor-not-in-pay-table from a per-student gap flag to a tutor-level *informational* list ("confirm none should be salaried / on a different rate"). Result: the per-student gap list now shows only genuine issues.

**Live findings at launch:** revenue coverage 100% (134/134 active priced — orchestra/group fixes held); 3 `noSchedule` students (Anji, Kenny, Nathan — all Finn's, fortnightly/no-slot); 12 hourly tutors on the default rate (expected).

**Files:** `lib/admin/finance-coverage.mjs` (new), `tests/admin/finance-coverage.test.mjs` (new), `app/admin/finance/page.js` (section), `lib/admin/cost-helpers.mjs` (exported `resolveTutor` for reuse).

**Watch:** `noSchedule` is low-severity (estimate falls back to the sheet lessonLength). Coverage is over active students only. The tutor list is a confirm-prompt, not an error.

### 2026-06-24 — Finance layer audit (post-Codex batch)

**What:** Reviewed the finance layer after Codex's follow-up (Expense_Log, cash-view margin, pause-expectation auto-sync) shipped and deployed (`b6897af`). 282 tests pass, build clean.

**Verified correct:**
- Tutor cost: per-slot dedup now also collapses by `billingGroupId` (covers Hayleigh/Kenny, who share a billing group but have no shared MMS schedule slot), takes the max cadence weight on duplicate slots, excludes salaried tutors, +£2 once per 45-min group, paused excluded, fortnightly = 0.5 on both revenue and cost, unknown durations flagged not priced.
- `FINANCE_SNAPSHOT_HEADERS` matches `buildFinanceSnapshotRow` keys (incl. new cash-view fields); both the cron and `/admin/finance` feed `expenseLogRows` into `buildFinanceOverview`.
- Expense-log add-spend server action is independently auth-gated (`session.user.isAdmin`) + validated + records `created_by`; defence-in-depth beyond middleware.
- No secrets in git (salaries live only in `Tutor_Pay` sheet/Railway); removed a leftover empty `app/api/debug-finance/` dir (untracked, not built, not deployed); no tracked debug/seed routes.

**Findings / minor risks (none blocking):**
1. **Write-on-read:** `autoSyncPauseExpectations` (in issue-building) writes `payment_expectation` to the Students sheet during a dashboard view. Bounded to real transitions (usually a no-op), audited to Event_Log, not a Stripe column → within the dashboard's workflow-state remit and consistent with the bounded auto-record decision. Watch: possible duplicate write/log under concurrent loads; consider an explicit trigger/cron if write volume grows.
2. **Cash-view margin** = full-month recurring cost + month-to-date actual spend → directional ("month-end context"), not a true closed-month margin. Labelled as such.
3. The seeded **"General £120" Expenses row is now inert** — `parseExpenses` skips name/category "general" (miscellaneous now lives in Expense_Log). Recommend deleting that row from the Expenses sheet to avoid confusion.
4. Expense amount parsing strips sign/non-numeric (negatives become positive; non-numeric dropped by the `amount > 0` filter). Acceptable; could add form validation.
5. Standing estimate caveats unchanged: scheduled (not attendance) hours; hardcoded price table; revenue still estimate, not Stripe actuals.

### 2026-06-24 — Expense Log For Actual Bank/Card Spend

**Feature/change:** Added a lightweight actual-spend capture to `/admin/finance`. New append-only `Expense_Log` tab stores dated spend rows such as paint, repairs, reupholstery, coffees/lunches, marketing, and one-off room improvements. The finance page shows current-month spend totals, category totals, and latest entries. The previous recurring `General` overhead buffer is ignored if it still exists in `Expenses`.

**Why it exists:** The run-rate model answers "what should a normal month look like under current conditions?" It does not explain the real bank account at month-end. `Expense_Log` gives Finn/Tom a quick memory of variable and one-off spend so the bank account can be checked without turning the dashboard into full accounting software.

**Source-of-truth impact:** `Expenses` remains recurring overhead assumptions and feeds estimated margin. `Expense_Log` is append-only actual spend memory for miscellaneous/one-off spend and replaces the old recurring `General` buffer. The bank account/accounting records remain the financial truth; the dashboard log is context for review. Weekly/monthly `Finance_Snapshot` rows include month-to-date actual spend and a separate cash-view margin, while the main run-rate margin stays separate.

**Files/functions involved:** `app/admin/finance/page.js` (`Add actual spend` form and current-month summary), `lib/admin/sheets.js` (`Expense_Log` headers, reader, append writer), `lib/admin/cost-helpers.mjs` (`normaliseExpenseLogRow`, `buildExpenseLogSummary`), `tests/admin/cost-helpers.test.mjs`, `docs/admin/STATE_TABS_SCHEMA.md`, `docs/admin/CURRENT_STATUS.md`.

**What to watch out for:** Keep recurring assumptions and actual spend separate. Do not use it as accounting, VAT, payroll, or reimbursement approval. At month-end, compare the log against the bank account and add missing rows; if reconciliation becomes painful, add a review marker later rather than overbuilding now. Do not re-add a recurring `General` buffer without intentionally deciding how to avoid double-counting miscellaneous spend.

### 2026-06-24 — Pause Expectation From Covered Lesson Dates

**Feature/change:** Pause expectation sync now derives a shared decision from Pause History + usual lesson coverage. `derivePauseCoverageContext()` exposes the covered lesson dates and the next usual billable lesson; `derivePauseExpectationDecision()` decides whether to auto-sync, show an issue, or allow a short bridge where Stripe is active before the next billable lesson.

**Why it exists:** Some pause flags were not real operational problems; they were disconnects between the pause tool window, the dashboard expectation field, and when the next lesson actually becomes billable. The dashboard should close obvious high-confidence pause loops automatically and only surface uncertainty.

**Source-of-truth impact:** `Pause History` remains the source of intentional pause windows. `Schedule_Context` supplies usual lesson timing. The Students sheet still owns `payment_expectation`; the dashboard writes it only through the existing auto-sync path and logs to `Event_Log`. Stripe remains actual billing state and is not mutated here.

**Files/functions involved:** `derivePauseCoverageContext()` in `lib/admin/pause-helpers.mjs`, `derivePauseExpectationDecision()` and `buildPauseExpectationAutoSyncPlan()` in `lib/admin/pause-auto-sync-helpers.mjs`, `buildPauseIssues()` / `scanLiveStripeIssues()` in `lib/admin/issues.js`, and `buildLiveStripeIssues()` in `lib/admin/stripe-snapshot-helpers.mjs`.

**What to watch out for:** Auto-sync remains high-confidence only: Stripe payer, subscription-ID Pause History match, and a pause window that covers at least one usual lesson. Missing schedule, low-confidence identity, invalid dates, or pause windows that miss the usual lesson stay human-review territory. Stripe can appear active during the bridge before the next billable lesson without creating a mismatch flag.

### 2026-06-24 — Financial layer slice C: cost/margin model + weekly/monthly snapshots

**Feature/change:** Extended the finance layer from revenue-only to full margin, and added a logged time series — deliberately sequenced *ahead* of Stripe actuals (slice B) because (a) the seasonal series is time-sensitive (summer started today) and (b) margin is higher-value than validating one number.
- `lib/admin/cost-helpers.mjs`: variable tutor pay modelled from the *scheduled active roster*. £24/hr (30=£12, 45=£18, 60=£24), **+£2 once per 45-min group slot**. Pay is **per teaching slot, not per student** — shared group/orchestra lessons collapse to one slot (explicit `billingGroupId` first, then MMS shared-slot names as fallback) so a 6-person orchestra is paid once, not 6×. **Paused students = no pay.** Salaried tutors add **no** variable cost; their salary is a fixed monthly line.
- `lib/admin/finance-helpers.mjs`: `buildFinanceOverview(students, { tutorPay, expenseRows, stripeAmounts })` composes revenue − variable − salaries − fixed = monthly margin; `buildFinanceSnapshotRow` flattens it for the log.
- `Finance_Snapshot` append-only tab + `/api/cron/finance-snapshot` (secret-authed, mirrors `refresh-schedules`) + `.github/workflows/finance-snapshot.yml` (weekly Mondays + monthly 1st). First row captured 2026-06-24.

**Source of truth (important):** the finance numbers are assembled from several lanes, **not** the registry alone — registry (tutor assignment, instrument fallback), Students sheet (duration, payment mode), `Schedule_Context` cache, a hardcoded price table, and now two new manually-curated config tabs: **`Tutor_Pay`** (pay_model/hourly_rate/monthly_salary) and **`Expenses`** (name/amount/period/category). New canonical pay/cost data lives in those sheets, editable without a deploy.

**Security:** the `/finance` page now shows salaries and margin, so it must stay behind admin auth. It was moved out of `/admin` to a deliberately low-profile `/finance` URL (no nav link, removed from the Planning aside) — and `/finance` was added to the `middleware.js` auth matcher so the move did **not** make it public. **Salaries are never committed to git** — they were seeded straight into the `Tutor_Pay` sheet (via a throwaway route, values passed in the request body, never in code).

**Tutor-name canonicalisation gotcha:** two of Finn's students (Hayleigh, Kenny) have no registry entry, so `resolveTutor` falls back to the Students-sheet value "Finn Le Marinel", which did not match the canonical `Finn` salary row → they were initially treated as hourly. Fixed durably with a `Tutor_Pay` **alias row** ("Finn Le Marinel", salary £0, real salary stays on `Finn`) rather than fuzzy name-matching in code. ("Chloe Mak" vs "Chloe" exists too but is cost-neutral since both are hourly.) Lesson: tutor identity is not fully canonical across sheet vs registry; the pay table absorbs variants explicitly.

**Indicative numbers at launch (estimate):** captured in the first private `Finance_Snapshot` row. Do **not** put exact payroll/margin figures in git; use the `/finance` page or Finance tabs for current private values.

**What to watch:** still an estimate (schedule × price table), not Stripe/accounting. Variable cost is from *scheduled* slots, not attendance. The snapshot cron needs `FINANCE_SNAPSHOT_SECRET` set in Railway env **and** as a GitHub Actions repo secret. New unregistered students of a salaried tutor will surface under a sheet-name variant — add an alias row if it's a salaried tutor. Exact private salary/margin values should stay in the Finance tabs and `/finance`, not in git fixtures or docs.

### 2026-06-23 — Financial layer slice A: read-only revenue run-rate (estimate, B-ready seam)

**Feature/change:** First financial surface — a read-only recurring-revenue run-rate at `/admin/finance`, linked from the Planning → Planning context aside (the documented home for future finance/capacity layers, not top nav while it's still an estimate). New pure helper `lib/admin/finance-helpers.mjs`: `buildRevenueRunRate(students, { stripeAmounts })` aggregates active-only weekly/monthly/annual, reports paused separately as "not billing", and breaks down by lesson kind (1:1/group/orchestra) and payment mode (stripe/manual). The page reuses `derivePaymentValueContext` via the resolver.

**Why it exists:** Foundation for projecting/modelling. Built A (estimate) first to settle revenue *definitions* (active-only, paused excluded, period, manual payers) on cheap data before touching the vendor layer.

**A→B seam:** `resolveStudentRevenue(student, { stripeAmounts })` is the single source-of-revenue resolver. Today it returns `source: 'estimate'`; when cached Stripe actuals exist, pass `stripeAmounts[mmsId] = { weekly, ... }` and it flips to `source: 'stripe_actual'` — aggregation and UI unchanged. `isEstimateOnly` drives the prominent "estimate, not Stripe actuals" banner.

**Source-of-truth impact:** None for revenue itself (read-only, no writes, no Stripe calls). One canonical data fix landed alongside (below).

**Two detection issues found while validating against ground truth:**
1. The bulk `getAdminStudents()` list does **not** attach `scheduleContext` (only the single-student fetch does), so group detection via shared-slot count was blind (groups 4→14 once attached) and several students came back unpriced ("Uke"/"group" in the lesson-length field). Fix: the finance page attaches `scheduleContext` itself via `getScheduleContextRows()` + `enrichScheduleContextsWithSharedSlots` (cached read, read-only) before aggregating. Did **not** add it to the shared `getAdminStudents` to avoid an extra sheet read on a hot path (read-quota concern).
2. Ukulele Orchestra members had a **blank instrument** (only the lesson-length field said "uke"), so they priced as group/one-to-one instead of £42.50/mo orchestra. Fixed **upstream in the canonical registry** (added `instrument: 'Ukulele Orchestra'` to Alister McGhee, Carolyn Hilliard, Katrina Caldwell, Thomas Ward, and Anji Goddard — matching Claire McGinness's existing entry), then `npm run generate-configs`. Orchestra now detects 6; Katrina and Anji are manual/cash payers. Note: Anji had **no found MMS schedule slot** (`scheduleStatus: not_found`), so shared-slot inference could never catch her and she was mispriced as £25/wk one-to-one — the registry `instrument` fallback is the only thing that classifies her correctly. This is the general lesson: shared-slot detection is best-effort and silently fails for students without a current MMS slot; canonical instrument data is the durable fix.

**Files/functions involved:** `lib/admin/finance-helpers.mjs` (new), `app/admin/finance/page.js` (new), `components/admin/AdminPlanningPageClient.js` (Planning-context link), `lib/config/students-registry.js` (4 instrument fields), `tests/admin/finance-helpers.test.mjs` (11 new tests). Reuses `derivePaymentValueContext`, `getScheduleContextRows`, `enrichScheduleContextsWithSharedSlots`.

**What to watch out for:** The headline figure is an *estimate* (schedule × price table), including for manual payers — the banner must stay prominent until slice B. Slice B = read each student's recurring Stripe amount, cache it like `Schedule_Context`, feed `stripeAmounts`. Annual = weekly × 52 (ignores holidays/pauses) — indicative only. The registry's `instrument` is a fallback used only when the MMS-synced sheet instrument is blank; if MMS later populates these instruments, the registry value is harmless.

### 2026-06-23 — Read-quota resilience (cache issue reads + wrap remaining raw reads)

**Feature/change:** The Sheets read-quota limit ("Read requests per minute per user") actually fired in dev, hard-crashing the overview at `getIssueQueueRows`. Two read paths were bypassing the `withSheetsRetry` wrapper and the read cache: `getIssueQueueRows`' own `values.get`, and `ensureManagedSheet`'s header `values.get`. Fixes: wrap both in `withSheetsRetry` (so a 429/5xx backs off and self-heals instead of crashing), and route the issue-queue read through the existing 60s read cache (so the overview + flags page don't each re-fetch it).

**Why it exists:** the overview now reads issues on every load (active-issue count) on top of all the other tabs, which pushed per-minute reads over the limit. Retry stops the hard-fail; caching cuts the read volume that caused it. This is the documented "quota recurs" trigger firing — the parked `batchGet` lever remains the deeper structural answer if it returns.

**Source-of-truth impact:** None. Caching is safe because every issue write goes through `upsertManagedSheetRow` / `upsertIssueQueueRows`, both of which invalidate this sheet's read cache — so a resolve/update is reflected immediately.

**Files/functions involved:** `lib/admin/sheets.js` (`getIssueQueueRows`, `ensureManagedSheet`).

**What to watch out for:** if quota errors recur despite this, the cause is genuine read volume → do the `batchGet` consolidation (collapse the overview's ~8 tab reads into one call), not more retry. Don't cache reads whose writers don't invalidate the cache.

### 2026-06-23 — School Notes Inside Planning

**Feature/change:** Planning now has first-class `Learning note` and `Strategic note` item types, plus a `Work on the school notes` capture block. Notes can hold open transcript summaries, learning notes, key ideas, possible First Chord applications, and an optional next action. A note with a next action can create a linked `Action` card while preserving the original thinking.

**Why it exists:** some work-on-the-school conversations are not tasks yet. They still need to be logged so Finn/Tom can resume learning, strategic threads, and transcript summaries later without forcing everything into project-management language.

**Source-of-truth impact:** No new state tab. Uses existing dashboard-owned `Planning_Items` and `Planning_Progress_Log`. These notes are workflow/planning memory, not external truth and not finance forecasts.

**Files/functions involved:** `components/admin/AdminPlanningPageClient.js`, `lib/admin/planning-helpers.mjs`, `app/admin/planning/page.js`, `app/admin/page.js`, `tests/admin/planning-helpers.test.mjs`.

**What to watch out for:** keep the body open enough for real conversation summaries. Do not turn this into a full knowledge-management system or finance layer. Executable work should become linked actions so the note remains context and the task can close.

### 2026-06-23 — Overview Cards Must Earn Their Place

**Feature/change:** The `/admin` overview was tightened from a broad status board into a calmer meeting-start surface. Front-page cards now prioritise actionable work: today's tasks, issue decisions, tutor absences, waiting-list placement, payment setup pending, and prompts for working on the school. Passive queues and context were removed or pushed lower.

**Why it exists:** big numbers and useful-but-passive panels create cognitive load. The overview should help Finn/Tom enter a meeting, clear the work that needs doing, then protect energy for meaningful school improvement.

**Source-of-truth impact:** None. This was a presentation and prioritisation change only.

**Files/functions involved:** `app/admin/page.js`, `docs/admin/COPY_AND_TONE.md`, `docs/admin/CURRENT_STATUS.md`, `docs/admin/WORKFLOW_DESIGN_PRINCIPLES.md`.

**What to watch out for:** do not add a front-page panel just because a metric exists. Ask whether the card creates a meaningful click/action during a meeting. Health/context can still exist, but should move up only when something needs attention.

### 2026-06-21 — Retry transient Google Sheets errors (stop spurious job-failure alerts)

**Feature/change:** Both the dashboard and the brain now retry transient Google Sheets API errors (429/500/502/503/504) with exponential backoff instead of hard-failing on the first blip.
- Dashboard: `withSheetsRetry()` in `lib/admin/sheets.js` wraps the read (`values.get` in `getSheetValues`) and the managed-row writes (`append`/`update` in `upsertManagedSheetRow`) — 4 attempts, 600ms base, doubling.
- Brain: `gspread_retry()` in `first-chord-brain/generate_fc_ids.py` wraps the gspread reads (`open_by_key`, `worksheet`, `get_all_values`) and writes (`worksheets`, `add_worksheet`, `clear`, `update`, `update_title`) — 4 attempts, 1.5s base.

**Why it exists:** the hourly "Regenerate FC IDs" job was occasionally failing with `gspread APIError [503]: service unavailable` — a momentary Google outage, not our bug — and emailing a job-failure alert each time. The dashboard's schedule-refresh cron has the same exposure on its initial reads. Retrying transient errors makes a brief wobble self-heal silently.

**Why not batching:** investigated — these failures are transient Google outages (503), not call-volume/quota. The dashboard refresh already tolerates per-student quota errors (collected, not fatal). `batchGet` would ease quota pressure but would not have prevented these; retry is the correct fix. (batchGet remains a future scaling lever.)

**Source-of-truth impact:** None. Same reads/writes, just resilient to transient failures.

**Files/functions involved:** `lib/admin/sheets.js` (`withSheetsRetry`), `first-chord-brain/generate_fc_ids.py` (`gspread_retry`).

**What to watch out for:** only *transient* statuses are retried — a real error (auth, bad range, 400) still fails fast. If a genuine outage lasts longer than ~4 backoff steps the job still fails (correctly). Brain read path validated live (234 rows); dashboard tests + build pass.

### 2026-06-21 — Overview Snappiness (cached + streamed health)

**Feature/change:** The Overview page no longer blocks on its slowest data. `getAdminHealthSummary` (which makes 3 uncached external calls — MMS + 2 GitHub Actions APIs) is now (1) **cached** with a 60s TTL, and (2) **streamed**: health was removed from the page's blocking `Promise.all`, and the two health-derived pieces — the "Trust" strip and the "System checks" panel — render inside their own `<Suspense>` boundaries with small fallbacks. The rest of the Overview (needs-attention, next-work, lifecycle, payment) renders immediately; health fills in a beat later (instant on repeat visits within the cache window).

**Why it exists:** `await Promise.all([...6...])` meant the whole Overview waited on the slowest fetch (health's external round-trips). Caching removes the cost on repeat visits; streaming removes it on the first/cold visit too. Documented Best-Next-Slice #1.

**Source-of-truth impact:** None. Health is status info; the 60s cache only affects how long a health read is reused. No data shape change.

**Files/functions involved:** `lib/admin/health.js` (`getAdminHealthSummary` cache wrapper + `computeAdminHealthSummary`), `app/admin/page.js` (`OverviewTrustStrip` + `OverviewSystemChecks` streamed async components; `buildPrioritySentence` no longer takes systemHealth — health surfaces in its own streamed section).

**What to watch out for:** the system-health signal no longer feeds the instant "priority sentence"/attention cards (it lives in the streamed Trust strip / System checks now) — a deliberate trade so the page doesn't block on health. Streaming requires the route to be dynamically rendered (it is, via live data). If health is ever needed in the blocking top-line again, it'd re-introduce the wait.

### 2026-06-21 — Navigation Snappiness (loading skeletons + longer sheet TTL)

**Feature/change:** Two changes to make moving between admin pages feel faster.
- **`app/admin/loading.js`** — a single shared skeleton at the admin segment shows instantly (via the Suspense boundary) while any `/admin` page fetches its server data. The layout's nav/header stays put; only the `<main>` content area swaps to the skeleton. Covers every admin route, no per-page files needed. Pure perceived-speed win, zero data risk.
- **Sheets read cache TTL 15s → 60s** (`SHEETS_READ_TTL_MS` in `lib/admin/sheets.js`). Repeat navigations within the window reuse cached sheet reads instead of re-fetching every tab. Safe because dashboard writes already call `invalidateSheetReadCache` for the affected tab, so the admin's own edits still appear immediately — only passive cross-source drift can lag up to 60s.

**Why it exists:** admin pages are server components that fetch Sheets/MMS on each navigation with no loading state, so the previous page sat frozen until data resolved. Skeletons fix the *felt* speed; the longer TTL fixes *actual* speed on repeat moves. This is documented Best Next Slice #1 (V4.1 performance hardening).

**Source-of-truth impact:** None. No data shape change; the TTL only affects how long a read is reused.

**Files/functions involved:** `app/admin/loading.js` (new), `lib/admin/sheets.js` (`SHEETS_READ_TTL_MS`).

**What to watch out for:** the skeleton is generic (it covers all pages), so it won't match any single page's exact layout — that's fine for a brief flash. If a specific page ever needs a tailored skeleton, add a `loading.js` in that route folder to override. The 60s TTL is a freshness/speed trade — if a page ever needs near-real-time passive data, give it an explicit refresh rather than shortening the global TTL. Also fixed alongside: the pause-complete button no longer flickers between its sequential save steps (`postPlanning` gained a `silent` option).

### 2026-06-21 — Waiting-List Day/Time Availability Matching

**Feature/change:** The deferred day/time sub-slice is now live. The MMS sign-up form gained two checkbox questions — **Preferred days** (Monday–Saturday, no Sunday) and **Preferred times** (Earlier before 5pm / Evenings after 5pm). `parseNoteFields` extracts the `preferred days` / `preferred times` lines; `parseAvailabilityDays` / `parseAvailabilityTimes` (in `capacity-helpers.mjs`) normalise them onto each waiting student (`availabilityDays`, `availabilityTimes`). `buildWaitingCapacityMatches` now **ranks** matching slots by an availability **score** (day weighted higher than time: full fit = 3, day-only = 2, time-only = 1, neither = 0) — days, tutors, and slots all order by score. `/admin/waiting` shows "Prefers: …", rings preferred days, and badges tutors that fit. **Ranked, not filtered** — non-matching options stay visible.

**Why it exists:** previously matching ignored when families could actually attend. Capturing day (per-weekday, precise) and time (coarse buckets, how families think) lets the placement hints reflect real availability. Score-based ranking (vs day-first) means when nothing fully fits, a time-matching slot still surfaces above a total miss instead of being buried.

**Source-of-truth impact:** None. Availability is parsed from the MMS note (MMS stays the sign-up truth); pure derivation, no new state.

**Format contract:** the matcher is tolerant (weekday names; "even" → evening; "earl/before 5/morning/afternoon/after school" → earlier), but the MMS question labels must keep containing "day"/"time" and the day options must be full weekday names. Verified against a real test sign-up note: `Preferred days: Tuesday, Thursday, Friday` / `Preferred times: Earlier (before 5pm)` parsed correctly.

**Files/functions involved:** `lib/admin/mms-helpers.mjs` (`parseNoteFields`), `lib/admin/capacity-helpers.mjs` (`parseAvailabilityDays/Times`, `slotTimeBucket`, scored `groupMatchesByDay`, `buildWaitingCapacityMatches`), `lib/admin/mms.js` (`normaliseWaitingStudent`), `components/admin/AdminWaitingPageClient.js`.

**What to watch out for:** existing waiting students (signed up before the questions existed) have no availability lines → they match as before, no "Prefers" line. Don't reword the MMS option labels without checking the parser. Matches remain suggestions — no auto-assign.

### 2026-06-21 — Monday Scheduling Panel: shape-before-schedule

**Feature/change:** The Monday scheduling panel on `/admin/planning` no longer one-taps the raw reflection line onto the board. Each "next improvement" is now **click-to-expand** (`MondayIntentionRow`): a small editor pre-filled with the line — editable **Title**, optional **Description**, **Owner** (Finn/Tom/Unassigned), and **Do by** (defaults to this Friday) — then **Add to board** creates a shaped, owned, dated planning card. The row then shows "Scheduled ✓ · do by <date>".

**Why it exists:** the old behaviour created cards with the long raw sentence as both title and note, owner Unassigned — clunky, and you had to go edit each one. Shaping happens up front now.

**Source-of-truth impact:** None. Still ordinary `Planning_Items` linked to the reflection via `parentPlanningId`; the row form just supplies a better title/notes/owner/do-by.

**Files/functions involved:** `components/admin/AdminPlanningPageClient.js` — new `MondayIntentionRow`, `handleScheduleIntention(intention, { title, notes, owner, targetDate })`, `alreadyScheduledByTitle` (Map title→do-by).

**What to watch out for:** there is no per-card detail route, so the confirmation is a "Scheduled ✓ · do by" badge, not a link. Scheduled-state is keyed by the original intention line (flips even if the title is edited); cross-reload detection still matches by card title, so an edited-title line could reappear as schedulable until the Monday card is marked done (which hides the panel). Low harm; store the original line on the card if bulletproofing is ever needed.

### 2026-06-21 — Waiting-List Capacity Matching Refinement

**Feature/change:** Sharpened `buildWaitingCapacityMatches` (`lib/admin/capacity-helpers.mjs`) and the `/admin/waiting` "Possible slots" UI:
- **Multi-instrument awareness:** per student we now compute `coveredInstruments` / `uncoveredInstruments` (each uncovered tagged `not_taught` vs `no_free_slots`), so a "guitar + piano" enquiry clearly shows which half has slots.
- **Ranking:** within a day, tutors are sorted by how many requested instruments they cover (`coverageCount`) then earliest slot — best fit leads, instead of plain weekday/time order.
- **Synonym matching (both sides):** tutor instruments now run through `normaliseInstrument` (not just lowercase), matching the waiting side. A tutor recorded as `vocals`/`keyboard` now matches `singing`/`piano` instead of silently missing.
- **Better "why":** `capacityMatchReason` distinguishes "no tutor teaches X" from "taught but no free slot right now," for both partial-match and no-match cases.

**Why it exists:** matching was instrument-exact, unranked, and gave a dead-end "no match" with no reason. These are hints for placement, made more useful — still suggestions, not decisions.

**Source-of-truth impact:** None. Pure derivation over MMS Free slots + waiting students + tutor data. No new state, no writes.

**Deferred — day/time preference matching (#3):** intentionally NOT built. The MMS sign-up note parser (`parseNoteFields`) extracts instrument/age/experience/genre/songs but **no availability**, so there's nothing reliable to filter slots by. Plan: improve the onboarding/sign-up form to capture day/time availability first, then parse it and filter `buildWaitingCapacityMatches` by it. See `docs/admin/CURRENT_STATUS.md` Best Next Slices.

**Files/functions involved:** `lib/admin/capacity-helpers.mjs` (`buildWaitingCapacityMatches`, `groupMatchesByDay`, `buildTutorLookup`, new `instrumentKey`), `components/admin/AdminWaitingPageClient.js`.

**What to watch out for:** synonyms covered are exactly what `normaliseInstrument` handles (piano/keyboard, ukulele/uke, singing/voice/vocal, bass, guitar, ukulele orchestra) — extend that one function if a new term appears, rather than special-casing here. Keep matches as hints; do not auto-assign tutors or reserve slots.

### 2026-06-21 — Communication Log (record-only, no workflow change)

**Feature/change:** A passive record of parent messages. The existing "Copy message" buttons (pause card; parent-understanding templates) now *also* fire-and-forget a write to a new append-only `Communication_Log` tab — same button, same click, no new steps, no approval, nothing sent. A read-only `/admin/communications` ("Messages Sent") page lists what's been recorded (newest first, linked to the student). `logCommunication()` de-duplicates a repeated copy of the same message to the same student within a 10-minute window.

**Why it exists:** The dashboard generated good parent copy but kept no record of it — "did we message this parent, and when?" was unanswerable. Deliberately scoped *down* from the full draft→approve→send gate after discussion: no learning/training, and "approve" adds no value while sending is manual. This is the lean honest version — a logbook — and the trail a future WhatsApp-send feature would build on.

**Key design choice:** the hook is the **copy action**, so "copied to send" is the proxy for "sent" and the workflow is genuinely unchanged. Logging is fire-and-forget and errors are swallowed — copying must never break.

**Source-of-truth impact:** None. Append-only dashboard-owned log; student/contact facts still come from Sheets/MMS/registry. No `Event_Log` lifecycle rows — this tab *is* the record.

**Files/functions involved:**

- `lib/admin/sheets.js` — `Communication_Log` tab, `getCommunicationLogRows`, `appendCommunicationLogRow`
- `lib/admin/communications-helpers.mjs` — `normaliseCommunicationLogEntry`, `communicationFingerprint`, `isDuplicateCommunication`, `groupCommunicationLog`
- `lib/admin/communications.js` — `logCommunication` (dedup), `getCommunicationLog`
- `app/api/admin/communications/route.js`, `app/admin/communications/page.js` + client
- Copy hooks in `AdminPlanningPageClient.js` (pause) and `AdminParentUnderstandingPageClient.js` (parent)

**What to watch out for:** "Copied" ≠ guaranteed "sent" — it's a pragmatic proxy chosen to keep the workflow untouched. If a stronger signal is ever needed, hook "Mark pause completed" instead. Do not add sending here without re-opening the draft→approve→send design.

**Fast-follows (2026-06-21, same slice):** (1) the copy-logging is now extracted to a shared `lib/admin/log-communication-copy.js` and applied to the **waiting** welcome message (`category: waiting`) and **tutor-absence** parent message (`category: tutor_absence`, threaded student context through `MessageButton`), in addition to pause + parent-understanding. Broadcast templates (showcase/holiday) are intentionally *not* logged — they aren't per-parent. (2) Student detail pages now show a **"Messages logged"** panel (`getCommunicationLogForStudent`), mirroring the "Recent practice notes" panel, so the record is visible where you'd look for it.

### 2026-06-20 — Scheduled (bi-weekly) Schedule-Cache Refresh

**Feature/change:** A GitHub Action cron (dashboard repo, `refresh-schedules.yml`, 1st + 15th monthly) calls a new secret-protected endpoint `POST /api/cron/refresh-schedules` on the live Railway app. The endpoint computes its own target set server-side via `buildScheduledRefreshTargets()` — operational students whose cache is missing, **older than the cadence (10 days)**, or unresolved — then refreshes a bounded batch (80/run, sequential) and returns `remaining`; the workflow loops (up to 8 batches) until the cohort is current. Auth is a shared secret (`SCHEDULE_REFRESH_SECRET`) checked with a timing-safe compare, mirroring the Practice Chat secret pattern, since there's no admin session on a cron call.

**Why it exists:** The manual `/admin/capacity` refresh (same-day slice) makes stale caches fixable but still relies on someone noticing. A rare scheduled snapshot keeps the whole cohort under ~2 weeks behind so the manual panel becomes an exception-handler. This is the "scheduled snapshot" option the V3 vendor-truth loop explicitly allows, and stays within "keep cohort-wide API calls rare."

**Key design note:** the cron refreshes by **cadence (>10 days)**, deliberately *not* the 21-day display-stale threshold used by `buildScheduleHealthList`. A bi-weekly job gated on ">21 days" would often find nothing; gating on ">10 days" keeps everything fresh between runs.

**Source-of-truth impact:** None new. Writes the existing `Schedule_Context` cache; MMS stays lesson truth. Scheduled + bounded, not per-page polling.

**Files/functions involved:**

- `lib/admin/capacity-helpers.mjs` — `buildScheduledRefreshTargets()`
- `app/api/cron/refresh-schedules/route.js` — secret-auth, batched endpoint
- `.github/workflows/refresh-schedules.yml` — bi-weekly cron that loops until `remaining = 0`

**Setup required (one-time):** add `SCHEDULE_REFRESH_SECRET` to **both** Railway env vars and the dashboard repo's GitHub Actions secrets (same value). Until set, the endpoint returns 503 and the workflow fails fast.

**What to watch out for:** This is the only cohort-wide automatic MMS read in the dashboard — keep it rare (bi-weekly), bounded (80/batch, 8 batches), and sequential. Don't lower the cron interval without revisiting batch sizes.

### 2026-06-20 — Schedule-Context Hardening (visible + fixable stale caches)

**Feature/change:** `/admin/capacity` now lists the specific students whose cached schedule needs attention and lets you refresh them. New `buildScheduleHealthList()` returns per-student rows tagged with a reason: `no schedule`, `past lesson` (a `found` row whose `nextLessonAt` is already in the past — the cache is behind MMS), `stale` (checked >21d ago), `low confidence`, `missing teacher`, `missing duration`. A new client `ScheduleHealthPanel` shows the list with per-row **Refresh** + **Refresh all stale**, calling a new `POST /api/admin/schedule/refresh-stale` route. The route refreshes only the requested IDs, sequentially, capped at 60/run with a small delay, and is strictly admin-triggered (no auto-polling). After a refresh the client calls `router.refresh()` so healed rows drop off.

**Why it exists:** The Lloyd incident — a `found`, high-confidence cache row pointing at a month-old `nextLessonAt`. The aggregate health counts on `/admin/capacity` couldn't show *which* students were affected and there was no bulk refresh; the "past lesson" staleness signal didn't exist at all. The pause-date suggestions read `Schedule_Context`, so a behind-MMS cache silently produced suspect dates.

**Source-of-truth impact:** None new. Refresh writes the existing `Schedule_Context` cache via `upsertScheduleContextRow`; MMS stays the lesson truth. Explicit refresh only, matching the vendor-truth guardrail (no polling on page load).

**Files/functions involved:**

- `lib/admin/capacity-helpers.mjs` — `buildScheduleHealthList()` (adds the missing "past lesson" signal)
- `app/api/admin/schedule/refresh-stale/route.js` — bounded bulk refresh
- `components/admin/ScheduleHealthPanel.js` + `app/admin/capacity/page.js` — the actionable list

**What to watch out for:** Bulk refresh is N MMS calendar searches — keep it explicit, capped, and sequential; never auto-trigger it. Note a pre-existing quirk: `buildScheduleCacheSummary` counts `status === 'missing'`, but `deriveScheduleContextFromMms` actually emits `not_found` / `missing_identity`; the new health list treats any non-`found`, non-`error` status as "no schedule" so it doesn't under-report.

### 2026-06-19 — Calm "Due Today" Planning View

**Feature/change:** The `/admin/planning?filter=due_now` view (the "on the day" surface, linked from the overview's Due Now count) now renders calm, focused cards instead of the full status-grouped board. New `DueTodayCard` shows a plain-language headline (`getPlanningStory`), a "what to do" line (`getPlanningWhatToDo`), and a minimal due chip (`dueChipLabel`: "Today" / "Overdue N days") + owner — sorted overdue-first, no status groups. Primary action is **Mark done** (or, for pauses, the steps shown inline); plus **Defer until next meeting** (`handleDefer` → `calculateNextMeetingDate`, Mon/Thu/Fri) and a **Details** toggle. `PlanningCard` gained a `compact` prop that hides the header/title-restate, Edit, and the status-button row; pause cards embed it in compact mode so the pause workflow (open pause tool on the side screen, copy parent message, run/sent checklist, complete, date repair) shows unhidden without the noise. Every other filter view is unchanged.

**Why it exists:** The day-of view reused the heavy multi-purpose `PlanningCard` grouped by Inbox/Active/Waiting/…, which is too noisy for a focused "what needs doing today" moment. Mirrors the calm `/admin/flags` issue-card pattern (story + what-to-do + one obvious action, rest under Details).

**Source-of-truth impact:** None. Pure client presentation over the same `Planning_Items`; Mark done reuses the status update, Defer is an ordinary save that bumps `targetDate`.

**Files/functions involved:**

- `components/admin/AdminPlanningPageClient.js` — `DueTodayCard`, `getPlanningStory`, `getPlanningWhatToDo`, `dueChipLabel`, `handleDefer`, the `filter === 'due_now'` render branch, and `PlanningCard`'s `compact` prop. Pattern reference: `AdminIssuesPageClient.js` `getIssueStory`/`getIssueWhatToDo`.

**What to watch out for:** `compact` only hides the header + status-button row; the pause-completion controls live inside the pause block, so they survive compact mode — don't move them into the header. Keep full tooling reachable (pause inline; others under Details) so nothing is lost versus the full board.

### 2026-06-19 — Monday Scheduling Loop (back-half of the Friday reflection)

**Feature/change:** A recurring Monday prompt that closes the Friday loop. Friday reflects/decides (captures a "next improvement to make time for" list); Monday schedules/commits. A `MONDAY_SCHEDULE_PLANNING_ID` system item is auto-created/refreshed each week (mirrors the Friday `SCHOOL_FORWARD_PLANNING_ID` plumbing via a shared `ensureRecurringSystemItem`). A top "Monday scheduling" panel on `/admin/planning` extracts the intentions from the latest reflection (`extractReflectionIntentions` + `getLatestSchoolForwardReflectionNote`) and gives each a "Schedule this" button that creates a dated action item (active, Unassigned, Do-by this Friday, `parentPlanningId` = the reflection).

**Why it exists:** "Next improvement to make time for" was captured as free text inside a reflection note and otherwise evaporated — nothing turned intentions into owned, dated work. This is the same close-the-loop pattern as pause-resume and onboarding check-ins.

**Source-of-truth impact:** None new. Scheduled items are ordinary `Planning_Items` linked back to the reflection via `parentPlanningId`. The Monday item is a system-generated recurring planning item like the Friday one.

**Files/functions involved:**

- `lib/admin/planning-helpers.mjs` — `MONDAY_SCHEDULE_PLANNING_ID`, `calculateMondayScheduleDate`, `buildMondaySchedulePlanningItem`, `isMondaySchedulePlanningItem`, `shouldRefreshMondaySchedulePlanningItem`, `getLatestSchoolForwardReflectionNote`, `extractReflectionIntentions`; Monday id added to `isMeetingPlanningItem`
- `lib/admin/planning.js` — `ensureRecurringSystemItem` (shared) + `ensureSystemPlanningItems`
- `components/admin/AdminPlanningPageClient.js` — Monday panel + `handleScheduleIntention`

**What to watch out for:** `extractReflectionIntentions` is a deliberately light parse — it keys off a line matching "next improvement" and stops at the next `Section:` heading. It is a convenience, not task classification; the human still clicks to schedule. Already-scheduled intentions are detected by matching `parentPlanningId` + lowercased title so reloads don't offer duplicates. The panel currently shows whenever the Monday item is open and intentions exist (persistent nudge), not strictly on Mondays — gate on the date if that changes.

### 2026-06-19 — Planning Pause Polish, Multi-Student Links, and a Sheet Name-Data Repair

**Feature/change:** A cluster of Planning-capture fixes plus a Students-sheet data repair.
- Linked-student **"Clear" now sticks** — clearing was resetting the selection to empty, which re-enabled name auto-detection, so the student named in the note re-attached instantly. An explicit clear is tracked distinctly (`studentSelectionSource: 'cleared'`) and suppresses inference.
- **Stop-word guard** in `inferStudentFromText` — "the" was prefix-matching "Theodore". Common/short tokens are ignored and a token must be 4+ chars to prefix-match a first name.
- **Multiple students per plan** — stored comma-separated in the existing `linked_student_id` column (no schema change). `normalisePlanningItem` exposes both `linkedStudentId` (primary/first) and `linkedStudentIds` (full list); pause/schedule flows stay bound to the primary.
- **Inline "Refresh from MMS"** in the pause builder — pulls the schedule live via `/api/admin/students/[mmsId]/schedule` when the cached `Schedule_Context` row is stale/missing, instead of sending the user to the student record.
- **Adult-learner pause message** — `buildPauseConfirmationMessage` addresses students with no parent on record directly ("you / your payment"), not in third person.
- **Surname data fix** — surnames were sitting in a stray first column (header `san`) with the real `Student Surname` column empty, so the parser read blank surnames for ~197/198 students. Fixed in the **sheet**, not in code.

**Why it exists:** All surfaced from real use. The pause "couldn't find Lloyd's lessons" report turned out to be a month-stale cache (MMS had the lessons), which led to both the inline refresh and discovering the systemic surname issue.

**Source-of-truth impact:** None new. Multi-student reuses the same column. The surname repair reinforced the rule: fix canonical sheet data in the sheet, never patch the consumer.

**Files/functions involved:**

- `components/admin/AdminPlanningPageClient.js` — `inferStudentFromText`, `StudentSearchField` (multi + clear), `buildQuickCaptureItem`, `buildPauseConfirmationMessage`, `refreshPauseSchedule`
- `lib/admin/planning-helpers.mjs` — `parseLinkedStudentIds`, `serializeLinkedStudentIds`, `normalisePlanningItem`
- `lib/admin/planning.js` — `mergePlanningItem`

**What to watch out for:** A cached value that can silently go stale (like `Schedule_Context`) should offer a one-click live refresh rather than a "go elsewhere" note. For sheet data, check the canonical source first — and beware header whitespace and duplicate headers: after renaming `san` the column briefly became `"Student Surname "` (trailing space) alongside a second empty `Student Surname`, and the empty duplicate would win.

### 2026-06-18 — Tutor Dashboard Roster: StudentGroups vs BillingProfiles

**Feature/change:** Fixed the roster filter in `getStudentsForTeacher()` (`lib/mms-client.js`) so a student is kept if EITHER their MMS `StudentGroups` OR their `BillingProfiles` link to the teacher. The old filter checked `StudentGroups` first and `return`ed on it, skipping the `BillingProfiles` fallback whenever `StudentGroups` was non-empty.

**Why it exists:** Some MMS records carry an empty/teacherless `StudentGroups` entry (e.g. `[{}]`, `length === 1`) while the real teacher assignment lives only in `BillingProfiles`. With the early return, `StudentGroups.length > 0` was true, the empty group matched nothing, and the function returned false — silently dropping an active, correctly-assigned student. Found via Santi Freeth (active in registry/Sheet/MMS/Stripe, missing only from Finn's dashboard); the same bug was hiding **7 of Finn's 32** active students.

**Source-of-truth impact:** None. The tutor dashboard roster is read live from MMS (`/api/sync` → `getStudentsForTeacher`); this only changes which MMS rows survive the post-fetch filter. MMS stays operational truth; the registry/Sheet were already correct.

**Files/functions involved:**

- `getStudentsForTeacher()` filter + `.map()` in `lib/mms-client.js`

**What to watch out for:** If an active student is missing from one tutor's dashboard but present in the registry/Sheet/MMS, it is almost never a deletion — check their MMS record's `StudentGroups` vs `BillingProfiles`. A teacher link in `BillingProfiles` with an empty `StudentGroups` is the signature. Do **not** "fix" it by editing the registry. Probe with a teacher-scoped `/search/students` (`Statuses:["Active"]`, `TeacherIDs:[id]`) and compare the raw count to the filtered count. See `docs/admin/BUG_FIXES.md`.

### 2026-06-15 — Duplicate MMS ID Detection + Profile Resolution Gotcha

**Feature/change:** `/admin/flags` shows a read-only banner listing any MMS ID used by 2+ Students-sheet rows. Prompted by a real incident: a row showing as "Elliot N/A" carried Yarah Love's MMS ID, so opening Elliot's profile silently showed Yarah.

**Why it exists:** The admin profile route resolves a student only from the Students sheet via `sheetRows.find(r => r.mmsId === id)` — the **first** match wins. A duplicate or wrong MMS ID therefore misroutes a profile with no error. The banner turns that silent failure into a visible, named flag.

**Source-of-truth impact:** None added — computed fresh each flags load (auto-clears when the sheet is fixed), no `Issue_Queue` writes. The Students sheet stays operational truth; a duplicate is fixed in the sheet, never patched in the dashboard. Related gotcha discovered same session: a student valid in MMS + registry but **missing** a Students-sheet row 404s on the profile (no row to resolve) — fix by adding/correcting the sheet row's `mms_id`.

**Files/functions involved:**

- `buildDuplicateMmsIdGroups()` in `lib/admin/issues-helpers.mjs`
- `getAdminIssues()` (returns `duplicateMmsIds`)
- `app/admin/flags/page.js` (server-rendered banner)
- `getAdminStudentByMmsId()` in `lib/admin/students.js` (the `.find` resolution)

**What to watch out for:** The banner catches only shared (duplicate) IDs, not a unique-but-wrong ID — those surface via `SHEETS ONLY` / identity-mismatch hints. A profile 404 usually means the Students sheet lacks a row for that exact `mms_id`, not a code bug.

### 2026-06-15 — Pause Expectation Auto-Revert (Symmetric Sync)

**Feature/change:** `buildPauseExpectationAutoSyncPlan` now also reverts `payment_expectation` from `stripe_paused_expected` back to `stripe_active_expected` when a high-confidence, subscription-ID-matched pause window has ended and none is upcoming. Previously it only auto-set "paused" at the start.

**Why it exists:** `PAUSE EXPECTATION STALE` was recurring manual cleanup — every ended pause left the expectation stuck on "paused" until someone flipped it per student. Pause History already holds the end date, and Stripe self-resumes billing at window end, so the dashboard's lagging label can realign automatically.

**Source-of-truth impact:** Writes `payment_expectation` on the Students sheet (its existing owner) via the existing `autoSyncPauseExpectations` loop + `Event_Log`; runs inside `getAdminIssues` and `scanLiveStripeIssues`. Never touches `inactive_or_stopped`; only subscription-ID high-confidence matches. Genuine churn still surfaces via live Stripe checks.

**Files/functions involved:**

- `buildPauseExpectationAutoSyncPlan()` in `lib/admin/pause-auto-sync-helpers.mjs`
- `autoSyncPauseExpectations()` in `lib/admin/issues.js`

**What to watch out for:** Low-confidence / name-matched pauses are intentionally left for a human via the STALE flag. On first deploy this clears the existing stale-paused backlog in one pass (all logged to `Event_Log`).

### 2026-06-15 — Agent Deploys + Push/Rebase Workflow

**Feature/change:** The agent may now run `git push` (which deploys via Railway) — but only on an explicit user instruction, after `npm run test:admin` and `npm run build` pass, never automatically, never `--force`. Granted via `Bash(git push:*)` in `~/.claude/settings.json`; documented in `CLAUDE.md`.

**Why it exists:** Removes the manual push step while keeping a human go-ahead on each production deploy.

**Source-of-truth impact:** None. Process/permission only.

**What to watch out for:** The dashboard auto-commits registry/config on onboarding edits, so local `main` is frequently behind. Local `npm run build` regenerates `lib/config/*`, `lib/student-*.js`, and `lib/soundslice-mappings.js`, which dirties the tree. Deploy flow that works cleanly: commit feature files → discard the regenerated config changes (`git checkout -- <those files>`) → `git rebase origin/main` (feature files don't overlap the registry/config commits) → push.

### 2026-06-14 — Practice Notes Portal Read Source

**Feature/change:** Student/parent portal note reads now check `Practice_Notes_Log` first and fall back to MMS only when no safe First Chord note is available.

**Why it exists:** Practice Chat is becoming the place where lesson truth is captured. Reading portal notes from First Chord's owned log reduces MMS API dependence and makes the dashboard-owned learning record useful beyond admin review.

**Source-of-truth impact:** `Practice_Notes_Log` is now a portal read source for sent/completed lesson notes. MMS remains fallback, attendance/payroll continuity source, and historical note source. Draft, in-progress, failed, and Level 1 snapshot-only rows are not parent-visible.

**Files/functions involved:**

- `GET /api/notes/[studentId]`
- `getStudentData()` generated by `scripts/generate-configs.js`
- `selectLatestPortalPracticeNote()`
- `mapPracticeNoteLogRowToPortalNote()`
- `getPracticeNoteLogRows()`

**What to watch out for:** Keep the parent-visible filter strict. Do not show copied drafts or failed delivery rows in the portal. If Sheets auth fails, portal reads should fall back to MMS. Do not remove MMS attendance writes until payroll and charging no longer depend on MMS attendance data.

**Deliberate design choice (freshness):** When a parent-visible owned note exists, the portal returns it without also fetching MMS to compare which is newer. Cross-source freshness comparison would force an MMS call on every portal load even when an owned note exists, re-coupling us to the API this migration is shedding. During the transition the intended default is to prefer the owned note; MMS is consulted only when there is no visible owned note. Revisit only if a real case appears where an outdated owned note misleads parents.

### 2026-06-13 — Planning Meeting Rhythm

**Feature/change:** Planning now has a `Meeting` filter, a seeded weekly Friday prompt, and a recent-reflections view for `Friday: what moved the school forward?`.

**Why it exists:** Meetings can be consumed by operational busyness. The new rhythm separates "keep things running" from "move the school forward" so routine admin gets cleared quickly and leadership energy is protected for meaningful improvement.

**Source-of-truth impact:** `Planning_Items` remains dashboard-owned planning state. The Friday prompt is a seeded planning item with a stable ID, not a new state tab or workflow engine. Each Friday reflection is a dated `Planning_Progress_Log` entry, which makes future monthly/quarterly summaries possible without adding another store.

**Files/functions involved:**

- `buildSchoolForwardPlanningItem()`
- `buildSchoolForwardReflections()`
- `isMeetingPlanningItem()`
- `getPlanningDashboard()`
- `components/admin/AdminPlanningPageClient.js`
- `/admin/planning?filter=meeting`

**What to watch out for:** Keep this as a lightweight rhythm, not project management. If the Meeting view becomes noisy, tighten inclusion rules before adding more fields. The point is to reduce meeting energy cost, not create another review burden.

### 2026-06-13 — Guarded Pause Planning Completion

**Feature/change:** Pause planning cards now provide a single guarded completion path: open the prefilled Payment Pause PWA, copy a dashboard-generated parent confirmation message, confirm the pause tool was run and the message was sent/copied, then click `Mark pause completed`.

**Why it exists:** The previous path was safe but cognitively heavy: open the PWA, copy/send the message, return to Planning, log confirmation, set the payment expectation, and then close the task. The new path keeps the same human approval boundary while reducing remembered steps and making "done" mean a complete pause loop.

**Source-of-truth impact:** `Planning_Items` and `Planning_Progress_Log` remain dashboard-owned workflow state. The `Students` sheet remains the source of truth for `payment_expectation`. The payment expectation update still goes through the student PATCH route and writes the consequential action to `Event_Log`. The dashboard still does not run Stripe pause actions directly from Planning.

**Files/functions involved:**

- `components/admin/AdminPlanningPageClient.js`
- `buildPaymentPausePrefillUrl()`
- `buildPauseConfirmationMessage()`
- `handlePauseCompleted()`
- `PATCH /api/admin/students/[mmsId]`
- `POST /api/admin/planning`
- `docs/admin/WORKFLOW_DESIGN_PRINCIPLES.md`

**What to watch out for:** The completion button assumes the admin really ran the Payment Pause PWA. It aligns dashboard expectation after human confirmation; it is not proof from Stripe. Keep this explicit until the pause tool exposes a verified callback or shared state. Do not generalise this into automatic Stripe mutation from Planning.

### 2026-06-13 — Canonical Practice Chat Admin API

**Feature/change:** Practice Chat quick links now use the canonical admin/API Railway app for production writebacks: `https://first-chord-dashbord-production.up.railway.app`. Local links still use the local dashboard origin.

**Why it exists:** The Railway account has multiple dashboard deployments. `efficient-sparkle` serves the public tutor/student dashboard but only has MMS-focused env vars, while `pure-spontaneity` has the full admin/Gmail/Sheets/Stripe env needed for Practice Chat Level 2. Relying on `window.location.origin` meant Practice Chat could post back to the wrong runtime.

**Source-of-truth impact:** No operational truth moved. `Practice_Notes_Log` remains dashboard-owned note/delivery memory; MMS remains attendance backup/source context; Gmail remains First Chord-owned parent delivery for the Level 2 pilot. This change clarifies deployment routing, not data ownership.

**Files/functions involved:**

- `buildPracticeChatUrl()` in `components/navigation/QuickLinks.js`
- `NEXT_PUBLIC_PRACTICE_CHAT_DASHBOARD_BASE_URL`
- `PRACTICE_CHAT_API_SECRET`
- `NEXT_PUBLIC_PRACTICE_CHAT_API_SECRET`
- `docs/admin/OPERATIONS_RUNBOOK.md`
- `docs/admin/BUG_FIXES.md`

**What to watch out for:** Do not point Level 2 writebacks at a Railway service unless it has the full admin env and the matching Practice Chat bridge secret. The browser-side secret is a coarse bridge guard, not per-tutor authentication. If the canonical admin domain changes, update `NEXT_PUBLIC_PRACTICE_CHAT_DASHBOARD_BASE_URL` and the runbook.

### 2026-06-12 — Practice Chat Delivery Idempotency

**Feature/change:** Practice Chat Level 2 delivery now uses a stable `delivery_key` for each student + MMS attendance + note-text hash, and the dashboard upserts the Level 2 delivery row instead of appending repeated delivery attempts.

**Why it exists:** The finish-lesson-admin button writes across MMS, Gmail, and Sheets. Without idempotency, a retry or double-click could send duplicate parent emails. The highest-risk duplicate is parent delivery, so sent Gmail message IDs now act as the stop sign for retries.

**Source-of-truth impact:** `Practice_Notes_Log` remains dashboard-owned learning/delivery memory. MMS remains the canonical attendance/lesson-note backup. Gmail is the First Chord-owned parent delivery channel for the Test Studenty pilot. The new delivery row is workflow state used to decide whether a retry should do nothing, retry Gmail only, or run the full test flow.

**Files/functions involved:**

- `POST /api/practice-notes/mms-test`
- `buildPracticeNoteDeliveryKey()`
- `findPracticeNoteDeliveryRecord()`
- `isPracticeNoteDeliveryEmailSent()`
- `upsertPracticeNoteLogRow()`
- Practice Chat `renderMmsAlreadyCompleted()` / `renderMmsInProgress()`

**What to watch out for:** This guards normal retries and duplicate clicks, but Level 2 is still only a Finn/Tom/Fennella pilot. Wider tutor rollout still needs a proper tutor access model, non-pilot rollout controls, and a decision on how long to treat stale `in_progress` rows as retryable.

### 2026-06-11 — Practice Chat Note Snapshots

**Feature/change:** Practice Chat now receives student/tutor context from dashboard quick links and appends a best-effort note snapshot to `Practice_Notes_Log` when the tutor copies notes in the Level 1 flow.

**Why it exists:** Tutors were already creating useful lesson-note data, but First Chord had to pull that context back from MMS later. This adds dashboard-owned visibility without changing the tutor’s core habit: copy notes, open MMS, mark attendance, and send the parent email manually.

**Source-of-truth impact:** `Practice_Notes_Log` is an append-only dashboard snapshot. MMS remains the source of truth for attendance, the parent email checkbox, and canonical lesson-note completion. The snapshot should not be treated as proof that the lesson was marked present or emailed.

**Files/functions involved:**

- `POST /api/practice-notes`
- `lib/admin/practice-notes-helpers.mjs`
- `appendPracticeNoteLogRow()` in `lib/admin/sheets.js`
- `components/navigation/QuickLinks.js`
- Practice Chat `public/src/practice-note-sync.js`
- Practice Chat `public/src/app.js`

**What to watch out for:** The API is intentionally best-effort and CORS-limited for V1.5, not the final authenticated tutor workflow. If the save fails, tutors still reach MMS. Add the tab to backups whenever state tabs change, and do not use this log as a replacement for MMS attendance. Keep the `note_id` duplicate guard in place so retries/double-clicks do not create repeated rows.

**Level 2 pilot path:** `POST /api/practice-notes/mms-test` explores direct MMS attendance/note/email writes. It is currently limited to dashboard-verified students for Finn, Tom, and Fennella, plus Test Studenty (`sdt_fBg9JN`) for local testing. It preserves MMS price context from the attendance record and uses `Family.Parents[].ID` for recipient discovery. Dry-runs now expose the candidate attendance records and the route can target an explicit `targetAttendanceId`. Local testing proves the dashboard can save the snapshot, write the note, and mark attendance in MMS. MMS `emailnotes` can fail with `Principal must be a teacher to email lesson notes`, so the current pilot path sends parent delivery through First Chord Gmail using send-only `gmail.send` OAuth instead.

**Strategic lesson:** This is no longer only a note-sending tool. It is the first bridge from lesson reflection into dashboard-owned learning memory. The log now has optional audit fields for selected attendance ID, recipient, Gmail message/thread ID, sent timestamp, partial failure, and manual follow-up state. Older rows remain snapshot-only, and real tutor rollout still needs retry/idempotency design so a failed second step cannot duplicate MMS writes or parent emails.

### 2026-06-10 — Student-Linked Planning With Explicit Billing Actions

**Feature/change:** Planning items can now link to students through search/inference, show linked student names on planning cards, appear on student detail pages, and offer an explicit `Set Stripe paused expected` action for linked pause reminders after the confirmation-message checkbox is logged.

**Why it exists:** Loose Brain notes such as “pause Eddie next week” are only useful if they connect to the right student context. Student linking turns human-captured planning into retrievable operational work while keeping payment-affecting actions approval-first.

**Source-of-truth impact:** `Planning_Items` and `Planning_Progress_Log` remain dashboard-owned workflow/planning state. The `Students` sheet remains the source of truth for `payment_expectation`. The pause planning action writes `payment_expectation` through the existing student update route and logs the consequential action to `Event_Log`.

**Files/functions involved:**

- `app/admin/planning/page.js`
- `app/admin/students/[mmsId]/page.js`
- `components/admin/AdminPlanningPageClient.js`
- `components/admin/AdminStudentDetailClient.js`
- `POST /api/admin/planning`
- `PATCH /api/admin/students/[mmsId]`
- `getAdminStudents()`

**What to watch out for:** Student name inference is a convenience, not authority; admins should confirm the linked student when names are ambiguous. Marking a planning item `Done` must not mutate payment state. Keep future ownership fields light until there is a real delegation model beyond Finn/Tom/Fenella.

### 2026-06-04 — Student Exit Archive V1

**Feature/change:** Added a student-detail exit/archive workflow that can mark `payment_expectation` as `inactive_or_stopped`, delete the portal registry entry, mark the student inactive in MMS, and archive/remove the active `Students` sheet row after copying it to `Students_Archive`. Each step writes an explicit audit row to `Event_Log`.

**Why it exists:** Deleting someone from the Students sheet is too blunt to treat as an automatic instruction to delete registry access or change MMS. The safer loop is a deliberate dashboard path: confirm the student has left, then close each operational lane with a note and audit trail.

**Source-of-truth impact:** The `Students` sheet remains the source of truth for active dashboard student rows until the final archive step. `Students_Archive` stores removed rows for history. Registry and MMS are changed only by explicit per-system buttons. Stripe is not changed by this workflow; live payment checks should still catch inactive students who are billing.

**Files/functions involved:**

- `components/admin/AdminStudentDetailClient.js`
- `app/api/admin/students/[mmsId]/archive/route.js`
- `lib/admin/student-archive-helpers.mjs`
- `markStudentInactive()` in `lib/admin/mms.js`
- `archiveAndDeleteStudentSheetRow()` in `lib/admin/sheets.js`
- `buildStudentArchiveEvent()`
- `tests/admin/student-archive-helpers.test.mjs`

**What to watch out for:** This does not cancel Stripe. The final `Students` row archive makes the student detail page stop loading after refresh, so it should be the last step. MMS status writes rely on the same PUT pattern as onboarding activation; if MMS rejects a status change, keep the student in the workflow and resolve manually.

### 2026-06-03 — Planning Inbox V1

**Feature/change:** Added a lightweight `/admin/planning` inbox for ideas, initiatives, and actions. Planning items now have owner, area, status, optional links, outcome, next action, and append-only progress notes. The page derives momentum labels such as `Moving`, `Stalled`, and `No next action`.

**Why it exists:** Some improvement work lasts weeks or months, so a simple `Active` status can hide real progress. Planning V1 is designed to capture thoughts quickly, then show whether chosen initiatives are moving, waiting, stalled, or missing a next action.

**Source-of-truth impact:** `Planning_Items` is dashboard-owned planning/workflow state. `Planning_Progress_Log` is dashboard-owned append-only progress history. Neither tab is external truth, and this does not affect Issues, Students, MMS, Stripe, or parent-facing actions.

**Files/functions involved:**

- `app/admin/planning/page.js`
- `app/api/admin/planning/route.js`
- `components/admin/AdminPlanningPageClient.js`
- `lib/admin/planning.js`
- `lib/admin/planning-helpers.mjs`
- `getPlanningItemRows()`, `upsertPlanningItemRow()`, `getPlanningProgressLogRows()`, and `appendPlanningProgressLogRow()` in `lib/admin/sheets.js`
- `tests/admin/planning-helpers.test.mjs`

**What to watch out for:** Keep this as lightweight planning, not project management. Avoid due dates, notifications, automation, or AI classification until the capture/review habit proves useful. Initiatives should always have a current next action if they are active.

### 2026-06-03 — Payment Setup Pending As Work Queue

**Feature/change:** Moved ordinary `setup_pending` students out of `/admin/flags` issue generation and into the `/admin/students?paymentExpectation=setup_pending` work queue. Blank Stripe-managed rows with no Stripe customer/subscription IDs now derive as `setup_pending`. Added a narrower `SETUP PENDING STRIPE LINKED` issue for students still marked setup pending even though both Stripe linkage IDs are recorded.

**Why it exists:** `setup_pending` is usually unfinished onboarding/setup work, not a broken payment problem. Treating every setup-pending student as an issue made `/admin/flags` noisier and blurred the difference between queue work and contradictions.

**Source-of-truth impact:** The `Students` sheet remains the source of truth for `payment_mode`, `payment_expectation`, `stripe_customer_id`, and `stripe_subscription_id`. Stripe remains the source of truth for live billing. `Issue_Queue` remains workflow state, not payment truth.

**Files/functions involved:**

- `buildPaymentIssues()` in `lib/admin/issues.js`
- `classifyIssue()` and `buildPaymentIssueRecord()` in `lib/admin/issues-helpers.mjs`
- `components/admin/AdminIssuesPageClient.js`
- `app/admin/students/page.js`
- `app/admin/page.js`
- `tests/admin/issues-helpers.test.mjs`

**What to watch out for:** `SETUP PENDING STRIPE LINKED` proves the sheet has Stripe IDs, not that Stripe is actively billing. Use a live Stripe check before assuming the subscription is healthy. Old `PAYMENT SETUP PENDING` queue rows may remain visible until `/admin/flags` refreshes and marks them system-cleared.

### 2026-06-03 — Stripe Void Invoice Review

**Feature/change:** Live Stripe scans now treat a void latest invoice with a remaining balance as a payment problem when the subscription is `past_due` or `unpaid`, even if the student is currently marked `stripe_paused_expected`.

**Why it exists:** Stripe pause collection can intentionally void invoices, so void alone is not always a failure. But a `past_due` subscription with a void subscription-cycle invoice and a remaining balance is operationally risky and should not be silently suppressed by pause expectation.

**Source-of-truth impact:** Stripe remains the source of truth for live subscription and invoice state. The dashboard derives a `PAYMENT_FAILED` issue from the live Stripe snapshot; it does not write Stripe state.

**Files/functions involved:**

- `deriveStripeInvoiceSummary()` in `lib/admin/stripe-snapshot-helpers.mjs`
- `buildLiveStripeIssues()` in `lib/admin/stripe-snapshot-helpers.mjs`
- `buildLiveStripeDetail()` in `lib/admin/issues.js`
- `tests/admin/stripe-snapshot-helpers.test.mjs`

**What to watch out for:** Do not flag every void invoice during an intentional pause. The rule is deliberately narrower: void invoice with balance plus a past-due/unpaid subscription. Event IDs may not be readable with the restricted Stripe key; the dashboard should rely on subscription/latest invoice reads.

### 2026-06-03 — Reopen Resolved Issues Still Detected

**Feature/change:** Issue queue merging now reopens a `resolved` source-managed issue if the latest source scan still detects it. Source presence is also normalised from Sheets-style `TRUE/FALSE` values into lowercase internal state.

**Why it exists:** A payment issue could be detected once, marked resolved, and then disappear from the working view even though Stripe still reported the same problem. Resolved should mean fixed; if the source still sees the issue, it needs to return to open work.

**Source-of-truth impact:** `Issue_Queue` remains workflow state. Source systems such as Stripe, Sheets, MMS, and registry remain the evidence. Reopening is derived from comparing current source evidence with queue state.

**Files/functions involved:**

- `mergeIssuesWithQueueState()` in `lib/admin/issue-queue.js`
- `tests/admin/issue-queue.test.mjs`

**What to watch out for:** `ignored` issues should remain intentionally quiet. This reopen behaviour is for `resolved` issues where the source still detects the problem.

### 2026-05-18 — Explicit Waiting Capacity Refresh

**Feature/change:** Added a manual `Refresh free slots` button on `/admin/waiting` that force-refreshes MMS `Free` calendar slots and recalculates waiting-list capacity matches.

**Why it exists:** MMS free-slot data is cached to avoid repeated vendor calls, but placement work sometimes needs an immediate refresh after creating a new Free slot in MMS. The button keeps normal page loads cheap while giving admins an explicit “check now” action.

**Source-of-truth impact:** MMS remains the source of truth for real free slots. The dashboard does not reserve, assign, or write capacity records. It only refreshes cached read context and recalculates hints.

**Files/functions involved:**

- `app/admin/waiting/page.js`
- `app/api/admin/waiting/capacity/route.js`
- `components/admin/AdminWaitingPageClient.js`
- `lib/admin/waiting-capacity.js`
- `getMmsFreeCalendarSlotContext()`

**What to watch out for:** Keep this as an explicit refresh, not an automatic poll. Capacity matches are still hints only; do not turn this into slot reservation or tutor assignment without designing a proper placement workflow.

### 2026-05-17 — Learning Log Convention

**Feature/change:** Added `docs/LEARNING_LOG.md` as a lightweight place to capture architectural lessons as the dashboard evolves.

**Why it exists:** The admin dashboard is now producing reusable patterns: loop-closing, source-of-truth lanes, context layers, cached vendor reads, and action-led navigation. These lessons are useful for future FirstChord work, blog writing, and guiding other businesses through similar builds.

**Source-of-truth impact:** None. This is documentation only. It does not change operational truth, workflow state, vendor data, or generated outputs.

**Files/functions involved:**

- `docs/LEARNING_LOG.md`
- `docs/README.md`
- `docs/INDEX.md`

**What to watch out for:** Keep entries short and selective. If every UI tweak gets logged, the file will stop being useful. Add entries when a change affects architecture, source ownership, workflow shape, caching strategy, automation boundaries, or future build patterns.

### 2026-05-17 — Action-Led Admin Navigation

**Feature/change:** Top-level admin navigation was narrowed to `Overview`, `Issues`, `Workflows`, and `Planning`, with student lookup treated as a header utility rather than a primary nav mode.

**Why it exists:** V4 will add more surfaces over time. A long top menu would turn into a sitemap instead of an operating model. The new structure keeps navigation based on modes of work rather than pages.

**Source-of-truth impact:** None directly. This changes how users reach existing workflows and context views, not which system owns any data.

**Files/functions involved:**

- `app/admin/layout.js`
- `app/admin/workflows/page.js`
- `app/admin/planning/page.js`
- `app/admin/students/page.js`

**What to watch out for:** Do not add new top-level nav items casually. New tools should usually live inside `Workflows` or `Planning` unless they become a true operating mode. Student detail remains important context, but most users should arrive there through search, issue cards, or workflow cards.

### 2026-05-17 — Waiting List As Placement Decision Surface

**Feature/change:** Waiting cards now show MMS sign-up context, parsed note facts, parent/contact phone when available, full MMS note detail, and possible free-slot matches.

**Why it exists:** Waiting and onboarding were starting to blur. The cleaner boundary is: `/admin/waiting` helps decide contact and placement; `/admin/onboard` executes the multi-system onboarding once ready.

**Source-of-truth impact:** MMS remains the source of truth for waiting-list students and sign-up notes. `Waiting_List_State` remains the dashboard-owned state for waiting status and notes. No new write source was introduced.

**Files/functions involved:**

- `lib/admin/mms.js`
- `components/admin/AdminWaitingPageClient.js`
- `lib/admin/waiting-workflow.js`
- `lib/admin/capacity-helpers.mjs`

**What to watch out for:** Do not make Waiting reserve slots or assign tutors until a placement workflow is explicitly designed. Capacity matches are hints only. Keep Onboarding responsible for creating Sheets, registry, MMS lesson, billing profile, and portal setup records.
