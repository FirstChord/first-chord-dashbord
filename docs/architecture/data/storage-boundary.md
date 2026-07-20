---
status: supporting
audience: [human, agent]
last_verified: null
---
# Sheets vs App Database — Ownership Audit

Last updated: 2026-07-07

This note records the read-only audit of where First Chord OS data lives today, the
ownership boundary it establishes, and the trigger-based migration plan. It is the
durable home for **"which data belongs in Sheets, which should move to a database,
and what should stay derived."** The per-tab mechanical map is `docs/architecture/data/state-tabs.md`;
this note is the *judgement* over that map.

## Core principle

- **Sheets** for data humans maintain, inspect, and correct. Low-volume, human-paced writes.
- **App database (when one exists)** for data the system *observes, generates, timestamps, dedupes, audits, or reconciles* at machine volume.
- **Derived / cache** for anything recomputable from source facts — never promote it to stored truth.

There is **no production database today.** So the real decision is not "rebalance Sheets vs DB"
but "introduce a *first* database only when a measured lane justifies it, and for which lanes."
The census (below) exists so that decision is triggered by a number.

## Current data-store map

| Store | Holds |
|---|---|
| Google Sheets `Students` | Canonical school roster (Stripe ID columns owned by Payment Pause) |
| Google Sheets — 24 dashboard state tabs | All workflow state, logs, caches, finance config (`docs/architecture/data/state-tabs.md`) |
| `lib/config/students-registry.js` (git) | Portal/registry truth; 5 derived config files regenerate from it |
| MMS | Lesson/schedule/attendance/waiting-list truth (external) |
| Stripe | Payment truth (external, restricted read key) |
| Bridge local files | Baileys session + `cache/recent-messages.json` (replaceable machine state) |
| In-memory / localStorage caches | Sheets read cache, API cache, tutor-list cache |

## Ownership boundary (the decision)

### Stay in Sheets — a strength, do not move

Students / registry, `Tutor_Pay`, `Tutor_Wise`, `Expenses`, `Expense_Log`, manual payers,
`Waiting_List_State`, `Planning_Items` + `Planning_Progress_Log`, showcase/holiday checklists,
`Parent_Understanding_State`, `Tutor_Absence_State`, `Communication_Log`, `Students_Archive`,
`Finance_Snapshot`, `Schedule_Context`, `Stripe_Amounts_Cache`, `Stripe_Collected_Monthly`,
`Bridge_Status`, `WhatsApp_Group_Map`.

Common thread: humans are the writers or correctors, writes are human-paced, and for the
sensitive finance tabs **Sheets is deliberately the not-in-git security boundary**. The
"just fix the row in the sheet" correction path is a feature here, not debt.

### Move soon — trigger-based, not yet

**`Incoming_Message_Inbox`.** The only lane where a *machine* now generates unbounded writes
(auto-capture from ~170 confirmed groups). Dedupe is read-modify-write over the whole tab;
bridge posts and admin review actions can race the same row (last-write-wins can drop a
`reviewed_by` stamp); auto-archived noise accumulates with no retention policy; it holds the
most PII. Not a measured bottleneck yet — but the one tab whose risk grows on its own.

### Move eventually

`Event_Log`, `Issue_Queue`, `Payroll_Runs`, and **`Practice_Notes_Log` delivery records**.
The last is *gated, not optional*: the Level 2 delivery audit already names duplicate-send
concurrency as a blocker to widening — a DB unique constraint on `delivery_key` is the real fix,
so this moves **before** Practice Chat Level 2 widens beyond the pilot.

### Derived / cache only — never store as truth

Student lifecycle status, finance run-rate, break-even, pause forecast, open attention items,
reconciliation outcomes, `source_present`, capacity/free-slot views.

## Risks

**Current setup:** last-write-wins on keyed upserts (bridge vs admin on an inbox row is the live
example); no row-level history on workflow tabs; Sheets API quota if capture volume climbs; the
pause-forecast regex contract (prose dates as schema); unbounded noise-row growth; manual
querying/joining for reporting.

**Moving too early:** it's summer (recorded rule: don't ship complex automation mid-summer); a
database means new backup/restore ops, losing the in-sheet correction path (every fixup then
needs an admin UI), hidden data, dual-write drift, and destabilising an inbox loop that only
shipped in early July. `docs/CURRENT_STATUS.md` lists "a new database to replace Sheets" under
do-not-do-next, and `docs/architecture/data/state-tabs.md` says don't harden until Sheets is a *measured*
bottleneck. The audit confirms that: nothing is measurably broken today.

## Staged migration plan

1. **Now (no DB):** this boundary is policy (below + `docs/architecture/data/state-tabs.md`); write the inbox
   retention/prune policy (bounds the sheet cheaply); **stop adding new event-heavy tabs to Sheets**.
   Orphaned `data/school.db` + `data/students.json` + the Kenny one-off script removed.
2. **Instrument, don't guess:** the **sheet census** (see below) rides the fortnightly
   `npm run backup:sheets`, so "measured bottleneck" becomes a tracked number.
3. **Trigger (autumn earliest, or when census/races bite):** Railway Postgres; move *new writes*
   for `Incoming_Message_Inbox` + `Event_Log` there, mirror read-only to Sheets during a settling
   window, then drop the inbox mirror (its admin UI already replaces sheet visibility).
4. **Before widening Practice Chat Level 2:** delivery records to the DB with a `delivery_key`
   unique constraint.
5. **At tutor-facing payroll Phase 3:** reassess `Payroll_Runs`.
6. **Never:** human config tabs, sensitive tabs, `Students`, `Finance_Snapshot`.

## The sheet census (measurement layer)

`lib/admin/sheet-census.mjs`, run inside `scripts/backup-sheets-tabs.mjs`. Each fortnightly
backup writes `census.json` beside the manifest and folds a one-line summary into the backup
planning card's progress note. It reads the previous backup set's manifest and reports:

- total rows across all tabs and delta since the last backup,
- per-tab row counts and deltas,
- `fastestGrowing`: the **watched** event-heavy tabs (`CENSUS_WATCH_TABS`) ranked by growth.

The watch set is deliberately scoped to the move-soon/eventually lanes
(`Incoming_Message_Inbox`, `Event_Log`, `Issue_Queue`, `Practice_Notes_Log`, `Payroll_Runs`,
`WhatsApp_Group_Map`) — human-paced config tabs are ignored because their growth never triggers
a migration. It is read-only and fail-safe: a census hiccup never affects the backup.

**Reading it:** when a watched tab shows sustained fortnight-on-fortnight growth (esp. the
inbox), that is the signal to execute step 3, not before.

## For Finn to verify manually

- After a full week of auto-capture, eyeball `Incoming_Message_Inbox` growth — the census tracks it.
- Decide the auto-archived noise retention window (recorded open decision; ~90 days is a sane default).
- Glance once at the Google Cloud console Sheets API quota usage to establish headroom as fact.
