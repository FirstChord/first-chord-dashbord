---
status: canonical
audience: [human, agent]
last_verified: 2026-07-20
---
# Practice Chat Delivery Contract

## Boundary

Practice Chat may update MMS attendance and email a reviewed lesson note to a
parent only after the tutor completes the recipient-specific confirmation. This
is an accepted narrow exception on the low-friction tutor surface; it is not a
general permission for public tutor routes to perform consequential writes.

The selected tutor is self-attested, not authenticated identity. Before any
provider call the server must load the student context and require one clear
recorded tutor assignment matching that self-attestation. Missing, conflicting,
or mismatched records fail closed.

All registered tutors are enabled when `PRACTICE_NOTES_ENABLED_TUTORS` is absent.
The variable may temporarily restrict the roster; it must not be treated as the
canonical tutor registry.

## Human Confirmation

The final screen must show:

- the selected student
- lesson date/attendance target previewed from MMS
- the exact first email-capable recipient derived server-side from that
  student's MMS family/contact data

The tutor must affirm that these are the named student's notes and should be
emailed to that named recipient. A generic date-only confirmation is
insufficient. The server revalidates the selection; a model- or client-supplied
confirmation is never human approval.

Typed notes remain available if speech capture fails. `AbsentNoMakeup` records
the on-the-day cancellation without sending a parent practice-note email.

## Delivery And Idempotency

`delivery_key = student + MMS attendance + note hash` identifies one delivery.
The execute path must:

1. validate origin/shared-secret, tutor/student assignment, attendance target,
   recipient, note, and confirmation
2. atomically insert `practice_note_delivery_claims.delivery_key` in PostgreSQL
3. save the corresponding Sheets audit claim
4. only then call MMS and Gmail
5. finalize both the database claim and `Practice_Notes_Log` audit row

The database primary key is the cross-instance execution lock. The in-process
guard only complements it. Sheets is the audit/read model, not a transactional
lock.

If the database claim cannot be saved, return 503 and call neither MMS nor
Gmail. If the initial Sheets claim fails, release only that fresh pre-provider
claim and do no provider work. Terminal completed, failed, or manual-follow-up
claims are never automatically reacquired or deleted to force a retry.

A duplicate request returns the existing result instead of repeating provider
work. If MMS succeeds and Gmail errors or times out, mark manual follow-up and
do not retry the ambiguous email automatically. If provider work succeeds but
final logging fails, report explicit partial success; never imply the provider
action did not happen.

## Sources And Visibility

- MMS remains attendance/payroll continuity truth.
- Gmail owns whether it accepted the outbound email and its message/thread IDs.
- PostgreSQL owns the unique delivery execution claim.
- `Practice_Notes_Log` owns dashboard delivery audit and parent-visible note
  memory.

Only sent/completed note rows may be parent-visible. Draft, snapshot,
in-progress, failed, and absence-only rows are not proof of parent delivery.
Rows with `manual_follow_up_needed = TRUE` surface as Practice Delivery issues;
clearing that flag is a narrow cell update, not a full-row rewrite.

`Practice_Notes_Log.acting_tutor` must remain labelled
`Self-attested: <name>` until tutor authentication exists.

## Required Configuration And Bootstrap

On the canonical Railway admin service:

```text
DATABASE_URL=<Railway PostgreSQL URL>
PRACTICE_CHAT_API_SECRET=<shared PWA handoff secret>
# Optional emergency/temporary restriction only:
PRACTICE_NOTES_ENABLED_TUTORS=<comma-separated canonical names>
```

Before first use against a database, run:

```bash
npm run ensure:practice-delivery-claims
```

The shared PWA secret is a coarse caller guard, not tutor identity. Keep allowed
browser origins narrow and never expose database or provider credentials to the
PWA.

## Recovery

- Failure before provider work: inspect the selected lesson/recipient and retry
  only if no terminal claim exists.
- Gmail ambiguity after MMS success: verify Gmail/provider evidence and follow
  up manually; retain the claim and audit trail.
- Gmail success with MMS failure: preserve delivery evidence and repair
  attendance/payroll from MMS truth rather than resending the email.
- Final log failure: treat as partial success and reconcile from PostgreSQL,
  Gmail, MMS, and existing Sheets evidence. Never guess or erase history.

## Verification

Focused tests are `tests/admin/practice-*.test.mjs`. Any delivery change must
cover validation, recipient/student scoping, tutor mismatch/conflict, claim
failure before providers, duplicate/concurrent execution, absence-without-email,
ambiguous Gmail failure, and final-log partial success.

After a deployment, use one explicitly approved real end-to-end note and verify
the confirmation copy, parent receipt, MMS attendance, audit row, database claim,
and duplicate response. Do not create a real delivery merely for an automated
smoke test.
