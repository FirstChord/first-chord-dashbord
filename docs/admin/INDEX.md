# Admin Docs Index

For current active work and recommended next slices, start with:

- [CURRENT_STATUS.md](./CURRENT_STATUS.md)

This admin index is the map of durable admin documentation. Older V1/V2 drafts are retained for history and should not override `CURRENT_STATUS.md` or `V3_LOOP_ARCHITECTURE.md`.

## Start Here

- [NEW_AGENT_START_HERE.md](./NEW_AGENT_START_HERE.md)
  Practical handoff note for a new Codex/AI agent: paths, commands, current direction, source-of-truth rules, and documentation update rules.
- [CURRENT_STATUS.md](./CURRENT_STATUS.md)
  Current admin direction, recent work, and next recommended slices.
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
- [COPY_AND_TONE.md](./COPY_AND_TONE.md)
  Lightweight voice guide for calm, human, action-led dashboard copy.
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

## Operations

- [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md)
  Practical recovery and credential runbook for MMS, Google Sheets, Railway, admin auth, deploys, rollbacks, and Sheets backups.
- [RAILWAY_ADMIN_LAUNCH_CHECKLIST.md](./RAILWAY_ADMIN_LAUNCH_CHECKLIST.md)
  Railway deployment and environment setup checklist.
- [BUG_FIXES.md](./BUG_FIXES.md)
  Short production bug-fix and recovery notes, including Railway 502 recovery.

## Current Workflow Layer

- Workflow pages should reduce cognitive load, not just add more state. See [WORKFLOW_DESIGN_PRINCIPLES.md](./WORKFLOW_DESIGN_PRINCIPLES.md).
- Admin top navigation is intentionally short and action-led:
  - `/admin` = Overview
  - `/admin/flags` = Issues
  - `/admin/workflows` = Waiting List, Onboarding, Showcase, Holidays
  - `/admin/planning` = Capacity, schedule health, seasonal planning, and future planning layers
- Student records are important context, but they are reached through header search, issue links, workflow links, or `/admin/students`; they are not a primary top-nav mode.
- `/admin/flags` moves detected issues into managed workflow.
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
- `/admin/finance/payroll` is the first payroll review surface. It reads MMS attendance and `Tutor_Pay`, then writes reviewed/paid state to `Payroll_Runs`; it does not execute payments.

## Suggested Handoff Order

1. Read [CURRENT_STATUS.md](./CURRENT_STATUS.md)
2. Read [V3_LOOP_ARCHITECTURE.md](./V3_LOOP_ARCHITECTURE.md)
3. Read [STATE_TABS_SCHEMA.md](./STATE_TABS_SCHEMA.md)
4. Read [HYGIENE_AND_SECRETS.md](./HYGIENE_AND_SECRETS.md)
5. Skim [ADMIN_IMPLEMENTATION_LOG.md](./ADMIN_IMPLEMENTATION_LOG.md)
6. Check [OWNERSHIP_MATRIX.md](./OWNERSHIP_MATRIX.md)
7. Read [SCHOOL_POLICY.md](./SCHOOL_POLICY.md)
8. Review [PAYMENTS_RULES.md](./PAYMENTS_RULES.md) if working on Stripe or pauses
9. Read [V3_ARCHITECTURE.md](./V3_ARCHITECTURE.md) for broader system direction
10. Use [ADMIN_BRIEF.md](./ADMIN_BRIEF.md) and [V2_SPEC_DRAFT.md](./V2_SPEC_DRAFT.md) only as historical background
11. Read [BRAIN_CAPABILITY_ROADMAP.md](./BRAIN_CAPABILITY_ROADMAP.md) only for longer-term assistant design
