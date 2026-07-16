# Admin Docs Index

For current active work and recommended next slices, start with:

- [../../AGENTS.md](../../AGENTS.md) for the repository-wide coding-agent guide
- [CURRENT_STATUS.md](./CURRENT_STATUS.md)

This admin index is the map of durable admin documentation. Older V1/V2 drafts are retained for history and should not override `CURRENT_STATUS.md` or `V3_LOOP_ARCHITECTURE.md`.

## Start Here

- [../../AGENTS.md](../../AGENTS.md)
  Short repository-wide dispatcher for code location, truth boundaries, focused
  tests, high-risk invariants, validation, and recovery.
- [NEW_AGENT_START_HERE.md](./NEW_AGENT_START_HERE.md)
  Practical handoff note for a new Codex/AI agent: paths, commands, current direction, source-of-truth rules, and documentation update rules.
- [CURRENT_STATUS.md](./CURRENT_STATUS.md)
  Current admin direction, recent work, and next recommended slices.
- [AGENT_READINESS_AUDIT_OUTCOMES.md](./AGENT_READINESS_AUDIT_OUTCOMES.md)
  Completion register for the 12 agent-readiness/thin-AI improvements, Practice
  Chat claim hardening, verification, privacy, and remaining risks.
- [AI_RUNTIME_INTEGRATION.md](./AI_RUNTIME_INTEGRATION.md)
  Exact live model request flow, security boundary, provider configuration,
  validation, privacy, operations, tests and future-integration checklist.
- [DOCUMENTATION_MAP.md](./DOCUMENTATION_MAP.md)
  Canonical documentation entry points, repo-vs-Obsidian split, and historical-doc rules.
- [V3_LOOP_ARCHITECTURE.md](./V3_LOOP_ARCHITECTURE.md)
  Current V3 loop pattern for issues, payments, pauses, waiting list, recurring workflows, and audit logging.
- [STATE_TABS_SCHEMA.md](./STATE_TABS_SCHEMA.md)
  Dashboard-owned Sheets state tabs, keys, write patterns, concurrency notes, and limits.
- [WORKFLOW_DESIGN_PRINCIPLES.md](./WORKFLOW_DESIGN_PRINCIPLES.md)
  Shared workflow design rulebook: reduce admin cognitive load, keep source-of-truth boundaries clear, and make risky actions explicit and logged.
- [TUTOR_ABSENCE_PAUSE_BRIDGE.md](./TUTOR_ABSENCE_PAUSE_BRIDGE.md)
  Focused map of the tutor absence -> cancellation -> structured pause planning bridge, including grouping, superseding, parked cards, and finance behaviour.
- [WHATSAPP_INCOMING_BRIDGE.md](./WHATSAPP_INCOMING_BRIDGE.md)
  Safe intake contract for automatic capture from confirmed lesson groups, with
  starred/manual fallback; classification is reviewable and consequential
  actions remain human-approved.
- [COPY_AND_TONE.md](./COPY_AND_TONE.md)
  Lightweight voice guide for calm, human, action-led dashboard copy.
- [UI_CONVENTIONS.md](./UI_CONVENTIONS.md)
  Lightweight UI/action conventions for async buttons, status feedback, destructive actions, and avoiding full-page reloads.
- [HYGIENE_AND_SECRETS.md](./HYGIENE_AND_SECRETS.md)
  Trust-floor notes for the home-directory git repo, Theta credentials, test students, and secret handling.
- [OPERATING_DASHBOARD_BUILD_BLUEPRINT.md](./OPERATING_DASHBOARD_BUILD_BLUEPRINT.md)
  Reusable playbook for building a similar internal operating dashboard, including loop design, state/audit patterns, navigation, caching, and automation guardrails.
- [ADMIN_BRIEF.md](./ADMIN_BRIEF.md)
  Historical V1 brief with current-state addenda. Useful for background, but not the current planning authority.
- [ADMIN_IMPLEMENTATION_LOG.md](./ADMIN_IMPLEMENTATION_LOG.md)
  Chronological record of what has actually been built.
- [AUDIT_2026-06-10.md](./AUDIT_2026-06-10.md)
  Independent audit: strengths, risks, documentation gaps, agent readiness, productisation assessment, and recommended next slices. Critique input, not active direction.
- [V2_SPEC_DRAFT.md](./V2_SPEC_DRAFT.md)
  Historical V2 plan and sequencing.
- [V3_ARCHITECTURE.md](./V3_ARCHITECTURE.md)
  Target direction for persistent issue state, communication workflows, planning support, and Brain’s bounded role.

## Ownership And Rules

- [OWNERSHIP_MATRIX.md](./OWNERSHIP_MATRIX.md)
  Current source-of-truth and action-ownership model.
- [SCHOOL_POLICY.md](./SCHOOL_POLICY.md)
  Current operating policy for onboarding, payments, pauses, tutor assignment, and automation guardrails.
- [PAYMENTS_RULES.md](./PAYMENTS_RULES.md)
  Payment-mode, payment-expectation, and Stripe issue rules.
- [BRAIN_CAPABILITY_ROADMAP.md](./BRAIN_CAPABILITY_ROADMAP.md)
  Forward-looking roadmap for Brain as an admin assistant and thought partner.
- [AI_TOOL_CONTRACTS.md](./AI_TOOL_CONTRACTS.md)
  Governance allowlist for narrow AI reads/proposals, privacy, evaluation, and
  prohibited integration access. The issue briefing is the only live runtime.

## Operations

- [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md)
  Practical recovery and credential runbook for MMS, Google Sheets, Railway, admin auth, deploys, rollbacks, Sheets backups, and component-level diagnostic boundaries.
- [RAILWAY_ADMIN_LAUNCH_CHECKLIST.md](./RAILWAY_ADMIN_LAUNCH_CHECKLIST.md)
  Historical V1 Railway launch checklist; use the operations runbook for current deployment.
- [TUTOR_ABSENCE_SAFETY_AND_UX.md](./TUTOR_ABSENCE_SAFETY_AND_UX.md)
  Tutor absence timing, fail-loud exception handling, reconciliation boundary, and safe UI contract.
- [BUG_FIXES.md](./BUG_FIXES.md)
  Short production bug-fix and recovery notes, including Railway 502 recovery.

## Current Workflow Layer

- Workflow pages should reduce cognitive load, not just add more state. See [WORKFLOW_DESIGN_PRINCIPLES.md](./WORKFLOW_DESIGN_PRINCIPLES.md).
- Admin top navigation is intentionally short and action-led:
  - `/admin` = Overview
  - `/admin/flags` = Issues
  - `/admin/workflows` = Tutors, Waiting List, Showcase, Holidays, Parent Understanding, Tutor Absence, Message Inbox, Payroll, and Finance
  - `/admin/planning` = due work, meeting review, school notes, ideas, initiatives, and linked actions
- Student records are important context, but they are reached through header search, issue links, workflow links, or `/admin/students`; they are not a primary top-nav mode.
- `/admin/flags` moves detected issues into managed workflow. Its explicit
  `Sync pause expectations` action previews, confirms, re-evaluates, and logs any
  high-confidence Students-sheet changes; loading the page never performs them.
- `Issue_Queue` in Google Sheets stores persistent issue state.
- `Event_Log` in Google Sheets stores append-only issue actions and reappearance events.
- `/admin/waiting` is the waiting-list placement/contact decision surface:
  - MMS waiting students
  - parent/contact details
  - parsed MMS sign-up context and full note detail
  - waiting state and notes
  - possible capacity matches from MMS `Free` slots filtered by tutor instrument coverage
- `/admin/onboard` is the execution form once a waiting-list student is ready to create across Sheets, registry, MMS, and portal setup.
- `/admin/capacity` reads MMS calendar category `Free`, shows weekly tutor capacity, and keeps schedule-cache health visible.
- `/admin/showcase` is a recurring student-show workflow surface.
- `Showcase_Task_State` in Google Sheets stores persistent checklist state per showcase instance.
- Showcase reference content is intentionally split from the checklist:
  - `Linked Assets`
  - `Key Timings`
  - `Core Messages`
- Checklist items should remain true done/not-done actions; softer planning points should stay as guidance.
- `/admin/holidays` is another recurring workflow surface for Christmas, Easter, and summer operations.
- `Holiday_Workflow_State` in Google Sheets stores persistent checklist state per holiday workflow instance.
- Holiday workflow cards combine:
  - key timings
  - policy reminders
  - copy-ready messages
  - persistent action checklists
- `/admin/workflows/parent-understanding` is a parent check-in campaign workflow for Fenella.
- `Parent_Understanding_State` in Google Sheets stores one workflow-state row per student/parent record.
- Parent understanding is intentionally manual and approval-first:
  - it can copy WhatsApp follow-up templates
  - it can record understanding gaps, risk signals, next actions, summaries, and follow-up state
  - it does not auto-send WhatsApp messages
  - it does not edit MMS contact details
  - it does not automatically notify tutors
- Consequential parent-understanding saves append to `Event_Log` when a record is completed, marked needs-follow-up, or escalated.
- Tutor absence cancellation can auto-create structured pause planning. Read [TUTOR_ABSENCE_PAUSE_BRIDGE.md](./TUTOR_ABSENCE_PAUSE_BRIDGE.md) before changing tutor-absence, pause-planning, or finance-forecast logic.
- `/admin/incoming-messages` is the inbound review inbox for automatic capture
  from dashboard-confirmed WhatsApp lesson groups, with starred/manual fallback.
  It writes `Incoming_Message_Inbox`; classification, student matching, and date
  extraction are review hints. A human may explicitly convert a reviewed item to
  Planning, but capture itself never pauses payments, sends a reply, or changes
  attendance/workflow state.
- `/admin/finance/payroll` is the first payroll review surface. It reads MMS attendance and `Tutor_Pay`, then writes reviewed/paid state to `Payroll_Runs`; it does not execute payments.

## Suggested Handoff Order

1. Read [../../AGENTS.md](../../AGENTS.md)
2. Read [CURRENT_STATUS.md](./CURRENT_STATUS.md)
3. Read [V3_LOOP_ARCHITECTURE.md](./V3_LOOP_ARCHITECTURE.md)
4. Read [STATE_TABS_SCHEMA.md](./STATE_TABS_SCHEMA.md)
5. Read [HYGIENE_AND_SECRETS.md](./HYGIENE_AND_SECRETS.md)
6. Skim [ADMIN_IMPLEMENTATION_LOG.md](./ADMIN_IMPLEMENTATION_LOG.md)
7. Check [OWNERSHIP_MATRIX.md](./OWNERSHIP_MATRIX.md)
8. Read [SCHOOL_POLICY.md](./SCHOOL_POLICY.md)
9. Review [PAYMENTS_RULES.md](./PAYMENTS_RULES.md) if working on Stripe or pauses
10. Read [V3_ARCHITECTURE.md](./V3_ARCHITECTURE.md) for broader system direction
11. Use [ADMIN_BRIEF.md](./ADMIN_BRIEF.md) and [V2_SPEC_DRAFT.md](./V2_SPEC_DRAFT.md) only as historical background
12. Read [BRAIN_CAPABILITY_ROADMAP.md](./BRAIN_CAPABILITY_ROADMAP.md) only for historical capability framing
