# Admin Docs Index

## Start Here

- [ADMIN_BRIEF.md](./ADMIN_BRIEF.md)
  Current architecture, boundaries, and implementation guidance for the admin dashboard.
- [ADMIN_IMPLEMENTATION_LOG.md](./ADMIN_IMPLEMENTATION_LOG.md)
  Chronological record of what has actually been built.
- [V2_SPEC_DRAFT.md](./V2_SPEC_DRAFT.md)
  Current V2 plan and sequencing.
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

- [RAILWAY_ADMIN_LAUNCH_CHECKLIST.md](./RAILWAY_ADMIN_LAUNCH_CHECKLIST.md)
  Railway deployment and environment setup checklist.

## Current Workflow Layer

- `/admin/flags` is now the first surface moving from detected issues to managed workflow.
- `Issue_Queue` in Google Sheets stores persistent issue state.
- `Event_Log` in Google Sheets stores append-only issue actions and reappearance events.
- PR1 scope is intentionally narrow: stable IDs, acknowledge/ignore/resolve, source presence, and audit logging.
- `/admin/showcase` is now a second workflow surface for recurring student-show operations.
- `Showcase_Task_State` in Google Sheets stores persistent checklist state per showcase instance.
- Showcase reference content is intentionally split from the checklist:
  - `Linked Assets`
  - `Key Timings`
  - `Core Messages`
- Checklist items should remain true done/not-done actions; softer planning points should stay as guidance.
- `/admin/holidays` is now another recurring workflow surface for Christmas, Easter, and summer operations.
- `Holiday_Workflow_State` in Google Sheets stores persistent checklist state per holiday workflow instance.
- Holiday workflow cards combine:
  - key timings
  - policy reminders
  - copy-ready messages
  - persistent action checklists

## Suggested Handoff Order

1. Read [ADMIN_BRIEF.md](./ADMIN_BRIEF.md)
2. Skim [ADMIN_IMPLEMENTATION_LOG.md](./ADMIN_IMPLEMENTATION_LOG.md)
3. Check [OWNERSHIP_MATRIX.md](./OWNERSHIP_MATRIX.md)
4. Read [SCHOOL_POLICY.md](./SCHOOL_POLICY.md)
5. Review [PAYMENTS_RULES.md](./PAYMENTS_RULES.md) if working on Stripe or pauses
6. Use [V2_SPEC_DRAFT.md](./V2_SPEC_DRAFT.md) for V2 roadmap context
7. Read [V3_ARCHITECTURE.md](./V3_ARCHITECTURE.md) for next-phase system direction
8. Read [BRAIN_CAPABILITY_ROADMAP.md](./BRAIN_CAPABILITY_ROADMAP.md) for longer-term assistant design
