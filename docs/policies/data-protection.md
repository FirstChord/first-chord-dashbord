---
status: supporting
audience: [human, agent]
last_verified: 2026-07-20
---
# Data Protection Map And Open Decisions

## Status

This is a code-checked data inventory and a proposed retention schedule. It is
not yet a signed-off retention policy and does not authorise deletion. First
Chord is the controller; many data subjects are children, so minimisation,
clear access boundaries, and plain-language transparency matter especially.

## Store Inventory

| Store | Personal data and purpose | Proposed retention |
| --- | --- | --- |
| `Students`, registry/generated portal config | child/parent identity, contact, lesson, portal and Stripe linkage needed to provide tuition | enrolled; archive/remove through the established leaving flow |
| `Students_Archive` | leaving snapshot for disputes/re-enrolment | 2 years after leaving |
| `Practice_Notes_Log` and Gmail Sent | progress notes, recipient, delivery IDs; lesson-note service | 2 years after leaving; align both stores |
| `Student_Portal_Access` | encrypted family notes code, credential verifier/version, and staff rollout confirmations | enrolled; remove through the established leaving/portal-removal flow |
| `Incoming_Message_Inbox`, `WhatsApp_Group_Map`, local bridge cache | parent messages, phones, group/student mapping for lesson administration | handled/ignored inbox rows 12 months; cache 14 days/2,000 by default; confirmed map while operationally needed |
| `Communication_Log`, `Parent_Understanding_State` | copied parent communication and human relationship notes | communications 2 years; review subjective understanding notes yearly |
| planning, absence, pause, issue and event lanes | named operational workflow and audit evidence | workflow rows while active/useful; `Event_Log` proposed 2 years; never erase evidence to fake recovery |
| song/path/assignment/request/outcome lanes | student IDs, tutor names, learning telemetry and free-text outcomes | review periodically; do not turn tutor-linked outcomes into performance ranking |
| payroll, pay config, Wise, cover-bank lanes | tutor identity, phone, availability, earnings and recipient IDs | financial records 6 years; contact/availability while engaged |
| Stripe/MMS/Google/Wise/Soundslice/GitHub | provider-held data required for payments, lessons, content, hosting and code | governed by the school purpose plus provider terms/DPA |
| Railway PostgreSQL `practice_note_delivery_claims` | pseudonymous delivery key and acting tutor used to prevent duplicate sends | retain while it is required to prove/block delivery replay; no note body |
| local Sheets backups | copies of managed operational tabs | bounded backup-set count; off-machine copies must use the same window |
| OpenAI proposal/briefing inputs | bounded redacted operational projections when an explicitly enabled pilot calls the model | ephemeral provider processing plus minimal decision/evaluation telemetry; reply pilot remains off pending sign-off |

The complete tab/key/writer inventory is [State tabs](../architecture/data/state-tabs.md).
When a store or purpose is added there, update this map in the same change.

## Current Exposure Decisions

1. `/dashboard` is a low-friction public tutor surface. It exposes student names,
   notes, and capability links without persistent tutor identity. The recommended
   fix is tutor-scoped Google login/allow-list before adding broader sensitive
   reads or writes.
2. Student portal names/paths remain guessable, but Student Voice notes now load
   separately and can be moved one family at a time behind a memorable code. A
   missing rollout row preserves legacy public notes during transition; a failed
   access-state read fails closed. Complete the rollout campaign and explain this
   access model in the parent-facing privacy notice.
3. The incoming WhatsApp bridge retains parent group content locally and in
   Sheets for administration. A parent-facing privacy notice must explain this.
4. The Practice Chat transcription relay currently exposes its raw OpenAI key to
   browsers. Follow the active staged cutover and rotate that key; this is a
   credential exposure, not a retention-policy choice.
5. Reply-proposal generation may send redacted parent text to OpenAI. Unknown
   names/indirect identifiers can survive deterministic redaction. The feature
   stays off until explicit policy/privacy sign-off.

## Leaving And Rights Requests

The existing leave action archives the `Students` row and removes the registry
entry. It does not currently prune related notes, message logs, communications,
understanding notes, or all provider copies.

For access or erasure, use this inventory and stable student/provider IDs to
search every store. Preserve records required by legal obligation (including
the proposed six-year financial window) and the minimum audit needed to explain
consequential actions. Record what was supplied, retained, or deleted and why.
Never bulk-delete from a generated report.

## Retention Report

`npm run retention:report` is read-only. Its policy list is hard-coded in
`scripts/retention-report.mjs`; it does not parse this Markdown. It counts dated
rows against proposed windows and cannot safely determine every student's leave
date or legal exception. Review its output per tab before any manual pruning.

## Sign-Off Needed

- approve or amend every proposed retention window
- publish a parent-facing privacy notice and contact route
- choose tutor-dashboard and student-note access changes
- confirm repository access and FileVault/off-machine backup protection
- agree the OpenAI reply-proposal processing terms before enabling its flag
- define and rehearse a reviewed per-student deletion/export procedure

Until then, minimisation improvements that do not destroy required history are
welcome; automated deletion is not.
