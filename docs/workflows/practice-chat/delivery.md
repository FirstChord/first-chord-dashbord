---
status: canonical
audience: [human, agent]
last_verified: null
---
# Practice Chat Delivery Audit

Last updated: 2026-07-17

This records the checked delivery boundary for the trusted-tutor Level 2
rollout beyond Finn, Tom, Fennella, and Dean.

Do not treat this as an implementation plan by itself. Confirm each point against current code before changing behaviour.

## Trusted-Tutor Delivery Boundary

Level 2 Practice Chat:

- accepts calls from the Practice Chat PWA through dashboard API routes
- uses a shared bridge secret plus allowed browser origins
- enables all registered tutors by default (or a temporary explicit allow-list)
- requires the selected tutor to self-attest and match the student's single, non-conflicting recorded tutor assignment
- allows speech capture or a typed-note fallback before the final human-reviewed action
- previews the selected MMS attendance target before writing
- can mark the student `Present`, write the note/attendance to MMS, and send the parent note through First Chord Gmail
- can mark an on-the-day cancellation as `AbsentNoMakeup` without sending a parent practice-note email
- upserts delivery/audit state into `Practice_Notes_Log`
- uses `delivery_key = student + MMS attendance + note hash` to avoid duplicate sends for the same delivery
- must save an `in_progress`/`retrying_email` claim before MMS attendance or Gmail execution begins; a failed claim returns 503 and explicitly reports that neither provider action was attempted
- holds a same-process `delivery_key` guard across claim, provider execution, and final logging
- reports `deliveryTrackingFailed` and `partialSuccess` if provider work succeeds but the final delivery row cannot be saved

The PWA final action lists the selected student and first server-derived MMS
parent recipient, and requires the tutor to tick a statement explicitly
authorising that student's notes to that parent. This is a human confirmation,
not proof of identity.

## Rollout Safeguards

The following controls are active in the trusted-tutor rollout. This is an
intentional narrow exception to the usual public-tutor no-consequential-write
rule, accepted by the school on 2026-07-17.

1. Confirm the exact parent recipient.
   - Before an execute request, the final PWA dialog lists the selected student
     and the first email-capable recipient returned by the server preview.
   - The tutor must tick “I confirm these are [student]'s notes and they should
     be emailed to this parent.” The date confirmation is retained.

2. Fail closed on the tutor/student record.
   - The PWA supplies the selected tutor as a self-attestation. The server loads
     the student context and rejects a missing, mismatched, or conflicting tutor
     assignment before any provider action.
   - `Practice_Notes_Log.acting_tutor` stores `Self-attested: <name>`; it must
     not be represented as verified identity.

3. Use a transactional delivery claim.
   - `practice_note_delivery_claims.delivery_key` is a PostgreSQL primary key.
     The route inserts its claim before Sheets, MMS, or Gmail work. A second
     Railway instance sees the existing claim and cannot execute the providers.
   - If the Sheets audit-claim write fails, the fresh database claim is released
     before provider work starts. Completed/failed/manual-follow-up claims are
     never automatically re-acquired.

4. Make rollout configuration explicit.
   - `PRACTICE_NOTES_ENABLED_TUTORS` is a comma-separated list of canonical
     tutor names. When omitted, every registered tutor is enabled; set it only
     for a temporary operational restriction.

5. Do not retry ambiguous Gmail sends automatically.
   - After MMS succeeds and Gmail returns an error, the delivery is marked for
     manual follow-up and the claim becomes terminal. The PWA never assumes a
     timeout meant “unsent” and never retries that parent email itself.

## Required Production Configuration

Set these only on the canonical admin Railway service, in a no-lessons window:

```text
DATABASE_URL=<existing PostgreSQL URL>
PRACTICE_CHAT_API_SECRET=<existing shared PWA handoff secret>
# Optional temporary restriction; omit to enable the full registered roster.
PRACTICE_NOTES_ENABLED_TUTORS=Arion,Calum,Chloe,David,Dean,Eléna,Fennella,Finn,Ines,Kenny,Kim,Patrick,Robbie,Scott,Stef,Tom
```

Run `npm run ensure:practice-delivery-claims` against that database before
deploying. `PRACTICE_CHAT_API_SECRET` must remain configured for the shared PWA
handoff; it is a coarse caller guard, not tutor identity.

## Fast-Follows During Rollout

- Add an admin view for failed or manual-follow-up Practice Chat deliveries.
- Surface Gmail-sent/MMS-failed cases clearly, because that creates a payroll/attendance gap even if the parent received the note.
- Validate that the chosen recipient email belongs to the target student's MMS family/contact data.
- Document secret rotation and basic rate limiting for the Practice Chat bridge.

## Source-Of-Truth Notes

- `Practice_Notes_Log` is dashboard-owned learning/delivery memory.
- MMS remains attendance/payroll continuity until payroll no longer depends on MMS attendance.
- Sent/completed First Chord notes can be parent-visible in portals.
- Absence-only rows are attendance evidence, not parent-note delivery evidence.
- Draft, in-progress, failed, and snapshot-only rows are not proof of delivery.

## Manual Checks Before Widening

- Execute one real note end-to-end.
- Confirm the final confirmation checkbox names the correct student and exact
  parent email, and cannot be bypassed by the Finish button.
- Confirm the parent receives the email.
- Confirm MMS attendance is present and the note is visible where expected.
- Confirm `Practice_Notes_Log` contains recipient, send status, Gmail ID, MMS attendance ID, and completed status.
- Confirm an `AbsentNoMakeup` test row records attendance status without sending a parent email.
- Attempt a duplicate send and confirm it returns the existing delivery rather than emailing again.
- Force the claim write to fail and confirm the route returns 503 without calling MMS or Gmail.
- Exercise two same-key requests in one process and confirm only one reaches provider execution.
- Confirm failed Gmail or MMS paths are visible enough for admin follow-up.
- Confirm the two known new-tutor students without an MMS parent email are
  blocked at preview and no MMS/Gmail action occurs.
