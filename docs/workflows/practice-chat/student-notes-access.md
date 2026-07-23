---
status: canonical
audience: [human, agent]
last_verified: 2026-07-23
---
# Student notes access rollout

Student profile URLs remain unchanged and their songs, links, and practice
resources remain public. Only the Student Voice lesson-note panel is gated.

## Staff campaign

Use `/admin/workflows/student-notes-access`.

1. Claim the family so another administrator can see who is handling it.
2. Generate or reveal the memorable code.
3. Put `First Chord notes code: <code>` in the WhatsApp group description and
   confirm that step.
4. Copy and manually send the personalised explanation, then explicitly confirm
   that it was sent.
5. Activate protection. Activation is unavailable until both confirmations are
   present.

Claims may be released or deliberately taken over. A blocked family should be
marked `needs_follow_up` with the reason. Onboarding creates a visible,
non-blocking follow-up in this same queue; it never rolls back otherwise
successful Sheets, registry, or MMS work.

The explicitly flagged Test Studenty record (`sdt_fBg9JN`, `/test`) is the only
test record allowed into this campaign, so the complete lock/unlock flow can be
smoke-tested without using a real family. It remains excluded from every other
operational surface.

`Communication_Log` records a redacted copy template, not delivery and never the
real code. The workflow's `message_sent_at` is a human assertion that the
WhatsApp send happened.

## Access boundary

`Student_Portal_Access` is keyed by MMS student ID. Codes use a friendly word
plus two digits. The stored row contains an encrypted copy for authenticated
admin handover and a salted, secret-peppered verifier for public checking.
Plaintext codes must not be logged, cached, rendered into initial profile data,
or placed in audit payloads.

A protected student receives a student-scoped signed device cookie for one year
after a successful code entry. Resetting a code leaves the current credential
working until the replacement has both WhatsApp confirmations and is activated;
activation increments the credential version and invalidates previous cookies.

The public notes endpoint force-refreshes `Student_Portal_Access` before fetching
any note, so a separate public runtime cannot keep serving a stale legacy-public
decision after an administrator activates protection:

- no row or protection off: phased legacy-public note response;
- protection on and valid cookie: note response;
- protection on without a valid cookie: locked response with no note;
- Sheets/secret uncertainty for a protected student: fail closed.

The in-memory limiter allows five failed attempts per student and client in a
15-minute window. It is a light privacy control and resets with the public
service; use a shared limiter before scaling that service across replicas.

## Recovery

- A lost code can be revealed by an authenticated administrator.
- Generate a replacement if the WhatsApp description is wrong or compromised;
  both confirmations reset and must be completed again.
- If `STUDENT_PORTAL_NOTES_SECRET` is missing, restore the same value on the
  canonical admin and public portal services. Do not invent a replacement during
  an incident: rotation makes existing encrypted codes unreadable.
- If activation state is uncertain, inspect `Student_Portal_Access` and
  `Event_Log`; do not infer completion from `Communication_Log`.
