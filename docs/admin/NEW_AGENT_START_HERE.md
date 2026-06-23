# New Agent Start Here — Admin Dashboard

Last updated: 2026-06-23

This is the practical handoff note for a new Codex/AI agent working on the First Chord admin dashboard.

## Paths

- Repo: `/Users/finnlemarinel/Desktop/FirstChord/music-school-dashboard`
- Obsidian vault: `/Users/finnlemarinel/FirstChordOS`
- Obsidian OS docs: `/Users/finnlemarinel/FirstChordOS/docs/obsidian`
- Canonical admin/API Railway app: `https://first-chord-dashbord-production.up.railway.app`
- Legacy/public tutor-student dashboard Railway app: `https://efficient-sparkle-production.up.railway.app`
- Practice Chat speech relay Railway app: `https://enhanced-music-lesson-notes-production.up.railway.app`

Railway service map:

- `pure-spontaneity` / `first-chord-dashbord` = canonical admin/API runtime. Use this for `/admin`, Practice Chat writebacks, Gmail sends, Sheets writes, Stripe scans, schedule refresh cron, and internal operating-system work.
- `efficient-sparkle` = legacy/public tutor-student dashboard runtime. `/dashboard` works here, but `/admin` is not fully configured and should not be used for admin/API writebacks.
- `awake-connection` / `enhanced-music-lesson-notes` = Practice Chat speech/Whisper relay.

## First Checks

```bash
git status --short --branch
git log --oneline -5
npm run test:admin
npm run build
```

Use `npm run dev` for local testing. Next may choose another port if `3000` is already in use.

## Current Direction

V3 closed loops. V4 is adding context layers.

Current operating principle:

Detected → Guided → Actioned → Logged → Resolved / Kept Active

Recent V4 layers include:

- derived student lifecycle context
- MMS schedule context
- payment value context
- MMS Free-slot capacity context
- clickable waiting-list capacity slots into onboarding
- first-name learner labels in onboarding message copy
- parent understanding workflow at `/admin/workflows/parent-understanding`
- lightweight Planning/Brain inbox at `/admin/planning`
- Planning Meeting view with a seeded Friday reflection prompt; entries append to `Planning_Progress_Log` for future monthly/quarterly summaries
- student-linked planning items visible from student detail pages
- pause planning cards with a guarded `Mark pause completed` path that logs confirmation, aligns `payment_expectation`, and closes the planning task
- Monday scheduling loop that turns Friday reflections into dated work
- calm Due Now view for meeting/day-of action
- schedule cache health and scheduled schedule refresh
- communication record layer for copied parent messages
- Practice Chat note ownership: sent/completed First Chord notes are now read by portals before MMS fallback
- calmer `/admin` overview: front-page cards now need to earn attention by representing today's work, near-term action, or deliberate school-improvement prompts
- copy/tone layer: `docs/admin/COPY_AND_TONE.md` captures the dashboard's current voice and the rule that wording should reduce cognitive load
- `Work on the school notes` inside Planning: learning notes and strategic notes use existing `Planning_Items`/`Planning_Progress_Log`, with open transcript-summary bodies and optional linked actions

## Operators (who uses what)

The docs describe the system but not who runs each part. This is a starting map inferred from existing docs — **FINN TO CONFIRM/CORRECT**, as roles are not authoritatively recorded elsewhere.

- **Finn** — owner/admin. Onboarding, registry edits, deploys (`git push` → Railway), config generation, most issue/flag and student work.
- **Tom** — co-leadership. Payroll (currently via MMS calendar), shares Planning ownership with Finn. *(confirm full surface list)*
- **Fenella** — parent check-ins via `/admin/workflows/parent-understanding`. *(confirm whether she touches other surfaces)*
- **Planning Friday reflection** — leadership rhythm (Finn/Tom).

Keep this short; it is an operator pointer, not a permissions model.

## Read These First

1. `docs/admin/CURRENT_STATUS.md`
2. `docs/admin/V3_LOOP_ARCHITECTURE.md`
3. `docs/admin/OWNERSHIP_MATRIX.md`
4. `docs/admin/STATE_TABS_SCHEMA.md` — canonical state lane map
5. `docs/admin/WORKFLOW_DESIGN_PRINCIPLES.md`
6. `docs/admin/COPY_AND_TONE.md`
7. `docs/admin/HYGIENE_AND_SECRETS.md`
8. `docs/admin/DOCUMENTATION_MAP.md`
9. `docs/admin/SCHOOL_POLICY.md`
10. `docs/admin/PAYMENTS_RULES.md` if touching Stripe, pauses, or payment expectations
11. `docs/admin/BUG_FIXES.md` if debugging Railway, MMS calendar times, or recent production issues
12. `docs/admin/PRACTICE_CHAT_DELIVERY_AUDIT.md` if touching Practice Chat Level 2 delivery or rollout
13. Obsidian: `08 Operations/Current System Map.md`
14. Obsidian: `08 Operations/Active Roadmap.md`

## Source-of-Truth Rules

For dashboard-owned Sheets tabs, use `docs/admin/STATE_TABS_SCHEMA.md` as the canonical state lane map. It marks each tab as truth, cache, workflow state, append-only log, or derived context.

- Sheets = operational school truth
- Registry = portal config truth
- MMS = lesson/scheduling truth
- Stripe = payment provider truth
- `Issue_Queue` = workflow state
- `Event_Log` = action history
- `Pause History` = pause event/history source
- `Schedule_Context` = cached selected MMS schedule facts
- `Parent_Understanding_State` = parent check-in campaign workflow state
- `Planning_Items` = human-captured planning/task/initiative state
- `Planning_Progress_Log` = append-only planning progress history
- `Communication_Log` = append-only record of parent messages copied to send; record-only, not a sender
- `Practice_Notes_Log` = dashboard-owned Practice Chat note/delivery memory; sent/completed rows are parent-visible in portals before MMS fallback

## Recent Important Work

Parent Understanding added the first testable parent check-in workflow:

- route: `/admin/workflows/parent-understanding`
- API: `POST /api/admin/parent-understanding`
- client: `components/admin/AdminParentUnderstandingPageClient.js`
- helpers: `lib/admin/parent-understanding.js` and `lib/admin/parent-understanding-helpers.mjs`
- tests: `tests/admin/parent-understanding-helpers.test.mjs`
- managed Sheets tab: `Parent_Understanding_State`

The workflow is intentionally approval/manual-first. It copies WhatsApp follow-up text but does not auto-send messages, edit MMS contact details, notify tutors, or create issues.

Planning now captures human Brain-style work without becoming full project management:

- route: `/admin/planning`
- API: `POST /api/admin/planning`
- client: `components/admin/AdminPlanningPageClient.js`
- helpers: `lib/admin/planning.js` and `lib/admin/planning-helpers.mjs`
- managed Sheets tabs: `Planning_Items`, `Planning_Progress_Log`
- meeting filters: Due Now, Unassigned, Waiting, Linked, No Next Action
- Meeting filter: a curated planning review surface for clearing admin loops and protecting time for school-improvement work
- weekly seeded prompt: `Friday: what moved the school forward?`
- Monday scheduling prompt: turns last Friday's improvement intentions into dated action items
- calm Due Now filter: focused day-of/overdue action cards instead of the full planning board
- student linking: Planning receives compact student options from `getAdminStudents()`
- student detail: open linked planning items appear on `/admin/students/[mmsId]`
- workflow principle: reduce admin cognitive load by making the next safe action clear, not by adding fields
- pause guardrail: linked pause planning items can open the prefilled payment-pause PWA, generate/copy the parent confirmation message, then use `Mark pause completed` after confirming the pause tool was run and the message was sent/copied
- pause completion writes `payment_expectation = stripe_paused_expected` through the existing student PATCH route if needed, logs progress, appends the consequential action to `Event_Log`, and marks the planning task done
- school notes:
  - item types: `learning_note`, `strategic_note`
  - use cases: audiobook/book notes, transcript summaries, strategic scratchpad, bigger school-improvement thinking
  - stored in existing `Planning_Items`; original note stays as context
  - optional `nextAction` can create a linked `action` item via `parentPlanningId`
  - not a finance model, not a knowledge-management rewrite, and not a replacement for Friday reflection

Overview now acts as the meeting-start surface:

- page: `/admin`
- principle: start with what needs doing today, then what needs attention, then school-improvement prompts
- current front-page work cards: Review Issues, Tutor Absences, Waiting List, Payment setup pending, and Planning due-today when present
- deliberately not front-page by default: parent understanding, broad school/payment context, and system health when everything is quiet
- design rule: do not add a card because the data exists; add it only if Finn/Tom would click it in a meeting and do work
- copy/tone guide: `docs/admin/COPY_AND_TONE.md`

Practice Chat now has a dashboard bridge:

- Practice Chat route params from dashboard quick links: `studentId`, `studentName`, `tutor`, `dashboardBaseUrl`
- production quick links should use the canonical admin/API Railway app for `dashboardBaseUrl`: `https://first-chord-dashbord-production.up.railway.app`. Do not let Level 2 writes post back to the legacy `efficient-sparkle` runtime unless that service has the full admin/Gmail/Sheets env.
- API: `POST /api/practice-notes`
- helper: `lib/admin/practice-notes-helpers.mjs`
- managed Sheets tab: `Practice_Notes_Log`
- source-of-truth boundary: this records generated note content and student/tutor context. New Level 2 rows also carry delivery/audit fields when available. Older rows may only be snapshots, so check `email_send_status`, `mms_attendance_saved`, and recipient fields before treating a note as delivered.
- Level 2 delivery rows use `delivery_key = student + MMS attendance + note hash` and are upserted. If a matching row already has `email_send_status = sent` or a `gmail_message_id`, retries must not send another parent email. If MMS was saved but Gmail failed, retry only the Gmail step.
- portal note reads check sent/completed `Practice_Notes_Log` rows first via `GET /api/notes/[studentId]` and generated `getStudentData()`, then fall back to MMS when no owned note is available.
- student detail reads recent rows through `getPracticeNoteLogRows()` and shows a read-only `Recent practice notes` panel.

There is also a narrow Level 2 MMS-write test route:

- route: `POST /api/practice-notes/mms-test`
- allowed MMS students: dashboard-verified students whose tutor is Finn, Tom, or Fennella, plus Test Studenty for local testing
- dry-run mode previews attendance target, candidate attendance records, selected-date reason, preserved price, and recipients
- execute mode writes attendance/notes to MMS, sends a First Chord Gmail message, and appends/upserts the enriched note/audit row, but only when `confirmLevel2Pilot: true`
- execute mode is idempotency-aware; do not remove that guard before real tutor rollout
- local testing proves note write + attendance save; MMS `emailnotes` may fail unless MMS sees the principal as a teacher, so the current test path uses `GMAIL_*` send-only OAuth env vars instead
- API route guard: no-Origin requests are rejected unless a valid `X-FirstChord-PracticeChat-Secret` header is supplied. For rollout, set matching `PRACTICE_CHAT_API_SECRET` and `NEXT_PUBLIC_PRACTICE_CHAT_API_SECRET`; this is a coarse bridge secret, not per-tutor auth.
- do not generalise this until lesson targeting is visible/explicit, Gmail delivery has been tested, retry/idempotency is designed, and at least one safe real-student workflow has been verified
- before widening beyond Finn/Tom/Fenella, update and act on `docs/admin/PRACTICE_CHAT_DELIVERY_AUDIT.md`; caller identity, caller/student authorisation, config-driven rollout, and duplicate-send concurrency are blockers

Do not create a second source of truth unless the user explicitly agrees.

Communication logging is now intentionally record-only:

- page: `/admin/communications`
- API: `POST /api/admin/communications`
- helper: `lib/admin/communications.js`
- managed Sheets tab: `Communication_Log`
- current meaning: "this parent message was copied to send"
- not current meaning: "the dashboard sent this message"
- no approval workflow, WhatsApp API, or auto-send exists yet

Schedule cache refresh is now both manual and scheduled:

- manual exception handling: `/admin/capacity` and `POST /api/admin/schedule/refresh-stale`
- scheduled cohort refresh: GitHub Action `.github/workflows/refresh-schedules.yml` calls `POST /api/cron/refresh-schedules`
- required secret in both Railway and GitHub repo secrets: `SCHEDULE_REFRESH_SECRET`
- source boundary: `Schedule_Context` is still a cache of selected MMS facts, not truth

## What To Avoid Rushing

- Editable lifecycle state machine
- WhatsApp auto-send
- AI/agent actions that affect parent messaging or payments without approval
- Heavy generic workflow engine
- Heavy ownership/project-management layers
- Finance/accounting dashboard beyond lightweight operational value context
- Rewriting V3 loop architecture

## Common Safe Working Pattern

1. Inspect existing helpers/tests before changing behaviour.
2. Keep changes small and aligned with existing patterns.
3. Add/update focused tests for logic changes.
4. Run `npm run test:admin`.
5. Run `npm run build`.
6. If deployed, commit and push to `main`; Railway deploys from GitHub.
7. For meaningful architecture changes, suggest/update a learning log entry.

## Documentation Updates

Use repo docs for implementation detail and active engineering handoff.

Use Obsidian for higher-level operating memory:

- `06 Learning Log/` for meaningful architecture/product changes
- `08 Operations/Active Roadmap.md` for current direction
- `08 Operations/Incident Log.md` for outages/bugs/recovery lessons
- `08 Operations/Decision Log.md` for important choices
- `08 Operations/Glossary.md` for shared terms

Do not update docs for tiny styling-only changes unless they affect a documented workflow or decision.

Before editing docs, check `docs/admin/DOCUMENTATION_MAP.md`. It defines which repo docs are current authority and which older docs are historical background.

## Hygiene Guardrails

- Do not run commits from `/Users/finnlemarinel`; use the dashboard repo path above.
- Do not alter the home-directory git remote without explicit user confirmation.
- Do not remove tracked Theta credential files until the student portal has a replacement credential-loading path.
- Do not delete test/demo students from live data without explicit user confirmation.
