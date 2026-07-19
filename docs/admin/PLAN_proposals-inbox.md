# PLAN: Proposals Inbox — V1 (drafted replies to incoming messages)

*Designed 2026-07-19 in conversation with Finn; agreed in principle, NOT yet built.
This is the first lane of the "machine prepares, human commits" pattern. Read
`AI_RUNTIME_INTEGRATION.md` (the issue-briefing pilot is the architectural template)
and `AI_TOOL_CONTRACTS.md` (this needs a new allowlist entry + sign-off before any
model touches a real parent message).*

## The shape (agreed)

- **One lane only:** suggested replies for `Incoming_Message_Inbox` rows. Chosen
  because the execute step is already manual by design — the dashboard never sends
  WhatsApp; approving copies to clipboard + logs to `Communication_Log`.
- **Storage:** one generic `Proposals` tab (keyed upsert): `proposal_id · lane ·
  created_at · created_by · status (proposed/approved/rejected/expired/superseded) ·
  linked_id · mms_id · evidence_json (exactly what the model saw, redacted) ·
  proposal_body · decided_by · decided_at · rejection_reason · applied_at`.
  Proposals expire after 7 days; superseded if the underlying message changes.
- **Producer:** human-triggered button ("Draft reply" / "Draft all open") — no cron in
  V1. Server-side mirrors the issue-briefing pilot: redacted projections in, restricted
  AI key, 5s timeout, strict validation, rate limit, feature flag. Drafts follow the
  parent message tone (open Hi/Hello/Hey; calm, warm, British).
- **Surface:** NO new page, NO new nav. A quiet "Suggested reply" block on the inbox
  row: **Use this** (clipboard + Communication_Log + stamp) / **Edit then approve**
  (edited text is logged; the diff is telemetry) / **Discard** (optional reason). At
  most one Overview line when proposals are pending. A standalone page earns its
  existence only when a second lane exists.
- **Telemetry from day one:** used-unmodified vs edited vs discarded per proposal.
  Gate for lane 2 / overnight scheduling: ~70%+ used unmodified over ~4 weeks.

## Hard constraints (added by Finn, 2026-07-19)

**Drafts must enforce the Lesson Cancellation Policy** (canonical: Obsidian
`05 Policies/Lesson Cancellation Policy.md`):

- **Never offer a reschedule or make-up lesson.** This is the #1 failure mode — the
  natural "helpful" reply is exactly the policy breach (the design conversation's own
  sample draft made this mistake: "I'll speak to Kenny about a swap" — wrong).
- Classify by notice window before drafting, using the lesson date from
  `Schedule_Context` evidence vs the message date:
  - 7+ days out → cancellation acknowledged, no charge.
  - Inside 7 days → charged; a practice video will be sent in its place.
  - Same day → charged; no video.
- **Ambiguity rule:** if the lesson date or the notice window can't be established
  from evidence, the draft must be a neutral warm acknowledgement ("thanks for letting
  us know — I'll come back to you shortly") that commits to nothing — never a guessed
  policy outcome.
- Validation (deterministic, not prompt-hope): reject any draft containing
  reschedule/swap/make-up/move-the-lesson language; reject any charge/no-charge claim
  that contradicts the computed notice window.

## Build order when green-lit

1. `AI_TOOL_CONTRACTS.md` allowlist entry → **Finn sign-off gate**.
2. `Proposals` tab + pure helpers (+ contract guard pair + STATE_TABS_SCHEMA row).
3. Producer route (assembled from the existing redacted projections + AI runtime).
4. Policy classifier + deterministic draft validator (pure, tested — the cancellation
   rules above are the test cases).
5. Inline UI block + telemetry.
6. Data-protection map row; docs ritual.

Estimated: one session. Prerequisite decisions: none beyond the sign-off — the
cancellation policy interpretation notes in the policy file should be confirmed first.
