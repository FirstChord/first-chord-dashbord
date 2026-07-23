---
status: canonical
audience: [human, agent]
last_verified: 2026-07-20
---
# Admin current status

This is a snapshot of active direction, recent delivery, and open choices. It is
not a changelog or a second policy manual. Use Git history for chronology, the
Obsidian Learning Log for rationale, and the focused linked document for durable
implementation rules.

## Active direction

V3 established the operating loop:

```text
Detected -> Guided -> Actioned -> Logged -> Resolved / Kept Active
```

V4 adds small, explainable context layers that reduce the cognitive cost of
running the school. The private `/admin` dashboard is the active operating
surface. The overview is a meeting start, not a complete status board: a card
earns attention only when it represents work for today, near-term action, or a
deliberate school-improvement prompt.

## Recently shipped

- **Intent-led repository docs (2026-07-20):** one router, explicit lifecycle
  metadata, historical separation, and `npm run docs:check` in CI.
- **Incoming reply proposals (built, deliberately off):** deterministic policy
  checks plus optional model wording are implemented, but
  `ADMIN_AI_REPLY_DRAFT_ENABLED` remains unset pending a later small pilot and
  the sign-off in [AI tool contracts](./architecture/ai/tool-contracts.md).
  Stored decisions remain reviewable while the feature is off.
- **Continuity and recovery:** operations-without-Finn guidance, rehearsed Sheets
  restore, managed-tab backup coverage, and contract tests are live. See
  [continuity](./operations/continuity.md) and
  [disaster recovery](./operations/disaster-recovery.md).
- **Teaching and finance layers:** catalogue/path templates, tutor-visible song
  assignments, outcome/request telemetry, payroll statements, and money-path
  invariants are live. Current gaps are in
  [song coverage](./reference/song-catalogue-coverage.md) and the
  [payroll plan](./plans/active/tutor-payroll.md).

## Current operating contracts

| Area | Current boundary |
|---|---|
| Context | Student lifecycle, schedule, payment value, and capacity summaries are derived/read-only. They do not become provider truth or authorise actions. |
| Navigation | Overview starts work; Issues handles detected problems; Workflows holds recurring processes; Planning holds due work, reflection, notes, and initiatives. Student records are reached through search and workflow links. |
| Capacity | MMS `Free` events remain source truth. Waiting-list matches are hints filtered by instrument, never reservations or automatic assignment. |
| Planning | `Planning_Items` is human work state, not a project-management or workflow engine. Friday reflection and Monday scheduling are seeded planning prompts. |
| Pauses | Generic completion never changes payment state. The guarded pause-completion action requires human confirmation, writes through the existing student route, and logs to `Event_Log`. |
| Messaging | Parent communication remains approval-first. `Communication_Log` means copied to send, not proven sent; inbound classifications and reply drafts remain proposals. |
| Practice Chat | All registered tutors are enabled unless temporarily constrained. The tutor self-attests, the student must have one clear tutor assignment, the final screen names the server-derived recipient, and PostgreSQL claims the delivery key before MMS/Gmail work. Ambiguous Gmail outcomes require manual follow-up. |
| Student portal notes | Profile URLs and non-note resources stay public. Student Voice notes load through a separate no-store API; families are moved individually to memorable-code protection through the claimed admin rollout queue. A missing rollout row remains legacy-public, while an access-state failure fails closed. |
| Finance | Sheets holds operating estimates/review state; Stripe and Wise remain provider truth. Payroll preparation does not execute Wise payment. |
| Public tutor surfaces | Low-friction tutor identity is not durable authentication. Do not add broader sensitive reads or consequential writes before tutor auth. |

Canonical details live in [state ownership](./architecture/data/ownership.md),
[state tabs](./architecture/data/state-tabs.md),
[workflow design](./policies/workflow-design.md), and the focused workflow docs.

## Next choices

- **Practice Chat transcription security:** the current PWA can receive the raw
  OpenAI key from the relay. Complete the staged server-side transcription
  cutover, remove `/api-key`, and rotate the exposed key in a no-lessons window.
  See [the active hardening checklist](./plans/active/practice-chat-whisper-hardening.md).
- **Cover test cleanup:** before 22 July, check MMS event `evt_zsGLw6J0` at
  14:00 and restore Tom unless Dean is genuinely covering. This is a manual MMS
  check; automation remains parked in [the cover note](./plans/parked/cover-loop.md).
- **Student paths:** decide whether current use justifies RSL Grade 7–8 ingestion,
  recommendation/progress work, or fretboard/chord paths. Finn must still create
  the missing Soundslice slices listed in
  [song coverage](./reference/song-catalogue-coverage.md).
- **Tutor payroll Phase 3:** scheduled statement delivery and tutor-selected
  cadence remain gated by persistent tutor auth/contact email.
- **Pause clarity:** distinguish Pause History, sheet expectation, and live Stripe
  evidence more clearly without adding Stripe mutation to Issues.
- **Tutor dashboard auth:** collect tutor login emails, then put `/dashboard`
  behind per-tutor NextAuth sessions. This upgrades self-attested identity and
  unblocks more sensitive tutor features.
- **Reply proposal experiment:** leave the feature flag off until Finn explicitly
  starts a one-by-one pilot and accepts the privacy/policy terms. Avoid a bulk
  “draft all” start.
- **Incoming-message follow-ups:** settle retention/lawful-basis wording, capture
  the lesson group during onboarding, add removal for sibling mappings if needed,
  and prune the ineffective inactivity-timestamp path.
- **Practice Chat operational check:** use one approved real note to verify the
  recipient, MMS attendance, Gmail ID, Sheets audit, PostgreSQL claim, and
  duplicate response after relevant delivery changes.
- **Monolith splits:** remaining candidates and extraction discipline live in
  [the active split map](./plans/active/monolith-split.md).

## Deliberately not next

- heavy assignment, ownership, CRM, or generic workflow systems;
- WhatsApp auto-send or general automated parent messaging;
- Stripe mutations from Issues or model output;
- a database rewrite before measured Sheets limits justify one;
- direct edits to generated portal configuration files.

## Fragile contracts

Do not change these without updating their parser/consumer and focused tests:

- MMS sign-up labels `Preferred days` and `Preferred times`;
- the Google Sheets `Students` header row;
- MMS attendance status strings used by payroll;
- Wise CSV column order and money rounding;
- exact pause-note date labels used by pause forecasting;
- scheduled GitHub workflows, which can stop after prolonged inactivity.

Before deployment, follow [AGENTS.md](../AGENTS.md) and the
[operations runbook](./operations/runbook.md). Keep this file short: when detail
becomes durable, move it to the focused canonical document and leave only the
current decision or status here.
