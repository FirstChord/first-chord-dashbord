---
status: parked
audience: [human, agent]
last_verified: 2026-07-20
---
# Cover Loop: Shipped Surface And Parked MMS Write

## Current State

The safe cover-assignment assistance is shipped:

- absence cover choice ranks Cover Bank candidates by availability, notice,
  existing teaching, and instrument fit without hiding alternatives
- external candidates remain visible but have no MMS teacher identity
- **Copy ask** creates editable WhatsApp copy and logs the clipboard action in
  `Communication_Log`; it does not send
- `Tutor_Absence_State` retains the chosen tutor and confirmation/briefing state

The ranking is advisory. The human confirms who accepted and completes calendar
and parent communication.

## Parked MMS Reassignment

Automated lesson reassignment is not being built. A captured MMS request showed
that a single event can retain `OriginalTeacherID` while changing `TeacherID`,
but the stored API-key profile token returned 404 for the write. The endpoint
appears to require a short-lived Teacher-session token, creating an unjustified
credential/maintenance burden for a ten-second manual MMS step.

If reconsidered, the write must be single-event only, previewed, explicitly
confirmed, idempotent, logged, and recoverable. It must never update the series;
external cover tutors remain excluded. Payroll attribution and parent-calendar
behaviour must be verified before release.

## Outstanding Manual Check

The 2026-07-16 capture notes say MMS event `evt_zsGLw6J0` on 2026-07-22 at 14:00
was left reassigned from Tom to Dean as a real test. Before that lesson, check the
MMS UI and revert it to Tom if Dean is not genuinely covering. While checking,
record whether the UI makes another request after `updaterequirements` only if
this parked automation is likely to be reopened.

This repository note is not authority to mutate MMS automatically.

## Reopen Gate

Reopen only if the repeated manual reassignment burden outweighs new MMS-write
and rotating-session-token risk. Start from current MMS behaviour, not the old
captured payload.
