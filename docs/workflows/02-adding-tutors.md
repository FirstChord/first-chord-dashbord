# Workflow: Tutor Arrival and Handover

**Purpose:** Bring a tutor into First Chord once, transfer a departing tutor's students safely, and retire the old tutor only when the transfer is real.

**Last updated:** 12 July 2026

## The short version

Treat this as one handover, not a separate setup task for every student:

```text
set up the incoming tutor once
        ↓
make one transfer roster
        ↓
change each student's teacher in MMS
        ↓
align the dashboard records in one pass
        ↓
verify the new tutor's live roster
        ↓
retire the outgoing tutor
```

MMS is the source of truth for a tutor's active student roster and schedule. The dashboard records who is available for new work and keeps Sheets/portal context aligned; it does not move students in MMS automatically.

## Part 1 — Set up the incoming tutor once

Do this before their first student is transferred.

1. Create the teacher in MMS and record their MMS teacher ID (`tch_...`).
2. Add the tutor to the canonical `TUTORS` list in `first-chord-brain/generate_fc_ids.py` with:
   - short name
   - full name
   - MMS teacher ID
   - instruments taught
3. From `first-chord-brain`, run `python3 generate_fc_ids.py` to refresh the First Chord identity tabs.
4. From this dashboard repository, run `npm run sync-admin-tutors`, then validate, commit, and deploy the generated tutor identity change.
5. Check `/dashboard`: the new tutor should appear and an empty roster should load without error.
6. Complete only the operational details that apply:
   - `Tutor_Pay` — pay model, rate/salary, cadence, and payroll-active setting
   - `Tutor_Wise` — payee details if using the Wise batch
   - `Tutor_Phones` — tutor's school WhatsApp number if their replies should be recognised as school-side

There is no separate dashboard activation step: a tutor without a `Tutor_Lifecycle` row is active by default.

## Part 2 — Start the outgoing tutor's handover

On `/admin/tutors`:

1. Enter the outgoing tutor's final teaching date.
2. Optionally select the incoming tutor under **Handover to** and add a brief note.
3. Choose **Mark leaving**.

This keeps the outgoing tutor available while the handover happens. It does not change MMS, student assignments, pay, or access.

## Part 3 — Use one transfer roster

Make one list of the outgoing tutor's students before changing anything. The **Retirement checks** panel shows the current dashboard assignments; use that as the starting list.

For each student, use these three columns:

| Student | MMS teacher changed | Dashboard aligned |
| --- | --- | --- |
| Student name | date / initials | date / initials |

Work through the list in this order, grouping all MMS changes into one focused pass rather than repeatedly switching tools.

### A. Change the teacher in MMS

Assign the student to the incoming tutor in MMS. This is the actual transfer: it controls the new tutor's live roster, calendar schedule, and attendance/payroll context.

### B. Align dashboard student records

Open the student's admin record and update the tutor in both the **Students sheet** and **Registry** sections. This keeps the admin dashboard and portal configuration aligned with MMS.

The student remains active, keeps their payment setup, and keeps their portal; no student archive action is involved.

### C. Mark the two roster columns

Do not infer completion from memory. The two ticks distinguish a real MMS transfer from a dashboard-only edit and make it safe to stop and resume the handover.

## Part 4 — Verify in batches

After a group of transfers, not after every individual edit:

1. Open `/dashboard`, select the incoming tutor, and use **Refresh**.
2. Confirm the transferred students appear on the new tutor's roster and schedule.
3. Check the outgoing tutor's dashboard roster no longer includes them.
4. Resolve any tutor-conflict flags before continuing.

This batch verification is the main time-saver: the new tutor is configured once and the live MMS roster is checked once per handover group, not once per setup step.

## Part 5 — Retire the outgoing tutor

Only after every student transfer is complete:

1. Return to `/admin/tutors`.
2. Choose **Review warnings** for the leaving tutor.
3. Check the remaining student-assignment count is zero and review any payroll, planning, absence, or schedule warnings.
4. Choose **Retire tutor** (available on or after their final teaching date).

Retiring a tutor does **not** delete them or change MMS. It removes them from live choices in the tutor dashboard, onboarding, capacity, waiting-list matching, planning capture, and new tutor-absence choices. Historical payroll, planning, absence, and audit records remain.

## What is intentionally not automated

- The **Handover to** field is context, not an automatic student migration.
- Tutor retirement does not set the MMS teacher inactive.
- Student teacher assignments are never bulk-changed automatically in MMS.

Those boundaries keep an incorrect handover from silently moving a live lesson or attendance record. The streamlined process reduces repeated setup and tool-switching while retaining a deliberate MMS confirmation for every student.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| New tutor is not on `/dashboard` | Confirm their MMS ID, canonical Brain entry, `npm run sync-admin-tutors`, and deployment. |
| New tutor appears but has no students | Check MMS teacher assignment first; the dashboard reads the roster live from MMS. |
| Student appears under both tutors | Check MMS assignment, then align the Students sheet and Registry deliberately; resolve any tutor-conflict flag. |
| Outgoing tutor shows students in Retirement checks | They have not been reassigned in the dashboard yet. Keep the tutor as **Leaving**; do not retire. |
| Payroll remains visible after retirement | Expected. Retirement hides live operational choices, not historic or final pay work. |
