# New Agent Start Here — Admin Dashboard

Last updated: 2026-05-29

This is the practical handoff note for a new Codex/AI agent working on the First Chord admin dashboard.

## Paths

- Repo: `/Users/finnlemarinel/Desktop/FirstChord/music-school-dashboard`
- Obsidian vault: `/Users/finnlemarinel/FirstChordOS`
- Obsidian OS docs: `/Users/finnlemarinel/FirstChordOS/docs/obsidian`
- Live Railway app: `https://efficient-sparkle-production.up.railway.app`

## First Checks

```bash
git status --short --branch
git log --oneline -5
npm run test:admin
npm run build
```

Use `npm run dev` for local testing. Next may choose another port if `3000` is already in use.

## Current Direction

V3 closed loops. V4 is adding context layers.

Current operating principle:

Detected → Guided → Actioned → Logged → Resolved / Kept Active

Recent V4 layers include:

- derived student lifecycle context
- MMS schedule context
- payment value context
- MMS Free-slot capacity context
- clickable waiting-list capacity slots into onboarding
- first-name learner labels in onboarding message copy
- parent understanding workflow at `/admin/workflows/parent-understanding`

## Read These First

1. `docs/admin/CURRENT_STATUS.md`
2. `docs/admin/V3_LOOP_ARCHITECTURE.md`
3. `docs/admin/OWNERSHIP_MATRIX.md`
4. `docs/admin/SCHOOL_POLICY.md`
5. `docs/admin/PAYMENTS_RULES.md` if touching Stripe, pauses, or payment expectations
6. `docs/admin/BUG_FIXES.md` if debugging Railway, MMS calendar times, or recent production issues
7. Obsidian: `08 Operations/Current System Map.md`
8. Obsidian: `08 Operations/Active Roadmap.md`

## Source-of-Truth Rules

- Sheets = operational school truth
- Registry = portal config truth
- MMS = lesson/scheduling truth
- Stripe = payment provider truth
- `Issue_Queue` = workflow state
- `Event_Log` = action history
- `Pause History` = pause event/history source
- `Schedule_Context` = cached selected MMS schedule facts
- `Parent_Understanding_State` = parent check-in campaign workflow state

## Latest Important Commit

- `120fdb6 Add parent understanding workflow`

This added the first testable parent check-in workflow:

- route: `/admin/workflows/parent-understanding`
- API: `POST /api/admin/parent-understanding`
- client: `components/admin/AdminParentUnderstandingPageClient.js`
- helpers: `lib/admin/parent-understanding.js` and `lib/admin/parent-understanding-helpers.mjs`
- tests: `tests/admin/parent-understanding-helpers.test.mjs`
- managed Sheets tab: `Parent_Understanding_State`

The workflow is intentionally approval/manual-first. It copies WhatsApp follow-up text but does not auto-send messages, edit MMS contact details, notify tutors, or create issues.

Do not create a second source of truth unless the user explicitly agrees.

## What To Avoid Rushing

- Editable lifecycle state machine
- WhatsApp auto-send
- AI/agent actions that affect parent messaging or payments without approval
- Heavy generic workflow engine
- Finance/accounting dashboard beyond lightweight operational value context
- Rewriting V3 loop architecture

## Common Safe Working Pattern

1. Inspect existing helpers/tests before changing behaviour.
2. Keep changes small and aligned with existing patterns.
3. Add/update focused tests for logic changes.
4. Run `npm run test:admin`.
5. Run `npm run build`.
6. If deployed, commit and push to `main`; Railway deploys from GitHub.
7. For meaningful architecture changes, suggest/update a learning log entry.

## Documentation Updates

Use repo docs for implementation detail and active engineering handoff.

Use Obsidian for higher-level operating memory:

- `06 Learning Log/` for meaningful architecture/product changes
- `08 Operations/Active Roadmap.md` for current direction
- `08 Operations/Incident Log.md` for outages/bugs/recovery lessons
- `08 Operations/Decision Log.md` for important choices
- `08 Operations/Glossary.md` for shared terms

Do not update docs for tiny styling-only changes unless they affect a documented workflow or decision.
