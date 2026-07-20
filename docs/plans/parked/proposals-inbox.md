---
status: parked
audience: [human, agent]
last_verified: 2026-07-20
---
# Experiment Later: Policy-Guarded Inbox Reply Proposals

The implementation exists but `ADMIN_AI_REPLY_DRAFT_ENABLED` remains off. Do
not enable it until Finn explicitly accepts the privacy/policy conditions in
[AI tool contracts](../../architecture/ai/tool-contracts.md). Stored proposals
remain reviewable while generation is disabled.

## Pilot Shape

- one lane: draft a reply for one selected `Incoming_Message_Inbox` row
- human-triggered only; no cron or automatic Draft All
- server sends a bounded, redacted projection through the dedicated restricted
  AI runtime, validates the result deterministically, and stores it in
  `Proposals`
- inline review offers use, edit, or discard
- use/edit copies to clipboard and logs `Communication_Log`; it never sends
- proposals expire after seven days and are superseded when underlying evidence
  changes

## Policy Guard

The deterministic cancellation classifier/validator—not the prompt—must reject
drafts that:

- offer a one-off reschedule, swap, or make-up
- contradict the computed notice boundary on charge/no-charge wording
- promise a video lesson for a same-day cancellation
- invent a policy outcome when evidence is unknown

Permanent schedule changes remain welcome and route to a human. Unknown cases
use neutral acknowledgement that commits to nothing.

## Privacy Gate

The feature may send redacted parent message text to OpenAI. Roster-name,
phone/email, and URL redaction cannot guarantee removal of unknown names or
indirect identifiers. Before enabling, confirm provider project/key isolation,
retention expectations, logging limits, representative synthetic evaluation,
and the parent-facing privacy position.

## Pilot And Stop Conditions

1. Enable only on the canonical admin service for a small, time-bounded pilot.
2. Draft individual low-risk messages; compare evidence, policy result, and copy.
3. Record used-unmodified, edited, discarded, latency, validation failure, and
   generation failure without storing extra message content in logs.
4. Disable immediately for policy leakage, misleading wording, privacy concern,
   or unacceptable latency. Existing deterministic/manual inbox work continues.

Do not widen to another proposal lane or background generation based only on a
small anecdotal sample. The execute boundary stays human copy/send regardless of
draft quality.
