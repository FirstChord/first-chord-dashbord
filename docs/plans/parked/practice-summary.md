---
status: parked
audience: [human, agent]
last_verified: null
---
# Plan: "What to work on" note summary — tutor dashboard

> Status: **built and deployed 2026-07-16 (`8d7e3fe`), final shape differs from this plan.** The tabbed Summary was built (twice: timeline view, then a
> recurrence-mined arc), then **subtracted the same day**: deterministic prose is
> verbatim ASR, so a prose summary re-renders the notes — the reorder + arc facts
> now live *inside* the Notes panel as a green "Lesson Focus" box and one
> "On the go" pieces line. Engine: `lib/admin/practice-summary-helpers.mjs`.
> Phase 2 (AI)
> deliberately not started — needs its own `docs/architecture/ai/tool-contracts.md` allowlist entry and
> sign-off first. Build diverged from this plan in one way: no new route was needed —
> the existing `/api/notes/[studentId]` already had tutor-token auth and the owned
> Practice-Notes read path, so the summary is a `?summary=1` mode on it (guarded by
> `tests/admin/notes-summary-route-boundary.test.mjs`). Hand-off document — read
> alongside the code it references (do not trust this prose over the code).

## Goal
On the tutor dashboard, give a tutor a fast, targeted read of a student's recent
notes: *"here's what you've been doing, here's what to work on next"* — surfaced
at the moment before a lesson.

## Core principle: deterministic-first, AI-optional
Mirror the house pattern already used for issue briefings (`docs/architecture/ai/tool-contracts.md`
→ "deterministic explanation" + "optional AI briefing"):

- **Layer 1 (deterministic, always on):** `buildStudentPracticeTimeline()`
  (`lib/admin/practice-timeline-helpers.mjs`) already yields the structured
  signal — `nextLessonFocus` (last lesson's goals), `tempoTrend`, chronological
  arc. This is the source of truth and ships/works with **no AI**.
- **Layer 2 (AI, optional):** a natural-language summary generated *from* Layer 1's
  structured data, that degrades gracefully to Layer 1 if AI is unconfigured or
  fails. The AI never invents facts — it only rephrases/prioritises what the notes
  already contain (critical given the ASR corruption in the raw notes).

## UX (tabbed panel — no sudden change)
The existing **"Previous Notes"** panel (`app/dashboard/page-client.js` → `NotesPanel`,
`components/student/NotesPanel.js`) opens unchanged. Add a two-tab header inside
the panel:

- **Notes** (default, current behaviour — no sudden change)
- **Summary** — flips to: a "Lesson Focus" callout + a short *"what you
  worked on"* / *"suggested focus"* summary + the tempo trend.

Summary tab **lazy-loads** on first click (fetch + spinner), caches per student
for the session.

## Architecture / data flow
```
Practice_Notes_Log (sheet)
  → getPracticeNoteLogRows(studentId)  [normalises + derives fields — the Fennella fix]
  → buildStudentPracticeTimeline()     [deterministic structured summary]   ← reuse, exists
  → [optional] practice-summary AI contract+provider  [NL summary]          ← new, mirrors issue-briefing
  → /api/tutor/practice-summary/[studentId]  [route boundary]               ← new
  → NotesPanel "Summary" tab                                                ← new tab in existing component
```

**New files (mirroring existing AI infra):**
- `lib/admin/practice-summary-ai-contract.mjs` — schema version, prompt version,
  `buildPracticeSummaryInput(timeline)`, output JSON schema,
  `validatePracticeSummary()` with length limits. Copy the shape of
  `lib/admin/issue-explanation-ai-contract.mjs`.
- `lib/admin/practice-summary-ai-provider.mjs` — mirror the bounded transport
  controls in `lib/admin/issue-explanation-ai-provider.mjs`, but keep a
  feature-specific provider and input contract. Do not turn the issue provider
  into a generic `askOpenAI(anything)` pipe. Reusing the same dedicated project
  or env names is a separate privacy/cost decision at implementation time.
- `app/api/tutor/practice-summary/[studentId]/route.js` — route boundary.

**Reusable deterministic inputs:** `buildStudentPracticeTimeline` and
`getPracticeNoteLogRows`. The admin-only issue feedback route is not reusable
as-is for a tutor surface; any future feedback endpoint needs a capability tag,
the correct tutor identity boundary, and its own retention/evaluation contract.

## AI contract (Layer 2)
- **Input:** the deterministic timeline object *only* (not raw notes) — bounds
  tokens and keeps the model on-rails.
- **Output (JSON, validated):** `{ workedOn: string, suggestedFocus: string[2-4],
  schemaVersion, promptVersion }`.
- **Guardrails:** summarise only from provided fields; no new piece names/facts;
  deterministic timeline always renders alongside; AI text labelled *"AI summary
  of your notes — check against the lesson notes."*

## Auth & privacy (the real integration risks — flag for review)
1. **Different auth boundary.** The issue-briefing route
   (`app/api/admin/issues/[mmsId]/ai-explanation/route.js`) gates on
   `session.user.isAdmin`. The tutor dashboard is **not** next-auth — it's the
   token surface (`lib/tutor-surface-token.mjs`). The new route must authenticate
   via the **tutor token**, not admin session. This is the main non-trivial piece.
2. **Data-shape mismatch.** The tutor dashboard's `/api/notes/[studentId]` can
   return MMS-shaped notes, *not* normalised `Practice_Notes_Log` rows. The summary
   must read from the owned Practice-Notes path (via `getPracticeNoteLogRows`) so
   the timeline engine gets the shape it expects.
3. **Governance.** Add this capability to `docs/architecture/ai/tool-contracts.md` allowlist
   (it has an "Explicitly Not Allowlisted" section — new AI capabilities require
   explicit sign-off). Note privacy: tutor-facing only, ephemeral, internal notes,
   nothing new sent parent-side.

## Phasing
- **Phase 1 (no AI):** tab + deterministic Summary view (focus callout + tempo
  trend + "what we did" lines). Ships value immediately, zero AI risk. *This alone
  may be enough.*
- **Phase 2 (AI):** add the contract/provider/route for the NL summary, behind the
  config gate, with feedback capture.

## Open questions for review
- Is the tutor-token → owned-Practice-Notes read path sound, or is there a cleaner
  existing helper?
- Phase-1-only (deterministic) vs. is the AI rephrasing worth Phase 2 given the
  notes are already fairly readable?
- Does routing this through the existing `ADMIN_AI_*` provider stay within the
  governance/privacy contract, or does a tutor-facing AI surface need its own
  allowlist entry?

## Context / prior work this builds on
- `lib/admin/practice-timeline-helpers.mjs` + `components/admin/PracticeTimelineSection.js`
  — the deterministic timeline (already live on the admin student-detail page,
  `app/admin/students/[mmsId]/page.js`).
- `lib/admin/practice-notes-helpers.mjs` → `parsePracticeNoteSections` /
  `normalisePracticeNoteLogRow` — derives the structured what-we-did / progress /
  goals fields from raw note text (fixes the Level 2 / Fennella blank-column case).
- Issue-briefings AI infra (commit `a85debf`) — the contract/provider/route/feedback
  pattern this plan mirrors.
