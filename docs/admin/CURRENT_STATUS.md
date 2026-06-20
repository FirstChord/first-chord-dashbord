# Admin Current Status

Last updated: 2026-06-20

This is the tracked current-status entrypoint for agents working from the `music-school-dashboard` repository.

The local workspace file `../CURRENT_HANDOVER.md` may contain extra machine/session context, but this file is the durable repo-tracked source for current admin-dashboard direction.

## Active Direction

V3 established the dashboard's loop-closing pattern:

1. detect or surface a recurring admin problem
2. show enough context to make the right decision
3. provide a bounded action path
4. store the outcome
5. log consequential actions

V4 is now adding lightweight context layers on top of those loops. The goal is to make each student, issue, payment, and workflow easier to understand and delegate without adding a large state machine or new database.

A guiding workflow principle is now explicit: reduce admin cognitive load. Workflows should turn recurring memory-heavy admin into clear context, safe next actions, and logged outcomes.

The active surface is the private admin dashboard under `/admin`.

## Recent Completed Work

- Persistent `/admin/flags` issue loop using `Issue_Queue` and `Event_Log`
- calmer flag cards with clearer primary actions and collapsed detail
- system-cleared bulk resolve for stale no-longer-detected issues
- active issue summary counts instead of historical noise
- payment-mode and payment-expectation policy fields
- live/manual Stripe checks, including payment failure visibility
- pause-history expectation checks, including future pause windows treated as upcoming rather than current
- pause/payment action audit trail
- waiting-list state and notes
- waiting-list closeout through successful onboarding
- recurring workflow surfaces for showcase and holiday operations
- V4 derived lifecycle context on student detail and relevant flags
- V4 MMS schedule context cached into `Schedule_Context`
- V4 baseline payment value context using schedule duration and current pricing
- first read-only capacity view at `/admin/capacity`
- waiting-list capacity hints on `/admin/waiting`
- V4.1 first performance/navigation pass: shared MMS free-slot cache plus grouped admin nav
- V4.1 scalable navigation model: top nav is now Overview, Issues, Workflows, and Planning, with student lookup as a header utility
- waiting cards now show MMS sign-up context, parsed note facts, parent/contact phone when available, and the full MMS note behind a detail toggle
- `/admin/waiting` has a manual `Refresh free slots` button to force-refresh MMS `Free` calendar slots without polling on every page load
- `/admin/workflows/parent-understanding` is a first testable parent check-in workflow for Fenella:
  - search/select existing students
  - see parent contact, tutor, schedule, instrument, lifecycle, and dashboard URL context
  - record call status, understanding checks, feedback, WhatsApp/community-group context, risk signals, next actions, and a summary
  - copy parent-facing WhatsApp templates
  - save one row per student to `Parent_Understanding_State`
  - append `Event_Log` entries when records are completed, need follow-up, or are escalated
- `/admin/planning` now has a lightweight Brain/planning inbox with:
  - quick capture for ideas/actions/initiatives
  - owner, status, area, next action, due/review date, and progress history
  - meeting-friendly filters such as Due Now, Unassigned, Waiting, Linked, and No Next Action
  - a Meeting filter that groups work worth discussing together, beyond only items due today
  - a recurring Friday prompt: `Friday: what moved the school forward?`
  - Friday reflections saved as dated `Planning_Progress_Log` entries, with recent reflections shown in the Meeting view for later monthly/quarterly summaries
  - student search/linking so planning items can attach to a real student record
  - linked planning items shown on student detail pages
  - streamlined pause-planning completion path: open the prefilled payment-pause PWA, copy the dashboard-generated parent confirmation message, confirm the pause tool/message checks, then mark the pause completed
- State/documentation hygiene pass:
  - `lib/admin/sheets.js` has a shared `upsertManagedSheetRow()` helper for one-row dashboard state upserts
  - `docs/admin/STATE_TABS_SCHEMA.md` documents dashboard-owned Sheets tabs, keys, write patterns, and concurrency limits
  - `docs/admin/HYGIENE_AND_SECRETS.md` documents the home-directory git risk, Theta credential migration concern, and test-student cleanup path
  - `docs/admin/DOCUMENTATION_MAP.md` defines canonical repo docs versus higher-level Obsidian notes
- Practice Chat bridge:
  - dashboard student quick links pass student/tutor context into Practice Chat
  - production quick links now send Practice Chat writebacks to the canonical admin/API Railway app, `https://first-chord-dashbord-production.up.railway.app`, instead of relying on whichever dashboard domain the tutor opened
  - Practice Chat Level 1 now appends an editable lesson-note snapshot to `Practice_Notes_Log` when the tutor clicks `Copy Notes`, then the tutor continues the manual MMS attendance/email flow
  - `Practice_Notes_Log` now has optional delivery/audit fields for selected MMS attendance, recipient, Gmail message IDs, send status, send timestamp, manual follow-up state, and a stable delivery key
  - student/parent portal note reads now check safe sent/completed `Practice_Notes_Log` rows first, then fall back to MMS when no owned note is available
  - student detail pages show a read-only `Recent practice notes` panel with latest note date, tutor, lesson date, send status, recipient, MMS attendance context, and a short preview
  - the narrow Level 2 test path can preview a target MMS attendance record, show why that lesson was selected, write the note, mark attendance `Present`, and send the note through First Chord Gmail
  - the Level 2 pilot path is idempotency-aware: a duplicate request for the same student, MMS attendance, and note text returns the existing delivery instead of sending another parent email; if MMS was saved but Gmail failed, retry only attempts the email step
  - Practice Chat API routes now reject no-Origin requests unless a valid shared secret header is supplied; wider rollout should set matching `PRACTICE_CHAT_API_SECRET` and `NEXT_PUBLIC_PRACTICE_CHAT_API_SECRET`
  - Level 2 is currently limited to dashboard-verified students whose tutor is Finn, Tom, or Fennella; other tutors remain on the Level 1/current copy-to-MMS workflow
- Loop-closing additions (2026-06-15):
  - onboarding now auto-creates a first-lesson check-in Planning card (Finn & Tom, dated to the first Mon/Wed/Fri after the first lesson), linked to the student, logged to `Event_Log`, and idempotent
  - pause expectation now auto-reverts `stripe_paused_expected` → `stripe_active_expected` when a high-confidence subscription-ID-matched pause window ends, so `PAUSE EXPECTATION STALE` no longer needs per-student manual flipping
  - tutor absences can be captured from Planning quick-capture ("pause tutor <name>" / "<name> off friday"): one card per day, affected students snapshotted, deep-linked to the tutor-absence workflow
  - the tutor-absence workflow page now lists all logged absences, not just the first open one
- Issue-queue clarity (2026-06-15):
  - `/admin/flags` shows a read-only banner for any MMS ID shared by 2+ Students-sheet rows (silent profile-misroute protection)
  - issue cards have a `View customer in Stripe` deep link and a copy-email button, so confirming an issue no longer requires opening the profile
  - payment quick-action results show inline next to the card, and a pause action that resolves a flag clears the card optimistically
  - the student PATCH route tolerates capitalised Theta usernames (lowercased on save) instead of rejecting them
- Planning surface + pause UX focus (2026-06-18 → 2026-06-20):
  - tutor dashboard roster fix: `getStudentsForTeacher()` keeps a student if EITHER MMS `StudentGroups` OR `BillingProfiles` link to the teacher (the old early-return dropped ~7 of Finn's active students)
  - calmer issue cards continued: plain-language story + what-to-do, `View customer in Stripe`, student record in a slide-over (stay on the page), Stripe-refresh auto-resolve, clearer dashboard-vs-Stripe wording
  - pause capture/UX: single-lesson pause date window, the payment-pause tool opens in a side panel, one-button structured pause capture, and an inline `Refresh from MMS` in the pause builder (explicit vendor refresh that writes back to `Schedule_Context`)
  - pause confirmation message now addresses adult learners directly ("you / your payment") instead of the parent-facing third person
  - planning quick-capture fixes: clearing a linked student now sticks; a stop-word guard stops common words ("the" → Theodore) auto-attaching names; a plan can link **multiple students** (group lessons), stored comma-separated in the existing `linked_student_id` column — pause/schedule stay bound to the primary (first) student
  - reflections/progress notes now preserve line breaks and expand (Show more), so a full Friday meeting summary reads cleanly
  - **Monday scheduling loop**: a recurring Monday prompt surfaces last Friday's "next improvement" intentions with one-tap `Schedule this` → dated, owned action items linked back to the reflection (reuses the Friday seeded-item pattern via a shared `ensureRecurringSystemItem`; no new workflow engine)
  - **calm "due today" view**: `/admin/planning?filter=due_now` renders focused `DueTodayCard`s (plain headline, what-to-do, due chip, one obvious action: Mark done / Defer until next meeting) instead of the full status-grouped board; pause cards show their steps inline via a new `compact` PlanningCard mode; all other filters are unchanged
- Data + tooling hygiene (2026-06-19 → 2026-06-20):
  - Students sheet: surnames were sitting in a stray `san` column with the real `Student Surname` column empty; fixed in the **canonical sheet** (now resolves for ~198 students). Recommend protecting the Students header row in Google Sheets with an edit-warning.
  - FC regeneration (`first-chord-brain`) made resilient: `fetch_sheets_students()` now reads raw values and tolerates blank/duplicate headers instead of `get_all_records()`. The 2026-06-19 sheet edit had left duplicate blank headers and broke the hourly GitHub Action; the tolerant read mirrors how the dashboard reads the same sheet.
  - **Schedule-context hardening**: `/admin/capacity` now lists the specific students with a stale/missing/behind-MMS cache (`buildScheduleHealthList`, including a new "past lesson" signal for `found` rows whose `nextLessonAt` is already past), with per-row refresh + a bounded `Refresh all stale` (`POST /api/admin/schedule/refresh-stale`, capped/sequential, admin-triggered only). Closes the Lloyd-class gap where a behind-MMS cache silently fed suspect pause dates.

## Current Slice

The active V4 slice is context + ownership layering, not broad automation.

- `deriveStudentLifecycleStatus()` is read-only context. It does not change issue generation, onboarding, Stripe actions, or stored state.
- `Schedule_Context` is a cached Sheets tab populated from MMS calendar events. It is refreshed manually per student or by the bulk schedule refresh route, not on every page load.
- Payment value context is baseline operational context only. It uses the cached schedule duration and school price table.
- Shared MMS lesson slots are treated as group lessons when multiple students have the same teacher, next lesson start, and duration in `Schedule_Context`.
- For example, Emily Grifa and Nina Gavlin share a 45 minute slot, so each should show group pricing: `£20/week`, not one-to-one 45 minute pricing.
- `/admin/capacity` reads current free capacity from MMS calendar events with category `Free`. This is the right starting source for real available slots; do not duplicate those into a new Sheets tab unless a manual overlay becomes necessary.
- `/admin/capacity` and `/admin/waiting` share a short-lived server cache for MMS `Free` calendar slots via `getMmsFreeCalendarSlotContext()`, so navigating between those pages should not trigger repeated MMS calendar searches inside the cache window.
- The same capacity page also shows schedule-cache health so student schedule hardening remains visible.
- `/admin/waiting` now parses instruments from the MMS sign-up note and shows possible free slots only when the tutor teaches the parsed instrument. These are hints only; they do not reserve slots, assign tutors, send messages, or start onboarding.
- `/admin/waiting` is the placement/contact decision surface: it shows parent contact details, MMS note context, and possible capacity matches before handing off to `/admin/onboard` for execution.
- The waiting free-slot refresh is explicit and admin-triggered. It bypasses the short server cache for MMS `Free` slots, then recalculates waiting-list capacity hints in place.
- `/admin/workflows/parent-understanding` is a campaign workflow, not a CRM and not message automation. It should stay manual/approval-first until the communication draft layer is intentionally designed.
- Parent understanding records are workflow state:
  - Sheets tab: `Parent_Understanding_State`
  - state owner: dashboard
  - student/contact truth: existing Sheets/MMS/registry data
  - message sending: human copy/send only
  - contact-detail fixes: flag and note for Fenella/admin follow-up; do not edit MMS from this workflow yet
- The current parent check-in policy assumptions are:
  - practice notes historically went to the parent email in MMS; the Practice Chat Level 2 pilot is testing First Chord-owned Gmail delivery instead
  - all active students should generally have a small tutor/parent/Finn/Tom WhatsApp group except Adult Ukulele Orchestra-style exceptions
  - not being in the wider First Chord community group should remain a follow-up unless intentionally declined/not relevant
  - cancellation/holiday recap should use the school handbook plus the short plain-English policy summary in the template
- Admin navigation is intentionally action-led:
  - `Overview` = today's operating summary
  - `Issues` = detected problems and issue-loop actions
  - `Workflows` = waiting list, onboarding, showcase, holidays, and future task/communication flows
  - `Planning` = capacity, schedule health, seasonal planning, and future finance/capacity layers
- Student records remain important context, but they are accessed through header search, issue links, workflow links, or `/admin/students`; they are not a primary top-nav mode.
- Planning state is dashboard-owned work state, not external truth:
  - Sheets tabs: `Planning_Items` and `Planning_Progress_Log`
  - linked student IDs point at existing `Students` rows
  - progress notes are append-only planning memory
  - the Friday school-forward prompt is a seeded planning item, not a separate workflow engine
  - student-linked pause planning can update `payment_expectation` only through an explicit human completion action
  - generic `Done` does not itself change payment state; `Mark pause completed` is the guarded pause-specific action that logs confirmation, aligns `payment_expectation`, and closes the task
- Dashboard-owned state tabs and write patterns are now documented in `docs/admin/STATE_TABS_SCHEMA.md`. Treat that as the schema map before adding another Sheets tab.
- Pause planning guardrail:
  - pause reminders should be linked to a student before billing actions
  - the admin must confirm the payment pause tool was run and the parent confirmation was sent/copied
  - the dashboard-generated parent message reduces copy/paste and wording load but does not send WhatsApp
  - `Mark pause completed` logs the confirmation, sets `stripe_paused_expected` through the existing student PATCH route if needed, appends to `Event_Log`, and marks the planning task done
- Practice Chat note ownership is becoming a bridge between admin and learning:
  - `Practice_Notes_Log` stores generated notes and student/tutor context
  - in the legacy handoff flow, failed snapshot saves must not block the tutor from opening MMS
  - in the Level 2 test flow, MMS remains the backup/canonical attendance and lesson-note store, while Gmail is being tested as the First Chord-owned parent delivery channel
  - the current `Practice_Notes_Log` schema stores final send/audit fields when the Level 2 route has them, but older rows may only contain a snapshot
  - do not treat old rows as proof of delivery unless `email_send_status`, `mms_attendance_saved`, and recipient fields are present
  - Level 2 delivery records use `delivery_key = student + MMS attendance + note hash` so duplicate clicks/retries do not send the same parent email twice
- Practice Chat Level 2 is in controlled pilot:
  - route: `POST /api/practice-notes/mms-test`
  - allowed students: dashboard-verified students for Finn, Tom, or Fennella, plus Test Studenty for local testing
  - dry-run previews the MMS attendance target, candidate lesson list, selected-date reason, preserved price, and email recipients
  - execute mode requires `confirmLevel2Pilot: true` and should not be broadened to all tutors until the pilot has been reviewed
  - local testing confirms the server token can save notes and mark attendance in MMS
  - MMS `emailnotes` can fail with `Principal must be a teacher to email lesson notes`
  - test execution now sends the parent note via the First Chord Gmail account instead of MMS `emailnotes`, using `GMAIL_*` send-only OAuth env vars
  - duplicate execution returns the existing sent delivery when `gmail_message_id`/`email_send_status` says the note was already sent
  - partial retry skips the MMS write when the existing delivery record says `mms_attendance_saved = TRUE` and only retries Gmail
  - lesson selection must stay explicit/visible before real tutor rollout
  - final tutor rollout still needs a real-student pilot, broader auth, and a retry design that does not duplicate MMS writes or parent emails
  - transactional lesson-note email is now documented as the narrow automated-email exception; payment, pause, onboarding, WhatsApp, and marketing messages remain approval-first

Before deployment, verify with:

```bash
npm run test:admin
npm run build
```

## Best Next Slices

Progress note (2026-06-20): the 2026-06-18→20 work advanced **pause loop maturity** (inline MMS refresh, clearer pause steps, adult/parent message), **planning link refinement** (multi-student links, stop-word guard, clear fix), added a calm due-today view + the Monday scheduling loop, and delivered **schedule-context hardening** (slice #2 below — `/admin/capacity` now surfaces and refreshes stale/behind-MMS schedule caches). The strongest remaining documented priority is now the **communication draft layer** (slice #8 — the gate everything message-related waits behind). Pick the next slice deliberately rather than continuing to extend Planning UX by default.

1. **V4.1 performance hardening**
   - Add TTL caching to other expensive overview checks if they still feel slow, especially MMS/GitHub health.
   - Keep automatic cohort-wide API calls rare; prefer cached summaries plus explicit refresh actions.
   - Review which admin pages should be daily top-level navigation versus planning/background tools.

2. **Schedule context hardening**
   - Confirm the bulk MMS schedule refresh is cheap enough operationally.
   - Review edge cases: group lessons, substitute teachers, one-off lessons, missing future calendar events.
   - Use `/admin/capacity` to monitor stale, missing, low-confidence, and shared schedule cache records.

3. **Payment value refinement**
   - Keep values baseline, not accounting.
   - Add only small explanations where value affects payment flags or prioritisation.

4. **Waiting-list capacity matching refinement**
   - Improve ranking for multi-instrument enquiries.
   - Add day/time preference parsing only if the MMS notes reliably contain it.
   - Keep matches as suggestions until the placement workflow is intentionally designed.

5. **Pause loop maturity**
   - Make pause issue cards clearer about whether the mismatch comes from `Pause History`, sheet expectation, or live Stripe.
   - Keep Stripe pause/resume mutation commands out of scope.

6. **Contact role model**
   - Clarify billing/admin contact roles before any message automation.

7. **Future capacity overlay**
   - Add future-hire or tentative availability only after the MMS `Free` slot view is useful.
   - Keep this separate from real MMS calendar availability.

8. **Communication draft layer**
   - Add draft and approval records before any WhatsApp Cloud API integration.
   - Do not auto-send.

9. **Parent understanding hardening**
   - Manually test 2-3 real students before handing to Fenella.
   - Confirm the labels match how Fenella naturally asks the questions.
   - Keep improving next-action wording before adding more fields.
   - Do not auto-update MMS contact details from this page; keep this as flag/note only for now.

10. **Planning link refinement**
   - Improve student matching only if real captures show ambiguity.
   - Consider linking planning items to issue IDs after the student-link loop is calm.
   - Keep ownership simple: Finn, Tom, or Unassigned unless a real delegation need appears.

## Do Not Do Next

- Do not add heavy assignment/owner systems yet.
- Do not wire WhatsApp auto-send.
- Do not add Stripe mutation commands from `/admin/flags`.
- Do not create a new database just to replace Sheets.
- Do not make flags more complex than necessary.
- Do not edit generated dashboard config files directly.

## Source Of Truth

- Google Sheets `Students` = operational school truth
- `lib/config/students-registry.js` = portal/dashboard registry truth
- MMS = lesson and billing-profile operational truth
- MMS calendar category `Free` = current real free-slot truth
- Stripe = payment-provider truth
- `Schedule_Context` = dashboard cache of selected MMS lesson context
- `Parent_Understanding_State` = dashboard workflow state for parent check-in campaign records
- `Planning_Items` = dashboard-owned human planning/task/initiative state
- `Planning_Progress_Log` = append-only progress history for planning items
- `Pause History` = intentional pause-window truth
- generated FC tabs and generated dashboard config files = derived outputs

## Read Order

1. `docs/admin/CURRENT_STATUS.md`
2. `docs/admin/V3_LOOP_ARCHITECTURE.md`
3. `docs/admin/INDEX.md`
4. `docs/admin/ADMIN_IMPLEMENTATION_LOG.md`
5. `docs/admin/OWNERSHIP_MATRIX.md`
6. `docs/admin/SCHOOL_POLICY.md`
7. `docs/admin/PAYMENTS_RULES.md` if working on Stripe or pauses

Treat V1/V2 drafts and session handoff files as historical unless this file points to them.
