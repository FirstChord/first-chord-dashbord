# Practice Chat Delivery Audit

Last updated: 2026-06-21

This is a read-only audit note for Practice Chat delivery before widening Level 2 beyond Finn, Tom, and Fenella.

Do not treat this as an implementation plan by itself. Confirm each point against current code before changing behaviour.

## Current Pilot Boundary

Level 2 Practice Chat currently:

- accepts calls from the Practice Chat PWA through dashboard API routes
- uses a shared bridge secret plus allowed browser origins
- is limited to dashboard-verified students whose tutor is Finn, Tom, or Fenella, plus Test Studenty
- previews the selected MMS attendance target before writing
- writes the note/attendance to MMS
- sends the parent note through First Chord Gmail
- upserts delivery/audit state into `Practice_Notes_Log`
- uses `delivery_key = student + MMS attendance + note hash` to avoid duplicate sends for the same delivery

This is acceptable for the trusted pilot. It is not yet enough for a full tutor rollout.

## Widening Blockers

Before enabling Level 2 for more tutors:

1. Identify the caller.
   - The shared secret proves the request came through an approved bridge, not which tutor pressed the button.
   - The delivery row should record the acting tutor/user identity.

2. Authorise the caller for the student.
   - A tutor should only write/send notes for students they are allowed to teach, unless an admin override is explicit.
   - The current pilot gate is based on the student's tutor, not authenticated caller identity.

3. Move the allow-list out of code.
   - The pilot tutor list should be config-driven before staged rollout, so expanding the pilot does not require code edits.

4. Confirm duplicate-send safety under concurrency.
   - `delivery_key` protects normal retries and duplicate clicks after a row exists.
   - Google Sheets upsert is not a database transaction; verify two near-simultaneous execute requests cannot send two parent emails before either sees the other's row.

## Fast-Follows During Rollout

- Add an admin view for failed or manual-follow-up Practice Chat deliveries.
- Surface Gmail-sent/MMS-failed cases clearly, because that creates a payroll/attendance gap even if the parent received the note.
- Validate that the chosen recipient email belongs to the target student's MMS family/contact data.
- Document secret rotation and basic rate limiting for the Practice Chat bridge.

## Source-Of-Truth Notes

- `Practice_Notes_Log` is dashboard-owned learning/delivery memory.
- MMS remains attendance/payroll continuity until payroll no longer depends on MMS attendance.
- Sent/completed First Chord notes can be parent-visible in portals.
- Draft, in-progress, failed, and snapshot-only rows are not proof of delivery.

## Manual Checks Before Widening

- Execute one real Finn/Tom/Fenella pilot note end-to-end.
- Confirm the parent receives the email.
- Confirm MMS attendance is present and the note is visible where expected.
- Confirm `Practice_Notes_Log` contains recipient, send status, Gmail ID, MMS attendance ID, and completed status.
- Attempt a duplicate send and confirm it returns the existing delivery rather than emailing again.
- Confirm failed Gmail or MMS paths are visible enough for admin follow-up.
