# Admin Dashboard Implementation Log

This file tracks the admin dashboard build so work can be handed between agents cleanly.

## 2026-05-29 — Parent Understanding Workflow

### Scope
- Add a first testable workflow page for Fenella to call parents, check understanding of key school systems, capture feedback, and leave a clear follow-up state.
- Keep the workflow manual and approval-first. This is not WhatsApp automation, a CRM replacement, or a tutor-notification system.

### What changed
- Added `/admin/workflows/parent-understanding`.
- Added a Workflows hub card for Parent Understanding.
- Added `POST /api/admin/parent-understanding`.
- Added `Parent_Understanding_State` as a managed Google Sheets tab.
- Added parent-understanding helpers for:
  - workflow/loop status normalisation
  - four-area understanding score
  - practical risk signal derivation
  - deterministic summary generation
- Added focused helper tests in `tests/admin/parent-understanding-helpers.test.mjs`.
- The page shows:
  - student/parent/tutor/schedule/instrument/lifecycle context
  - call status and loop status
  - understanding checks for cancellations/holidays, dashboard/Soundslice, practice notes, and showcases
  - WhatsApp group understanding and community-group status
  - parent feedback and tutor/action relevance
  - next-action guidance
  - copyable WhatsApp templates
  - editable summary and save action

### Operational notes
- `Parent_Understanding_State` is dashboard workflow state, one row per student.
- Student/contact truth still comes from existing Sheets/MMS/registry data.
- Practice notes are assumed to go to the parent email in MMS.
- Contact-detail problems should be flagged for Fenella/admin follow-up; this workflow does not edit MMS yet.
- WhatsApp templates are copied for human sending. No WhatsApp API send is wired.
- Wider community-group absence is treated as follow-up unless intentionally declined or not relevant.
- Consequential saves append to `Event_Log` when the workflow status is `completed`, `needs_follow_up`, or `escalate_to_admin`.

### Manual checks before handoff to Fenella
- Open `/admin/workflows/parent-understanding`.
- Test one clean/completed parent record.
- Test one practice-notes-not-received record and confirm the next action points to MMS parent email follow-up.
- Test one not-in-community-group record and confirm the community invite/template are useful.
- Reload the page and confirm saved state returns from `Parent_Understanding_State`.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-18 — Manual Waiting Free-Slot Refresh

### Scope
- Let admins immediately check newly created MMS `Free` slots from the waiting-list placement surface.
- Keep normal page loads cheap by preserving cached MMS reads.

### What changed
- Added `getWaitingStudentsWithCapacity()` as a shared loader for waiting students plus capacity matches.
- Added `POST /api/admin/waiting/capacity` to force-refresh MMS `Free` slots and recalculate waiting-list capacity hints.
- Added a `Refresh free slots` button to `/admin/waiting`.
- Waiting cards update in place after refresh while preserving locally edited waiting note/status values.

### Operational notes
- MMS remains the source of truth for real free slots.
- Refreshing free slots does not reserve slots, assign tutors, onboard students, or write capacity data.
- Keep this as an explicit refresh rather than automatic polling.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-16 — Waiting Cards MMS Context

### Scope
- Reduce the messy split between waiting-list placement decisions and onboarding execution.
- Keep `/admin/waiting` useful before a student is ready to onboard.

### What changed
- Waiting-list MMS rows now carry:
  - parent/contact phone when MMS returns it
  - raw MMS note text
  - parsed note facts such as age, experience, genres, songs, and instrument source
- Waiting cards show parent phone alongside parent name/email.
- Waiting cards show MMS sign-up context directly on the card.
- Full MMS notes are available behind a collapsed detail toggle.

### Operational notes
- `/admin/waiting` should be the place to decide contact/placement.
- `/admin/onboard` should remain the execution form once the student is ready to be created across Sheets, registry, MMS, and portal setup.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-16 — V4.1 Scalable Navigation

### Scope
- Keep the admin top nav short enough to survive V4 growth.
- Treat student records as searchable context rather than a primary operating mode.

### What changed
- Changed the top nav to four stable modes:
  - Overview
  - Issues
  - Workflows
  - Planning
- Added a persistent header student search that lands on `/admin/students?q=...`.
- Turned `/admin/students` into a lookup route with filtering by name, tutor, instrument, email, phone, or MMS ID.
- Added `/admin/workflows` as a hub for Waiting List, Onboarding, Showcase, and Holidays.
- Added `/admin/planning` as a hub for Capacity, Holidays, Showcase, and future planning layers.

### Operational notes
- Student detail pages remain central to context, but most users should arrive there from a search, issue, or workflow.
- Keep future top-level nav additions rare. Prefer adding items inside Workflows or Planning unless the area is a true operating mode.

### Validation
- `npm run test:admin` passes
- `npm run build` passes, with existing slow static-generation retry warnings on some admin/static pages

## 2026-05-16 — V4.1 Performance And Navigation Pass

### Scope
- Start improving dashboard speed and information architecture without changing core workflows.
- Reduce repeated MMS calendar calls now that Capacity and Waiting both use Free-slot context.

### What changed
- Added `getMmsFreeCalendarSlotContext()` with a short-lived server-side cache for MMS calendar events marked `Free`.
- Kept `getMmsFreeCalendarSlots()` as a compatibility wrapper so existing code can still request only the slot array.
- Updated `/admin/capacity` to show whether Free-slot data came from a fresh MMS refresh or the cache.
- Updated `/admin/waiting` to use the same cached Free-slot context for capacity hints.
- Grouped admin navigation into daily operating pages and planning tools:
  - daily: Overview, Students, Waiting, Issues
  - planning: Capacity, Showcase, Holidays

### Operational notes
- The cache is process-local and intentionally short-lived. It reduces repeat MMS calls while navigating the dashboard, but it is not a durable source of truth.
- MMS remains the source of truth for real free slots.
- This is the first V4.1 pass only. Further speed work should focus on expensive overview health checks and any cohort-wide calls that still run automatically.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-16 — Waiting List Capacity Hints

### Scope
- Connect MMS free-slot capacity to the waiting-list workflow without adding booking automation.
- Keep instrument matching explicit and deterministic.

### What changed
- `/admin/waiting` now parses instrument interest from the MMS sign-up note.
- Waiting cards show parsed instruments near the student metadata.
- Waiting cards show a `Possible slots` panel with up to three matching weekly free slots.
- Matching requires:
  - a parsed waiting-list instrument
  - an MMS `Free` calendar slot
  - a tutor whose configured instrument list includes that instrument
- If the instrument cannot be parsed, the card says that instead of guessing.

### Operational notes
- These are hints only. They do not reserve slots, assign tutors, send messages, or change onboarding state.
- Current matching does not rank by student preference, age, or best tutor fit. It only filters by instrument compatibility.
- Day/time preference parsing should only be added if MMS notes are consistent enough to support it safely.

### Validation
- `node --test tests/admin/capacity-helpers.test.mjs` passes
- `npm run test:admin` passes

## 2026-05-15 — Capacity View From MMS Free Slots

### Scope
- Start the capacity context layer without adding a new manual availability database.
- Keep student schedule hardening visible while beginning tutor capacity work.

### What changed
- Added `/admin/capacity` to the admin nav.
- Added a read-only MMS free-slot view:
  - searches upcoming calendar events
  - filters to event category `Free`
  - excludes events already linked to students
  - groups counts by tutor
  - lists the next available slots
- Added schedule-cache health cards on the same page:
  - cached students
  - found/missing schedules
  - stale or unchecked records
  - low-confidence rows
  - shared slot groups
  - missing teacher/duration edge cases

### Operational notes
- MMS category `Free` is the current source for real tutor availability.
- Do not add a `Tutor_Availability` Sheets tab for current slots unless MMS proves incomplete.
- Future-hire or tentative capacity may still need a separate overlay later, but it should not be mixed into the real MMS free-slot source.

### Validation
- `node --test tests/admin/capacity-helpers.test.mjs` passes
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-15 — V4 Context Layers + Shared Group Pricing

### Scope
- Add lightweight V4 context without introducing a new editable lifecycle state machine or database.
- Keep schedule and payment value context explainable and cached.
- Fix shared group lesson pricing where MMS schedule context is more reliable than explicit group fields.

### What changed
- Added derived lifecycle context for student detail and relevant issue cards.
- Added MMS schedule context cached in the `Schedule_Context` Sheets tab.
- Added baseline payment value context using cached duration and current school pricing.
- Added shared-slot enrichment for cached MMS schedules:
  - students with the same teacher, next lesson start, and duration are treated as sharing a lesson slot
  - shared 45 minute slots derive group pricing at `£20/week` per student
  - student detail shows when a cached schedule slot is shared and lists the other names
- Emily Grifa / Nina Gavlin is the motivating edge case: both share a 45 minute group slot, so the dashboard should not price either as a one-to-one 45 minute lesson.

### Operational notes
- Lifecycle and payment value context are read-only. They do not change issue generation, onboarding writes, Stripe actions, or payment mutations.
- Schedule context is cached. Refresh from MMS when a student is new or the lesson slot changes, or use the bulk refresh route when a cohort-wide cache pass is needed.
- Shared group pricing depends on `Schedule_Context` having both students' current MMS lesson rows. If only one student has a cached row, the dashboard will fall back to one-to-one unless an explicit group marker exists.

### Validation
- `node --test tests/admin/payment-value-helpers.test.mjs tests/admin/schedule-context-helpers.test.mjs` passes
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-14 — Waiting-List Closeout + Handover Consolidation

### Scope
- Close the waiting-list loop when onboarding succeeds.
- Make current admin handover context durable inside the dashboard repo rather than relying on local-only workspace docs.

### What changed
- Successful onboarding now marks matching waiting-list records as `onboarded`.
- Sibling-group onboarding closes both waiting records.
- Existing waiting notes are preserved and an auto-close line is appended.
- Waiting closeout appends an `Event_Log` row with `waiting_onboarded_by_onboarding`.
- Onboarding success UI confirms which MMS IDs were marked onboarded.
- Waiting closeout failures are shown as warnings without hiding a successful onboarding run.
- Added `docs/admin/CURRENT_STATUS.md` as the tracked current-status entrypoint for future agents.
- Updated dashboard README and docs indexes so `CURRENT_STATUS.md` is the durable first stop for current admin work.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-04-27 — V2 Safety + Automation Start

### What changed
- Added onboarding preflight support:
  - `POST /api/admin/onboard/preflight`
  - UI preflight panel on `/admin/onboard`
  - live checks for Sheets, registry, MMS activation, billing profile, and lesson-slot collisions
- Hardened MMS onboarding behavior so idempotent states are tracked cleanly:
  - already-active student => activation step marked as skipped/ready
  - existing billing profile => billing step marked as skipped/ready
  - matching lesson/series already in MMS => lesson step marked as skipped/ready
- Removed the production build dependency on `next/font/google` in `app/layout.js`.
- Started the V2 architectural cleanup for tutor ownership:
  - added generated tutor data file: `lib/admin/tutors-data.js`
  - added sync script: `npm run sync-admin-tutors`
  - canonical tutor source now comes from `../first-chord-brain/generate_fc_ids.py`
  - fixed canonical Chloe mapping in Brain to `singing + piano`
- Added first hosted-job workflow:
  - `.github/workflows/generate-configs.yml`
  - runs `npm run generate-configs` on pushes to `lib/config/students-registry.js`
  - commits regenerated config files back to the repo automatically

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-08 — Showcase Workflow Surface

### Scope
- Add the first recurring non-student workflow surface inside the admin dashboard.
- Treat the student showcase process as part of the dashboard’s operating model rather than as an external memory-based checklist.

### What changed
- Added `/admin/showcase` as a real admin workflow page.
- Added persistent checklist state stored in the `Showcase_Task_State` Google Sheets tab.
- Added copy-to-clipboard controls for the core reusable message templates.
- Added seasonal showcase asset links for:
  - poster templates
  - Eventbrite banner templates
  - Eventbrite/manage link
  - performer form
  - running-order Canva
  - collage Canva
- Refined the page structure so that:
  - the checklist is reserved for true done/not-done actions
  - softer planning/judgement items appear as guidance notes instead
  - long reference sections (`Linked Assets`, `Key Timings`, `Core Messages`) are collapsible

### Why this matters
- This is the first example of the dashboard acting as a recurring operations workbench beyond student records, onboarding, and flags.
- It creates a cleaner pattern for future workflow templates:
  - persistent state
  - linked assets
  - reusable copy
  - lightweight operational structure

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-02 — Live Stripe Snapshot (Manual Per Student)

### Scope
- Start live Stripe comparison without turning the admin dashboard into a cohort-wide Stripe poller.
- Reuse the Payment Pause Stripe model, but keep the first admin read path manual and per-student to control hosting cost.

### What changed
- Added a manual Stripe snapshot route:
  - `GET /api/admin/students/[mmsId]/stripe`
- Added normalized Stripe snapshot helpers for:
  - customer found
  - subscription found
  - subscription status
  - pause state
  - actively billing
  - latest invoice status
  - latest payment intent status
  - last checked timestamp
- Added rule evaluation for first live Stripe mismatch types:
  - `ACTIVE_WITHOUT_SUBSCRIPTION`
  - `SUBSCRIPTION_CANCELLED_UNEXPECTEDLY`
  - `SUBSCRIPTION_STATE_MISMATCH`
  - `INACTIVE_STILL_BILLING`
  - `PAYMENT_FAILED`
- Added a manual `Refresh Stripe status` panel to the admin student detail page.

### Why this matters
- This gives live Stripe truth without making `/admin/flags` or `/admin/students` expensive on every page load.
- It keeps the Stripe rules explicit and deterministic, which is important for future smaller-agent or local-model assistance.
- It creates the reusable snapshot layer that can later be promoted into:
  - scheduled sync
  - cached issue generation
  - webhook-backed payment monitoring

### Operational note
- This route requires `STRIPE_API_KEY` in the dashboard environment.
- The intent is to reuse the same Stripe access model as `payment-pause-pwa`, but not yet to centralize all Stripe reads through that app.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-02 — Pause History Read Path

### Scope
- Make intentional pauses visible in the admin student model before comparing live Stripe state.
- Reuse `Pause History` from the First Chord Database sheet as the business source for pause intent.

### What changed
- Added `Pause History` sheet reads to the admin server-side data layer.
- Added pause-history normalization and derived pause summary helpers.
- Added a `Pause state` section to the student detail page showing:
  - currently paused or not
  - latest pause start
  - latest pause end
  - latest stored Stripe pause status
- Matching works by Stripe subscription ID first, then by email fallback.

### Why this matters
- The dashboard now has a real pause-intent layer before live Stripe mismatch rules are added.
- Future Stripe checks can suppress warnings for correctly paused students using business-recorded pause state rather than raw Stripe facts alone.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-02 — Payment Expectation Field

### Scope
- Add a separate expected-payment-state field before implementing live Stripe status comparison.
- Keep `payment_mode` and `payment_expectation` distinct so smaller agents and cheap rule checks can reason deterministically.

### What changed
- Added `paymentExpectation` support to the admin student model and student edit API.
- Added a `Payment expectation` dropdown to the student detail page with:
  - `setup_pending`
  - `stripe_active_expected`
  - `stripe_paused_expected`
  - `inactive_or_stopped`
- Added conservative fallback logic:
  - `stripe` → `stripe_active_expected`
  - `unknown` → `setup_pending`
  - `manual` → blank / not forced
- Surfaced `paymentExpectation` in issue details for future Stripe mismatch work.

### Why this matters
- The dashboard now has a clear “what should Stripe look like?” field rather than inferring everything from payment mode.
- This is the rule anchor needed before live Stripe failure, pause, and cancellation checks are added.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-02 — Initial Stripe Review Issues

### Scope
- Surface the first safe Stripe-related admin issues using existing sheet data only.
- Avoid false alarms for approved manual-payment exceptions.

### What changed
- Added payment-derived issue generation on `/admin/flags` for students with `payment_mode = stripe`.
- Current issue types:
  - `STRIPE SETUP INCOMPLETE`
  - `STRIPE CUSTOMER MISSING`
  - `STRIPE SUBSCRIPTION MISSING`
- Added Stripe-aware issue filters and current-state display:
  - payment mode
  - Stripe customer ID
  - Stripe subscription ID

### Why this matters
- The admin dashboard can now catch the first class of Stripe setup gaps without needing live Stripe API integration yet.
- Manual-payment students are excluded from Stripe warnings by design.
- This creates a clean bridge toward later live Stripe failure and cancellation detection.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-02 — Payment Mode Foundation

### Scope
- Add an explicit payment-mode concept to the admin student model before live Stripe issue detection.
- Keep `Students` sheet as the canonical source for payment linkage and payment-mode state.

### What changed
- Added `paymentMode` support to the admin student model and student edit API.
- Added a `Payment mode` dropdown to the student detail page with:
  - `stripe`
  - `manual`
  - `unknown`
- Added fallback logic for known non-Stripe exceptions when the sheet value is blank.
- Improved Sheets writes so missing headers such as `payment_mode` can be created automatically instead of silently dropping new canonical fields.

### Why this matters
- Stripe issue detection now has a clean policy boundary:
  - normal students should be checked against Stripe
  - approved cash/bank-transfer exceptions should not create false alarms
- The admin UI can now express payment intent explicitly instead of inferring everything from Stripe IDs alone.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-05-02 — Review Flags Freshness + Admin Health

### Scope
- Make `Review_Flags` freshness visible in the admin UI.
- Add a lightweight operational health panel on the admin home page.
- Reduce hidden staleness around MMS and the two hosted workflows now involved in the admin/dashboard pipeline.

### What changed
- Added a `Review flags freshness` panel to `/admin/flags` driven by live `generated_date` values.
- Added freshness classification states:
  - `Fresh`
  - `Aging`
  - `Stale`
  - `Unknown`
- Added an admin home `Operational health` section covering:
  - MMS API health
  - latest `generate-configs` workflow status
  - latest `regenerate-fc-ids` workflow status
  - latest review-flags freshness state
- Added supporting health helpers and tests.

### Why this matters
- Admins can now see when `Review_Flags` are current versus stale.
- The dashboard makes the hidden automation chain more legible:
  - admin write
  - config generation
  - FC regeneration
- This is a cleaner foundation before adding persistent issue state and Stripe-related issue detection.

### Validation
- `npm run test:admin` passes
- `npm run build` passes

### Notes for next handover
- Tutor drift is now reduced, but only if future tutor changes are made in Brain and then synced into the dashboard via `npm run sync-admin-tutors`.
- The `generate-configs` GitHub Action will not run until these changes are pushed to GitHub.
- The V2 spec document still contains some now-resolved “current gaps”; update it before the next planning pass if you want it to reflect the latest implementation state exactly.

## 2026-04-16

### Scope for initial slice
- Keep existing tutor/student dashboard behavior unchanged.
- Add admin functionality as an isolated surface under `/admin`.
- Add admin-only server code under `app/api/admin/*` and shared helpers under `lib/admin/*`.
- Start with auth scaffolding and read-only admin pages before any write flows.

### Discovery findings
- App already uses Next.js App Router.
- No existing auth or middleware is present, which lowers integration risk.
- Existing dashboard routes are self-contained and can remain untouched.
- `lib/config/students-registry.js` is the manual portal-config source.
- Generated config files should remain untouched in the first slice.

### Guardrails
- Do not refactor existing student/tutor routes as part of admin V1.
- Scope middleware to `/admin` and `/api/admin` only.
- Keep admin logic isolated in `lib/admin/*`.
- Treat any browser-triggered writes as out of scope until read-only flows are stable.

### Progress update
- Installed `next-auth` for admin-only Google login.
- Added isolated admin auth config under `lib/admin/auth.js`.
- Added admin-only middleware matcher for `/admin/*` and `/api/admin/*`.
- Added read-only admin Sheets/registry helpers under `lib/admin/*`.
- Added first admin pages:
  - `/admin/login`
  - `/admin`
  - `/admin/students`
  - `/admin/students/[mmsId]`
- Added read-only admin API routes for students and flags.

### Notes for next handover
- This slice is additive only; existing tutor/student routes were not intentionally modified.
- Admin data reads depend on env-based Google Sheets credentials:
  - `GOOGLE_SPREADSHEET_ID`
  - `SHEETS_REFRESH_TOKEN`
  - `SHEETS_CLIENT_ID`
  - `SHEETS_CLIENT_SECRET`
- Admin auth depends on:
  - `NEXTAUTH_SECRET`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `ADMIN_ALLOWED_EMAILS`

### Validation
- `npm run build` passes after the initial admin slice was added.
- Build output confirms new routes are isolated under `/admin` and `/api/admin`.

### Important implementation note
- `lib/config/students-registry.js` is not safe to import directly in the admin slice because some names contain raw apostrophes that break parsing as JS.
- Admin registry reads now parse the file as text from disk instead of importing it as a module.
- This avoids touching the production registry format in the first slice.

### Remaining limitations after this slice
- Admin pages are read-only.
- No waiting list, onboarding, or edit flows yet.
- Auth requires env configuration before `/admin` can be used interactively.
- Next.js still emits pre-existing metadata viewport warnings from the app layout metadata export.

## 2026-04-16 — Student Detail Edit Flow

### Scope for second slice
- Add editable student detail flow before onboarding.
- Keep writes split by lane:
  - Sheets lane for identity/contact/lesson fields
  - registry lane for Soundslice + Theta fields
- Keep Stripe and FC IDs read-only.

### What changed
- Added Sheets row update helper in `lib/admin/sheets.js`.
- Added local-dev registry update helper in `lib/admin/registry.js`.
- Added lane-aware admin update orchestrator in `lib/admin/students.js`.
- Added `PATCH /api/admin/students/[mmsId]` with basic validation.
- Replaced the read-only detail view with editable client form in `components/admin/AdminStudentDetailClient.js`.

### Important behavior
- Registry writes are local-development-only in this slice.
- If `GITHUB_TOKEN` is present or the app is running in production, registry writes intentionally throw until the GitHub API path is implemented.
- This keeps local testing possible without pretending the production write path exists yet.

### Validation
- `npm run build` passes after the edit flow was added.
- Attempted `npm run dev` local smoke test, but sandbox prevented binding to localhost (`listen EPERM`), so no interactive browser test was possible from within Codex.

### Next likely step
- Manual local browser test by user on `/admin/login`, `/admin`, `/admin/students`, and one student detail page.
- Then either:
  - implement `/admin/waiting`, or
  - implement production-safe registry writes via GitHub API before onboarding.

## 2026-04-17 — Data Merge Fixes + Production Registry Path

### Bugs found during local testing
- Registry-lane values (`soundsliceUrl`, `thetaUsername`) appeared to disappear after save.
- `instrument` was blank for all students.
- `fcStudentId` was blank in the top-level admin student record.

### Root causes
- Registry parser was not treating lines like `}, // Student Name` as the end of an entry, so registry entries were effectively parsing as `null`.
- The Sheets `Students` tab does **not** contain an `Instrument` column.
- The Sheets `Students` tab does **not** expose `FC Student ID` in the current live header set.

### Fixes applied
- Updated `lib/admin/registry.js` parser to handle entry endings with inline comments.
- Updated `lib/admin/students.js` to fall back to registry values for:
  - `instrument`
  - `fcStudentId`

### Production registry write path
- Added `lib/admin/github.js` for GitHub Contents API access.
- In production:
  - registry reads use GitHub Contents API when `GITHUB_TOKEN` is present
  - registry writes use GitHub Contents API (`PUT /contents/...`)
- In local development:
  - registry reads/writes still use the local file

### Important notes
- This matches the intended V1 architecture:
  - local dev can iterate quickly
  - deployed admin can update the registry lane without shell access
- The GitHub API update message is currently generic:
  - `chore: update student registry via admin dashboard`
  - this can be made more descriptive later

### Validation
- Build passed after these changes.
- Local testing confirmed:
  - admin auth works
  - overview counts load
  - student detail pages load
  - Sheets-lane writes persist
  - registry-lane values now display correctly

## 2026-04-17 — Waiting List + Onboarding Scaffold

### Scope
- Add a read-only admin waiting list based on MMS `Waiting` students.
- Wire the waiting list into an onboarding page scaffold without adding onboarding writes yet.

### What changed
- Added `lib/admin/mms.js` for isolated admin MMS access.
- Added `GET /api/admin/waiting`.
- Added `/admin/waiting` page with:
  - student name
  - date added
  - age in days
  - parent name/email
  - aging badge colors (green / amber / red)
  - `Onboard` link into `/admin/onboard?mmsId=...`
- Added `/admin/onboard` scaffold page that:
  - accepts `mmsId`
  - loads the selected waiting-list record
  - shows the selected student context
  - documents the next onboarding implementation slice

### Important notes
- The admin waiting-list flow is intentionally separate from the older dashboard MMS client.
- The admin MMS helper reads `MMS_BEARER_TOKEN` from env and uses the Brain-style request pattern.
- Current onboarding page is **not** a write flow yet; it is only a scaffold with preselected context.

### Validation
- Build passed after the waiting-list and onboarding scaffold were added.
- New build output includes:
  - `/admin/waiting`
  - `/admin/onboard`
  - `/api/admin/waiting`

### Next likely step
- Implement the actual onboarding form and submission flow:
  1. prefill from waiting-list student
  2. collect tutor / lesson details / Soundslice / Theta
  3. write Sheets lane
  4. write registry lane
  5. show manual WGCS checklist output

## 2026-04-17 — Full Onboarding Form

### Scope
- Turn `/admin/onboard` from a scaffold into a working onboarding flow.
- Prefill richer MMS detail fields beyond the basic waiting-list row.

### What changed
- Added `lib/admin/tutors.js` with the Brain tutor roster duplicated for V1.
- Added `lib/admin/fc.js` for:
  - instrument normalisation
  - experience-level normalisation
  - FC student ID generation
  - friendly URL generation
- Expanded `lib/admin/mms.js` with:
  - student detail fetch
  - MMS note parsing
  - first-lesson creation
- Added `addStudentSheetRow()` to `lib/admin/sheets.js`.
- Added `appendRegistryEntry()` to `lib/admin/registry.js`.
- Added `POST /api/admin/onboard`.
- Added `components/admin/AdminOnboardForm.js`.
- Updated `/admin/onboard` to:
  - prefill from waiting-list student
  - show parsed MMS form data
  - collect tutor / lesson / portal fields
  - submit onboarding
  - show WGCS/manual output after success

### Current onboarding behavior
- Prefills:
  - student + parent names
  - email
  - contact number
  - age
  - instrument
  - experience
  - interests / songs
  - raw MMS note
- On submit:
  1. writes the Sheets lane
  2. creates first lesson in MMS
  3. appends to registry lane
  4. returns WGCS outputs:
     - WhatsApp group label
     - welcome message
     - Soundslice follow-up

### Important limitations
- Post-success reminders are still manual:
  - run `python3 generate_fc_ids.py` in `first-chord-brain`
  - run `npm run generate-configs && git push` in this repo
- No GitHub API registry append dedupe yet beyond friendly URL uniqueness.
- Date/time parsing for lesson creation currently relies on browser-entered values being parseable by JS `Date`.

### Validation
- Build passed after the onboarding flow was added.
- New build output includes:
  - `/admin/onboard`
  - `/api/admin/onboard`

### Next likely step
- Manual local testing of one onboarding run from `/admin/waiting`.
- Then tighten validation/error handling around:
  - lesson date parsing
  - duplicate student protection
  - registry append conflict handling

## 2026-04-18 — Onboarding Scheduling + MMS Failure Handling

### Scheduling input cleanup
- Replaced free-text lesson scheduling with structured fields:
  - `First lesson date` uses a date input
  - `Lesson time` uses a time input
  - `Lesson day` is derived automatically from the selected date
  - `Lesson length` is now a dropdown
- This removed the earlier JS `Date` parsing failures from ambiguous free-text input.

### MMS lesson creation handling
- Updated admin onboarding so that:
  1. Sheets lane write succeeds first
  2. registry append succeeds second
  3. MMS lesson creation is attempted last as a best-effort step
- If MMS lesson creation fails:
  - onboarding still returns success
  - the UI shows a warning with the MMS error details
  - manual follow-up can be done in MMS without re-running the whole onboarding flow

### MMS payload update
- Switched the MMS lesson payload closer to the real event shape captured from My Music Staff:
  - `StudentIDs`
  - `TeacherID`
  - `OriginalTeacherID`
  - `StartDate`
  - `Duration`
  - `EventCategoryID`
  - other event flags matching the captured structure
- Error handling now includes the MMS response body where available, instead of only the HTTP status code.

### Important remaining limitation
- The exact successful MMS create endpoint is now confirmed from browser capture:
  - `POST ${MMS_BASE_URL}/calendar/event`
- The payload shape also matches the captured request:
  - `StudentIDs`
  - `TeacherID`
  - `OriginalTeacherID`
  - `StartDate`
  - `Duration`
  - `EventCategoryID`
  - `RepeatDetails: null`

## 2026-04-18 — MMS Activation + Billing Profile Setup

### New MMS onboarding sequence
- Admin onboarding now attempts the real upstream MMS sequence before lesson creation:
  1. activate the student in MMS
  2. ensure a billing profile exists for the selected tutor
  3. create the first calendar event

### Endpoints now wired from live browser captures
- Student activation:
  - `PUT /students/{studentId}`
  - payload includes `Status: "Active"` plus the student’s existing profile fields
- Billing profile create:
  - `POST /billingprofiles`
  - payload includes:
    - `BillingRate`
    - `DefaultBillingMode`
    - `EventCategoryID`
    - `LessonDuration`
    - `StudentID`
    - `TeacherID`
- Billing profile search:
  - `POST //search/billingprofiles?fields=ScheduledMakeupMinutes`
  - used to avoid blindly creating duplicates for a tutor that already has one
- Lesson creation:
  - `POST /calendar/event`

### Current behavior
- MMS steps are still soft-fail:
  - onboarding can still succeed if an MMS step fails
  - UI now shows which upstream MMS stages completed:
    - activation
    - billing profile readiness
    - lesson creation

### Current defaults
- Billing profile creation defaults:
  - `DefaultBillingMode: "PerLesson"`
  - `BillingRate: 30` unless `MMS_DEFAULT_BILLING_RATE` is set
  - `EventCategoryID: ect_5cxpJ9` unless `MMS_BILLING_EVENT_CATEGORY_ID` is set
- Lesson creation still uses `MMS_FIRST_LESSON_EVENT_CATEGORY_ID` if provided, otherwise falls back to the billing profile event category.

## 2026-04-18 — Automated Admin Test Coverage

### Test runner
- Added a lightweight admin test suite using Node's built-in test runner:
  - `npm run test:admin`

### Covered logic
- `lib/admin/fc-helpers.mjs`
  - instrument normalization
  - experience normalization
  - deterministic FC student ID generation
- `lib/admin/registry-helpers.mjs`
  - parsing registry entries with inline closing comments
  - safe targeted block updates
- `lib/admin/sheets-helpers.mjs`
  - spreadsheet column naming
  - tutor-block insertion logic for the Students sheet
- `lib/admin/mms-helpers.mjs`
  - MMS note parsing
  - structured lesson date/time handling
  - billing-profile payload shape
  - calendar-event payload shape
  - MMS error body formatting

### Current status
- `npm run test:admin` passes
- `npm run build` still passes with the helper extraction in place

### Purpose
- This covers the admin bugs we already hit in development:
  - registry entries appearing to disappear because of parser issues
  - tutor-section insertion into the wrong Sheets block
  - fragile date/time parsing
  - MMS payload drift from the live API shape

## 2026-04-18 — Flags & Issues V1

### Scope
- Added a real admin issues page at `/admin/flags`.
- Uses the live `Review_Flags` Google Sheets tab rather than placeholder data.

### What it shows
- Current review-flag types:
  - `TUTOR CONFLICT`
  - `SHEETS ONLY`
  - `REGISTRY ONLY`
- For each issue:
  - severity
  - systems affected
  - human-readable summary
  - recommended next action
  - linked student/record state where available
  - direct link into the student record when a Sheets row exists

### Why this matters
- This is the first real admin triage surface rather than just a data viewer.
- It is designed to become the future queue for:
  - human review
  - bounded agent triage
  - later communication triggers (e.g. WhatsApp-ready issue types)

### Current limitations
- V1 is read-only triage only.
- It does not yet support:
  - resolving/ignoring issues in the UI
  - assignment/ownership
  - messaging actions
  - issue state persistence beyond the live review flags tab

## 2026-04-18 — Ownership Matrix

### What changed
- Added `OWNERSHIP_MATRIX.md` as the current admin ownership reference.
- This is now the compact reference for:
  - action ownership
  - field ownership
  - current V1 boundaries
  - future direction

### Why it matters
- It gives future agents and humans one quick place to answer:
  - where a change should be made
  - which layer is canonical
  - which fields are directly editable vs derived

### Usage note
- Read it alongside:
  - `ADMIN_BRIEF.md`
  - `ADMIN_IMPLEMENTATION_LOG.md`
  - `../first-chord-brain/DATA_DICTIONARY.md`

## 2026-04-19 — Onboarding Hardening: Step Tracking

### Scope
- Harden the highest-risk admin action (`/admin/onboard`) without changing the core V1 architecture.
- Make partial failures legible and safer to recover from.

### What changed
- Added explicit onboarding step tracking for:
  - duplicate check
  - Sheets write
  - registry write
  - MMS activation
  - MMS billing profile
  - MMS first lesson
- API responses from `POST /api/admin/onboard` now include structured `steps` and `recoveryGuidance`.
- Exact duplicate blocks (`409`) now return step state and recovery guidance instead of only a flat error string.
- The onboarding UI now renders:
  - step-by-step success/failure/skipped cards
  - duplicate warnings
  - recovery guidance for both failure and partial-success cases

### Why this matters
- Onboarding is a multi-step cross-system action and is currently the highest-value hardening target.
- This makes partial success visible instead of opaque.
- It gives future humans/agents a clearer recovery path after failures.

### What this does not solve yet
- Full idempotency
- Automatic retry orchestration
- Safe lesson deduplication after uncertain MMS outcomes
- Rollback across systems

### Validation
- `npm run test:admin` passes
- `npm run build` passes

## 2026-04-19 — Onboarding Completion + Recurring Lessons

### Scope
- Push onboarding closer to a real operational end state before stepping back for V2 planning.
- Improve visibility of what is actually complete versus still pending after onboarding finishes.
- Support recurring weekly MMS lessons instead of one-off events only.

### What changed
- Added recurring lesson support to the MMS event payload:
  - weekly `RepeatDetails`
  - weekday derived from the selected first lesson date
  - onboarding form toggle for recurring vs one-off lesson creation
- Added onboarding completion status output with separate tracked states for:
  - canonical record completion
  - MMS operational completion
  - FC identity refresh pending
  - portal activation pending
- Reframed the old static manual reminder into a status-based completion model.

### Why this matters
- The dashboard can now create a more realistic ongoing lesson setup in MMS.
- Users can see the difference between:
  - what is already operationally finished
  - what is still a V1 manual follow-up
- This creates a cleaner bridge into V2 job/status automation.

### Remaining V1 limitation
- The last two post-onboarding jobs are still manual:
  - `python3 generate_fc_ids.py` in `first-chord-brain`
  - `npm run generate-configs && git push` in this repo
- These are now represented as explicit pending completion states rather than hidden in a text paragraph.

### Validation
- `npm run test:admin` passes
- `npm run build` passes
