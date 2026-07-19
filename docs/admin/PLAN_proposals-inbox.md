# PLAN: Proposals Inbox — V1 (drafted replies to incoming messages)

*Designed and built 2026-07-19; feature flag remains off pending Finn's
privacy/policy sign-off in `AI_TOOL_CONTRACTS.md`.
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

## Hard constraints (from Finn's full policy text, 2026-07-19)

**Drafts must enforce the Lesson Cancellation Policy** (canonical: Obsidian
`05 Policies/Lesson Cancellation Policy.md` — read it in full; the summary below is
the classifier spec, not the policy home):

- **One-off moves never; permanent changes gladly.** The #1 subtlety: "can we miss
  Thursday?" must never be answered with a swap or make-up — but "can we change our
  slot going forward?" is *welcomed* and should get a warm "we'll work with you to
  find a better time" + route to Finn. The classifier's first job is telling these
  apart; when unsure which is meant, use the ambiguity rule.
- **The can't-attend options are real and should be offered:** a **Zoom lesson at the
  scheduled slot**, or a **practice video** (5–10 min with practice notes) — by notice
  window (lesson date from `Schedule_Context` vs message date):
  - Cancelled 7+ days out → cancelled, not charged.
  - Inside 7 days → charged; offer Zoom-at-slot or practice video.
  - No-show / same-day cancellation → charged; **no video** (and no draft should
    promise one).
  - Tutor-side cancellation → payment paused for that lesson.
- **Ending lessons:** two lessons' notice — acknowledge warmly, route to Finn.
- **Extended breaks:** 3 weeks free / weeks 4–5 charged / 6+ = step-back conversation;
  not in July–August. Pause requests route into the existing pause planning flow, not
  a drafted policy lecture.
- **Ambiguity rule:** if the lesson date, the notice window, or one-off-vs-permanent
  can't be established from evidence, the draft must be a neutral warm acknowledgement
  ("thanks for letting us know — I'll come back to you shortly") that commits to
  nothing — never a guessed policy outcome.
- Validation (deterministic, not prompt-hope): reject any draft offering a one-off
  reschedule/swap/make-up; reject any charge/no-charge/video claim that contradicts
  the computed notice window; reject a video promise on a same-day cancellation.

## Implemented build order

1. `AI_TOOL_CONTRACTS.md` allowlist entry → **Finn sign-off gate remains open**.
2. `Proposals` tab + pure helpers (+ contract guard pair + STATE_TABS_SCHEMA row).
3. Producer route (assembled from the existing redacted projections + AI runtime).
4. Policy classifier + deterministic draft validator (pure, tested — the cancellation
   rules above are the test cases).
5. Inline UI block + telemetry.
6. Data-protection map row; docs ritual.

Estimated: one session. Prerequisite decisions: none beyond the sign-off — the
cancellation policy interpretation notes in the policy file should be confirmed first.
