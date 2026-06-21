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
