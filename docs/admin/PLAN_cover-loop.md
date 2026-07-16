# Plan: Closing the Cover Loop (Cover Bank → Tutor Absence → MMS)

Written 2026-07-16, before the survey calls have results. Three rungs, built in
order, each gated. **Status: rungs 1–2 shipped 2026-07-16** (they degrade to
nothing while the bank is empty); **rung 3 blocked on Finn's capture task
below.** The goal: a tutor absence with decision "cover" moves from
*"Finn remembers who might say yes"* to a closed loop — candidates surfaced,
ask sent, lesson reassigned, outcome stored and logged.

## What already exists (don't rebuild)

- **Cover Bank** (`Cover_Bank_State` + `/admin/workflows/cover-bank`): per-tutor
  willing yes/no, available days, same-day-OK vs needs-notice, notes;
  externals as `ext:<slug>` rows. `summariseCoverForDay(records, weekday)`
  already splits free vs already-teaching for a weekday.
- **Tutor Absence** (`Tutor_Absence_State`): per-date records with
  `decision: 'cover'`, `coverTutorShortName/Name`, `affectedLessons`
  (eventId, studentMmsId, studentName, lessonTime…), and
  `messageState.__workflow.coverTutorConfirmed` / `coverTutorBriefed`.
  The **parent-facing** cover message already exists
  (`buildTutorAbsenceMessage`, decision `cover`).
- The missing pieces are: candidate *ranking* at the point of choice, the
  message **to the candidate tutor** (the ask), and the MMS reassignment.

## Rung 1 — candidates inside the cover choice (pure read)

**Gate:** Fenella's survey calls have real results in `Cover_Bank_State`.

When an absence has (or is moving toward) decision `cover`, the cover-tutor
picker shows ranked candidates for that date's weekday instead of a flat list:

1. willing `yes`, day ticked, not teaching that weekday, `same_day` notice
   (an absence is usually a same-day ask) — sorted first;
2. then `needs_notice` free candidates;
3. then already-teaching candidates, greyed with the teaching flag (partial
   days exist — same flag-don't-hide rule as the day view);
4. instrument chip: highlight candidates whose instruments cover the absent
   tutor's affected students' instruments (from `ADMIN_TUTORS` /
   cover-bank `instruments` for externals). Mismatch = shown but flagged,
   not hidden — a piano tutor may still run a useful guitar lesson.
5. Not-yet-surveyed tutors remain selectable below (the bank informs, never
   restricts). Externals appear with their External chip; note that an
   external has no MMS teacher identity, so rung 3 does not apply to them.

Implementation: a pure `rankCoverCandidates({ coverBankRecords, weekday,
affectedInstruments })` in `cover-bank-helpers.mjs` (tested), consumed by the
absence page. No new state, no writes.

## Rung 2 — the ask message (existing copy-log pattern)

A "Copy ask" button per candidate, e.g.:

> Hi Dean, Kim's off this Thursday (18 Sep) — any chance you could cover her
> lessons at Otago St? It's 4:00–6:00pm, three students (guitar). Let me know
> and I'll sort the details.

Built from the absence record's `affectedLessons` (times, count, instruments)
+ candidate first name. Copy logs to `Communication_Log` via the existing
`logCommunicationCopy` pattern. **No auto-send** — WhatsApp sending stays on
the held-deliberately list; this is clipboard + log, like every other message
surface. When the tutor says yes, the existing `coverTutorConfirmed` flag is
the stored outcome.

## Rung 3 — MMS lesson reassignment (new write category — gated hard)

Today the dashboard's only MMS write is attendance. Reassignment is worth
doing properly because **payroll reads MMS by tutor** — the cover tutor should
appear in their own payroll window without manual fixup. But it is an
undocumented endpoint, so:

**Finn's capture task (blocks everything below):** reassign one lesson to a
substitute by hand in MMS with the network console open, and save the fetch
request (URL, method, full JSON body, and which auth headers it carries) here
or in a gist. Ideally capture both a single-event change and note what the UI
offered about the series.

**Open questions the capture + one throwaway-lesson test must answer:**

1. Does the request move **one event or the whole series**? (We only ever
   want single-date. If the endpoint is series-scoped, this rung stops.)
2. Does it touch the **billing profile** or price? (Must not.)
3. What does the **parent-facing calendar/portal** show afterwards?
4. How does the event's teacher attribution land in the **payroll window**
   (attendance rows by teacher) — original tutor, substitute, or both?
5. Is there a distinct "substitute" concept in MMS, or is it a plain teacher
   swap on the event?
6. Is the bearer token we already hold (`MMS_BEARER_TOKEN`) sufficient, or is
   this a session-cookie admin call?

**Ship shape (only after the answers are clean):** preview → confirm →
execute → `Event_Log`, per single dated event only, never series; idempotent
(re-click must not double-move); records the MMS response on the absence
record; visible undo path documented (even if undo = do it by hand in MMS).
Externals excluded (no teacher id). Falls back gracefully: rungs 1–2 plus
changing the tutor by hand in MMS already close the loop's decision and
communication; rung 3 only removes the manual MMS step.

## Loop shape (house pattern)

detect (absence logged) → context (ranked candidates, teaching/instrument/
notice flags) → bounded action (copy ask; later: reassign with confirm) →
outcome stored (`coverTutorShortName`, `coverTutorConfirmed`) → logged
(`Communication_Log`, `Event_Log`).

## Sequencing

| Rung | Status | Risk |
|---|---|---|
| 1. Ranked candidates | **shipped** — `rankCoverCandidates` + candidate list in the absence cover choice; empty until survey results exist | none (read-only) |
| 2. Ask message | **shipped** — `buildCoverAskMessage` + per-candidate "Copy ask", logged to `Communication_Log` | low (clipboard + log) |
| 3. MMS reassignment | blocked on Finn's capture + throwaway test answering Qs 1–6 | new MMS write — preview/confirm/log, single-date only |

Subtraction pass applies after rung 1–2 ship: the ranking explanation should
collapse to chips, not paragraphs.
