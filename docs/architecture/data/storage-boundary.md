---
status: canonical
audience: [human, agent]
last_verified: 2026-08-10
---
# Sheets and database boundary

This document answers one question: where should new dashboard-owned state live?
The per-lane mechanical contract remains
[State tabs](./state-tabs.md).

## Current position

Google Sheets is the general application state store. It is intentionally useful
for human-paced records that Finn/Tom can inspect and correct directly.

PostgreSQL has two deliberately bounded responsibilities:

- `practice_note_delivery_claims` atomically claims a unique Practice Chat
  `delivery_key` before MMS or Gmail work; and
- the `fc_lesson_*` mirror holds high-volume, machine-written MMS lesson series,
  events, student participations, revisions and completeness evidence.

The first exists because a last-write-wins Sheet cannot safely prevent duplicate
delivery across Railway instances. The second exists because event/participation
grain, transactional snapshots, history and parity queries are a poor fit for a
human-edited Sheet. The lesson mirror is rebuildable and MMS remains schedule and
attendance truth. No operational reader uses it in its first slice.

There is no general-purpose application database and no plan to replace working
Sheets lanes wholesale.

## Placement rubric

Choose Sheets when:

- humans create, review, or correct the record;
- writes are low-volume and human-paced;
- direct inspection is an operational advantage;
- last-write-wins conflict risk is understood and acceptable;
- sensitive configuration is safer in the private Sheet than Git.

Choose PostgreSQL or another transactional store when:

- correctness requires a unique claim, transaction, or concurrent compare/write;
- machine-generated events grow without human pacing;
- races can cause duplicate external action or lost human decisions;
- retention/query volume makes a Sheet materially unreliable;
- a concrete backup, restore, correction, and operator-inspection path is designed.

Keep data derived or cached when it can be rebuilt from an authoritative source.
Do not promote lifecycle summaries, forecasts, capacity views, or reconciliation
results into truth merely to make querying convenient.

## Current disposition

- **Stay in Sheets:** human-owned workflow/configuration, planning, finance review,
  payroll review, issue state, append-only operating logs, and bounded caches.
- **Already transactional:** Practice Chat's delivery claim and the dormant,
  operator-run MMS lesson mirror. The mirror does not own schedule truth.
- **Watch first:** machine-written inbound-message/event lanes, especially where
  bridge writes and admin review can race or retention remains undecided.
- **Reassess later:** event/audit lanes when measured growth or query needs make
  their current store costly—not because a database feels architecturally neater.

Moving a lane does not change its authority. A database copy of Stripe, MMS, or
Gmail facts remains a cache/audit record, not provider truth.

## Migration trigger

The fortnightly Sheets backup writes a `census.json` using
`lib/admin/sheet-census.mjs`. Watched lanes are ranked by row growth. **A lane
that is not watched is counted but never ranked, so the trigger below cannot
fire for it** — `Song_Status_Log` and `Song_Outcomes` sat in that blind spot
until 2026-08-07 because they were created after the watch list. Add an
append-only machine-written lane to `CENSUS_WATCH_TABS` when it is created, not
when it is already large.

Execute a storage move only when evidence shows at least one:

- sustained growth that harms reads, quotas, or recovery;
- a demonstrated race/lost-update problem;
- a required uniqueness/transaction boundary;
- reporting needs that cannot be met safely from the current lane;
- a retention or privacy obligation the Sheet cannot enforce.

Before moving state, document:

1. the authoritative source and stable identifiers;
2. write/read cutover and rollback;
3. dual-write or mirror duration, if any;
4. correction/reconciliation UX;
5. backup, restore, retention, and deletion;
6. concurrency/idempotency behaviour;
7. health signals and named operator response.

## PostgreSQL claim and lesson-mirror boundary

`DATABASE_URL` is shared by two independently bounded schemas. The Practice Chat
execute route requires it, and `npm run ensure:practice-delivery-claims`
creates/verifies the claim table. Claim failure returns `503` before MMS
attendance or Gmail email is attempted.

Terminal claim rows are safety state. Do not delete or recreate them to force a
retry: an ambiguous Gmail result can mean the parent already received the email.
Recovery must reconcile the PostgreSQL claim, Sheets audit, MMS attendance, and
Gmail evidence without guessing. See
[Practice Chat delivery](../../workflows/practice-chat/delivery.md) and
[the operations runbook](../../operations/runbook.md).

The lesson mirror uses checksummed migrations under
`db/migrations/lesson-mirror/`; application requests never create its schema.
Its first-slice commands are manual, its snapshots are transactionally locked,
and no existing app workflow waits on it. A mirror failure is retried from a
verified bounded MMS read. It never justifies deleting or recreating Practice
Chat claims. See [the active lesson-ledger plan](../../plans/active/lesson-occurrence-model.md).

## Open decisions

- Retention/pruning for auto-archived incoming-message noise.
- Whether/when an off-device PostgreSQL backup and PITR are available and
  rehearsed. Mirror rows can be rebuilt; Practice Chat claims cannot safely be
  guessed back into existence.
- The census/race threshold that would trigger moving the incoming inbox.
- A human-correctable admin path before any Sheet lane loses its direct correction
  surface.
