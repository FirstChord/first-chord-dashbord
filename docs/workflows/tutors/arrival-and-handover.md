---
status: supporting
audience: [human, agent]
last_verified: 2026-08-13
---
# Workflow: Tutor Arrival and Handover

**Purpose:** Bring a tutor into First Chord once, transfer a departing tutor's students safely, and retire the old tutor only when the transfer is real.

**Last updated:** 13 August 2026

## The short version

Treat this as one handover, not a separate setup task for every student:

```text
set up the incoming tutor once
        ↓
make one transfer roster
        ↓
create the incoming MMS assignment and end the outgoing series at the boundary
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
   Before their first lesson exists, verify the full name and instruments from
   the MMS teacher profile itself: `FullName` and `Subjects` remain available
   even when roster and calendar searches correctly return no rows.
2. Add the tutor once to the canonical `TUTORS` list in
   `first-chord-brain/tutors.py` with:
   - short name
   - full name
   - MMS teacher ID
   - instruments taught
3. From `first-chord-brain`, run
   `python3 -m unittest tests/test_tutor_roster.py`, then
   `python3 generate_fc_ids.py --no-sheets`.
   Check that the tutor count increases by one and the new MMS ID produces one
   tutor/person identity. `--no-sheets` writes local derived CSVs but cannot
   change the live FC tabs; its final summary must say the tabs were not updated.
4. After reviewing that rehearsal, run `python3 generate_fc_ids.py` without
   `--no-sheets` to update the live FC identity tabs. This is the explicit live
   write step. Confirm `FC_Tutors` contains the new MMS ID exactly once.
5. Commit the canonical Brain source change and only its intended identity
   artifacts, then push through the normal human-reviewed Brain release step.
   Do not accidentally include unrelated onboarding vault or first-seen work.
6. From this dashboard repository, run `npm run sync-admin-tutors`, followed by
   `npm run check-admin-tutors`. Review the generated `lib/admin/tutors-data.js`,
   then run `npm run validate`, `npm run test:admin`, `npm run lint` and
   `npm run build`. Commit and deploy the generated identity change only after
   those checks are understood.
7. Check `/dashboard`: the new tutor should appear and an empty roster should
   load without error.
8. If tutor-dashboard authentication is `pilot` or `required`, add the tutor's
   exact Google email and short tutor key to Railway's
   `TUTOR_DASHBOARD_EMAIL_MAP`. Test that their account can see their tutor only.
   This grants access; it is separate from making the tutor appear in the roster.
9. Complete only the operational details that apply:
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

Record one effective handover date: the first date on which the incoming tutor,
not the outgoing tutor, should own the lesson. For each student, use these
columns:

| Student | Incoming MMS profile/series | Outgoing series ended at boundary | Dashboard aligned |
| --- | --- | --- | --- |
| Student name | date / initials | date / initials | date / initials |

Work through the list in this order, grouping all MMS changes into one focused pass rather than repeatedly switching tools.

### A. Complete the MMS transfer

Create or confirm the incoming tutor's active billing profile and lesson series.
Then end or remove the outgoing recurring series from the effective handover date
while preserving any lessons that genuinely happen before it.

An active incoming billing profile is not enough evidence that the transfer is
complete. Search the calendar on and after the effective date and require:

- the intended incoming lesson exists at the intended time;
- no outgoing lesson remains for the same student on or after the boundary;
- a shared/group lesson has the complete intended student set;
- the old billing profile is not still an active competing assignment unless
  there is a separately documented reason.

This is the actual transfer: it controls the live roster, calendar, attendance,
and payroll context. A same-time old/new pair is a duplicate booking, not a
successful handover.

### B. Align dashboard student records

Only after the MMS evidence above is unambiguous, open the student's admin record
and update the tutor in both the **Students sheet** and **Registry** sections.
This keeps the admin dashboard and portal configuration aligned with MMS.

If a partial handover is discovered after dashboard alignment, do not hide it by
reverting or guessing. Record the remaining MMS conflict, keep the outgoing tutor
as **Leaving**, and block retirement until the calendar checks pass. Treat that
as recovery from partial state, not as the normal sequence.

The student remains active, keeps their payment setup, and keeps their portal; no student archive action is involved.

### C. Mark the roster columns

Do not infer completion from memory. The separate ticks distinguish a new
billing/profile setup, removal of the old schedule, and a dashboard-only edit.
They make it safe to stop and resume the handover.

## Part 4 — Verify in batches

After a group of transfers, not after every individual edit:

1. Open `/dashboard`, select the incoming tutor, and use **Refresh**.
2. Confirm the transferred students appear on the new tutor's roster and schedule.
3. Check the outgoing tutor's dashboard roster no longer includes them.
4. Search the effective date plus the next two recurrence dates and confirm
   there is exactly one intended lesson per student/group.
5. Search the outgoing tutor's **complete** calendar and roster on the same
   dates, not only the selected transfer students. Any unrelated future lesson
   or active billing profile is separate handover work and blocks retirement.
6. Resolve any tutor-conflict flags before continuing.

This batch verification is the main time-saver: the new tutor is configured once and the live MMS roster is checked once per handover group, not once per setup step.

## Part 5 — Retire the outgoing tutor

Only after every student transfer is complete, the outgoing tutor's full
post-boundary MMS calendar contains no lessons, and no active billing profile
still assigns a student to them:

1. Return to `/admin/tutors`.
2. Choose **Review warnings** for the leaving tutor.
3. Check the remaining student-assignment count is zero and review any payroll,
   planning, absence, or schedule warnings. A cached warning must be checked
   against fresh MMS evidence before it is dismissed as stale.
4. Choose **Retire tutor** (available on or after their final teaching date).

Retiring a tutor does **not** delete them or change MMS. It removes them from live choices in the tutor dashboard, onboarding, capacity, waiting-list matching, planning capture, and new tutor-absence choices. Historical payroll, planning, absence, and audit records remain.

## What is intentionally not automated

- The **Handover to** field is context, not an automatic student migration.
- Tutor retirement does not set the MMS teacher inactive.
- Student teacher assignments are never bulk-changed automatically in MMS.

Those boundaries keep an incorrect handover from silently moving a live lesson or attendance record. The streamlined process reduces repeated setup and tool-switching while retaining a deliberate MMS confirmation for every student.

## Deterministic dashboard direction

`/admin/tutors` already owns the leaving/retired lifecycle and its historical
audit. The next safe reduction in manual work is one explicit handover preview,
not automatic MMS mutation. It should:

1. take an outgoing tutor, incoming tutor, effective date, and selected roster;
2. read fresh MMS billing profiles and future events for those MMS student IDs,
   plus the outgoing tutor's complete future roster/calendar;
3. block alignment while an outgoing post-boundary event, missing incoming
   event, unexpected time, or incomplete group remains;
4. show the exact Students/registry cells that will change;
5. require one human confirmation, batch the eligible Sheets cells, make one
   registry commit, and append attempted/completed audit events;
6. be retry-safe by reloading all three lanes and proposing only outstanding
   changes.

MMS series removal should remain a separately reviewed MMS action unless a
narrow, tested series-end contract is added. Broad MMS write access is not part
of this dashboard workflow.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| New tutor is not on `/dashboard` | Confirm their MMS ID, `first-chord-brain/tutors.py` entry, `npm run check-admin-tutors`, and deployment. |
| Tutor appears but cannot sign in | If auth is `pilot` or `required`, check their exact email-to-short-name entry in Railway's `TUTOR_DASHBOARD_EMAIL_MAP`; never commit personal email addresses. |
| New tutor appears but has no students | Check MMS teacher assignment first; the dashboard reads the roster live from MMS. |
| Student appears under both tutors | Check MMS assignment, then align the Students sheet and Registry deliberately; resolve any tutor-conflict flag. |
| Student has two lessons after the handover date | End the outgoing recurring series from the boundary; do not treat the incoming billing profile as proof of completion. Check at least the boundary date and the next two recurrences. |
| Selected transfers are clean but the outgoing tutor still has lessons | Audit the tutor's complete future calendar and roster. Those other students need their own explicit handover or series closure before retirement. |
| Outgoing tutor shows students in Retirement checks | They have not been reassigned in the dashboard yet. Keep the tutor as **Leaving**; do not retire. |
| Payroll remains visible after retirement | Expected. Retirement hides live operational choices, not historic or final pay work. |
