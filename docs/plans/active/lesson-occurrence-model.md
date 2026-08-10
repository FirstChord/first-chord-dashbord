---
status: active-plan
audience: [human, agent]
last_verified: 2026-08-10
---
# First Chord Lesson Ledger and MMS Exit Path

## Outcome

First Chord will build its own durable lesson ledger: one stable record for a
recurring lesson series, one for each calendar event, and one participation for
each student expected at that event. MMS remains the scheduling and attendance
source of truth at first. Over time, First Chord systems will attach to these
provider-neutral identities, selected edits will be made safely through First
Chord, and MMS can eventually become a downstream mirror and then be removed.

This is not only a data-copy project. It is the dependency path from today’s
MMS-centred operations to a First Chord-owned school operating system, including
an independent calendar and iCalendar feeds.

## Why This Adds Meaningful Value

Today, schedule refreshes reduce many MMS events to one summary row per student
in `Schedule_Context`, then discard the occurrences. That is enough to display
“usual lesson” and “next lesson”, but it cannot reliably answer:

- what should have happened on a particular date;
- which students belonged to a group event;
- whether attendance was recorded for every expected participation;
- how a lesson changed over time;
- whether First Chord can reconstruct MMS independently; or
- which stable lesson identity payroll, cover, Practice Chat, communications,
  finance and calendars should share.

A durable ledger closes that gap. It is useful immediately for reconciliation
and attendance completeness, and it creates the stable foundation required to
replace MMS without a dangerous all-at-once migration.

## Evidence That Changed the Design

A verified whole-school MMS sample on 2026-08-10 returned 764 attendance rows
for 28 days in one paginated request. The comparable calendar search returned
769 events. That is cheaper and more complete than the existing pattern of
roughly 200 sequential per-student calendar requests with 150 ms spacing.

The sample also proved that event and attendance are different grains:

- calendar events can contain zero, one or several student attendances;
- 20 sampled calendar events represented group lessons, with up to five
  students;
- attendance rows carry both `EventID` and `StudentID`; and
- the attendance response does not carry the calendar series identifier.

Therefore the first slice uses bounded whole-school sweeps and models an event
separately from each student's participation. The earlier proposal to accept a
fortnightly observation gap as the price of being gentle on MMS is rejected.

## Ownership During the Transition

The words “First Chord-owned” have three separate meanings and must not be
conflated:

1. **Identity and retained observations:** First Chord owns its stable IDs and
   its history of what it observed.
2. **Current provider truth:** MMS owns schedule and attendance facts until the
   relevant cutover phase is explicitly completed.
3. **Scheduling authority:** First Chord owns edits only after a command path,
   provider synchronisation, read-back verification, conflict handling and
   rollback have been proved for that edit type.

During the mirror and parity phases, the SQL ledger is a rebuildable read model,
not permission to edit MMS or a new winner in a data conflict. Every record must
retain its provider, external reference, observation time and sync run.

## Long-Term Phases

### Phase 1 — Mirror MMS

Keep MMS as source of truth. Pull whole-school calendar and attendance data into
PostgreSQL and create provider-neutral First Chord identities for lesson series,
events and student participations. Record raw provider status separately from
derived state. Nothing operational reads from the mirror and no MMS write is
performed.

The first implementation slice in this document is the safe foundation of this
phase. It includes a versioned schema, verified pagination, deterministic
normalisation, idempotent transactional upserts, change revisions, sync-run
evidence, an operator-run synchronisation command and status inspection. It does
not infer missing or cancelled lessons.

### Phase 2 — Prove Parity

Regularly ask whether First Chord can reconstruct exactly what MMS says should
happen: tutor, student, date, local time, duration, room, category, recurring
series, attendance state, cancellation and exception behaviour. Measure missing
references, duplicates, conflicts, stale data and unclassified provider states.
Each mismatch becomes an explainable reconciliation item, not a silently chosen
winner.

A read-only First Chord calendar and experimental iCalendar feeds can be exposed
in this phase because they are useful parity surfaces. They must be labelled as
MMS-backed and cannot become operational truth merely because they look correct.

### Phase 3 — Attach Existing Systems to First Chord IDs

Gradually make payroll, tutor cover, WhatsApp context, Practice Chat, student
dashboards and finance refer to First Chord series, event or participation IDs
at the correct grain. Each reader migrates behind parity checks and a rollback
switch. MMS still feeds the schedule, but provider IDs stop being the conceptual
join key for the school.

### Phase 4 — Own Selected Edits

Make a deliberately narrow class of schedule change in First Chord first, then
synchronise it to MMS through a durable command/outbox. Require idempotency,
human approval, provider read-back, reconciliation, an audit log and a defined
rollback. Tutor cover or a policy-approved permanent change is a better first
candidate than one-off rescheduling, which current school policy does not offer.

### Phase 5 — First Chord Becomes Canonical

Create new students, recurring lessons, cancellations and timetable changes in
First Chord. MMS receives a downstream projection for a defined transition
period. This phase requires explicit cutover criteria and must not be inferred
from elapsed time or high parity alone.

### Phase 6 — Replace the Calendar Surface

Provide a First Chord calendar UI, likely backed by a JSON calendar API, and
publish scoped iCalendar feeds for Google and Apple calendars. iCalendar is a
distribution format, not the mutable schedule database:

`First Chord lesson ledger -> scoped iCalendar feed -> tutor/student calendar`

Feed URLs require opaque revocable tokens, stable First Chord UIDs, least-data
event content and no payment, contact, private-note or operational detail.

### Phase 7 — Remove MMS

Remove MMS only after the particular functions the school still relies on have
been replaced and recovered in drills: attendance capture, notification
behaviour, make-up logic, reports, schedule editing and any remaining exports.
Archive evidence and provider identifiers according to the retention policy;
do not keep a zombie integration indefinitely.

## First Slice: Exact Scope

### Implementation status — 2026-08-10

The repository implementation for this slice is complete locally: verified MMS
reads, pure normalization, the initial checksummed PostgreSQL migration,
transactional storage, sync-run status, operator commands and focused tests are
present. A live read-only verification for `2026-08-01` through the
end-exclusive `2026-08-29` returned matching provider totals: 772/772 calendar
events and 767/767 attendance rows. It normalized to 219 series, 772 events and
767 participations without persisting names or free text. The final migration
and bulk transaction were also executed against a disposable local PostgreSQL
database; repeating an unchanged synthetic snapshot added no revisions.

The production migration has deliberately not been applied, no production
mirror rows have been written, and no automatic schedule exists. Those are the
material rollout gate described below, not missing application behaviour. No
existing school workflow has changed.

### Included

- paginated whole-school calendar and attendance reads that verify provider
  totals before reporting success;
- bounded date windows and explicit maximum-page protection;
- separate series, event and student-participation records;
- First Chord IDs that are stable and provider-neutral at consumers;
- a generic external-reference layer retaining MMS IDs;
- local date, local time and `Europe/London` stored explicitly rather than
  relying on JavaScript `Date` coercion of MMS wall-clock values;
- raw MMS attendance status retained without guessing its business meaning;
- current-state hashes and append-only revisions only when state changes;
- sync-run records containing requested windows, expected/received counts,
  status and failure detail;
- idempotent, transactional database writes; and
- manual operator commands for migration, sync and status before scheduling is
  enabled.

### Excluded

- switching any existing reader or writer to SQL;
- changing `Schedule_Context`, payroll, Practice Chat, tutor cover, finance,
  messaging or attendance behaviour;
- writing to MMS;
- heuristically merging a deleted MMS event with a replacement event;
- interpreting disappearance as cancellation;
- deriving “completed” from an attendance label;
- a calendar UI or iCalendar feed; and
- an automatic production schedule before the migration, backup position and
  first reconciliation run have been reviewed.

## Data Model

| Table | Grain and purpose |
|---|---|
| `fc_lesson_series` | One First Chord series identity. A series is not fabricated for one-off events; recurrence observations remain on events until parity proves the provider contract. |
| `fc_lesson_events` | One scheduled calendar event. Holds event-level tutor, time, duration, location/category and raw provider facts. |
| `fc_lesson_participations` | One student at one event. Holds the raw attendance status and attendance reference independently of the event. |
| `fc_lesson_external_refs` | Provider/type/reference to one FC entity. This keeps MMS IDs out of consumer identity contracts. |
| `fc_lesson_revisions` | Append-only snapshots written only when a current record’s state hash changes. |
| `fc_lesson_sync_runs` | The windows, totals, outcome and error evidence for one mirror attempt. |
| `fc_schema_migrations` | Explicit applied migration versions. Schema creation never happens lazily in an application request. |

The initial FC IDs are deterministic opaque hashes of the entity kind and MMS
reference. That makes concurrent or repeated imports converge without a lookup
race. The external-reference layer allows a later, reviewed alias or merge when
evidence proves that two provider records represent one First Chord entity.
Until then, an MMS delete-and-recreate remains two FC events. False separation
is visible and repairable; a false automatic merge can corrupt history.

## Completeness and Safety Invariants

1. A provider response is complete only when pagination reaches the reported
   total. A mismatch fails the run.
2. A failed or incomplete run never marks unseen records missing, cancelled or
   stale.
3. Fetches complete before current rows and revisions are committed. A database
   transaction makes the mirror change all-or-nothing for a successful run.
4. Re-running the same window does not duplicate entities or revisions.
5. Unknown provider values are retained as raw data and surfaced in parity
   reporting; they are not coerced to a reassuring default.
6. Group events have one event and several participations. Event count is never
   used as a student lesson count.
7. All application readers continue to use existing sources during the first
   slice, so disabling the sync command is an immediate behavioural rollback.
8. Credentials never enter rows, logs, command output or documentation.

## Cadence After the First Reconciliation

The target is one bounded whole-school sweep per day, with a small overlapping
look-back so late attendance edits are observed and a useful future horizon so
schedule changes are caught. Exact production windows and timing will be chosen
from measured row counts and MMS response times during parity. Larger historical
backfills are separate operator runs, not hidden inside the daily job.

Daily cadence improves observation; it still does not turn polling into a true
provider change log. A lesson created and removed entirely between successful
sweeps may remain invisible unless MMS exposes another audit source.

## Rollout Gates

The first slice is ready to run in production only when:

- migrations have been reviewed and applied explicitly;
- PostgreSQL backup/PITR availability is known, while recognising that mirror
  rows themselves are rebuildable from MMS;
- the existing Practice Chat delivery-claim table is unaffected;
- a bounded dry reconciliation reports provider totals and database counts;
- logs and health output contain IDs/counts but no sensitive names or secrets;
- the manual status command can distinguish fresh, failed and never-run states;
  and
- rollback is documented as disabling the mirror trigger and reverting code,
  without deleting append-only revisions or guessing at provider repair.

Automatic daily scheduling is a later, separately observable rollout step. No
existing operational surface waits on the mirror, so a sync failure is visible
but does not interrupt school work.

## Phase 2 Questions to Answer with Evidence

- Does MMS preserve `SeriesID` across term changes and permanent slot moves?
- How are cancelled events represented: status, disappearance, category or a
  separate source?
- Can attendance records outlive or refer to calendar events outside the
  selected calendar window?
- Which provider fields change when tutor cover is used?
- What overlap window captures late attendance edits without needless load?
- Which privacy and retention period is proportionate for detailed lesson and
  attendance history?
- Which first consumer gains enough value to justify its own cutover risk?

These are parity measurements, not reasons to put event and participation data
into the wrong schema now.
