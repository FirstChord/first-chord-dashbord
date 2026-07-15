# Documentation Map

Last updated: 2026-07-14

The docs are useful, but there are many entry points. This map defines the canonical ones so future agents do not treat old drafts as current authority.

## Canonical Repo Entry Points

Read in this order:

1. `AGENTS.md`
2. `docs/admin/CURRENT_STATUS.md`
3. `docs/admin/NEW_AGENT_START_HERE.md` for the fuller operating handoff
4. `docs/admin/V3_LOOP_ARCHITECTURE.md`
5. `docs/admin/STATE_TABS_SCHEMA.md` — canonical dashboard state lane map
6. `docs/admin/HYGIENE_AND_SECRETS.md`
7. `docs/admin/OPERATIONS_RUNBOOK.md` when touching deployment, auth, env vars, recovery, backups, or integration health
8. `docs/admin/OWNERSHIP_MATRIX.md`
9. `docs/admin/SCHOOL_POLICY.md`
10. `docs/admin/PAYMENTS_RULES.md` when touching payments, pauses, Stripe, or setup-pending logic
11. `docs/admin/TUTOR_ABSENCE_PAUSE_BRIDGE.md` when touching tutor absence, pause planning, or finance pause forecasts
12. `docs/admin/WHATSAPP_INCOMING_BRIDGE.md` when touching incoming WhatsApp capture, group maps, or message classification
13. `docs/workflows/06-paying-tutors.md` for the live human payroll run; pair it with `docs/admin/STATE_TABS_SCHEMA.md` + the `CURRENT_STATUS.md` finance section when changing `/admin/finance`, payroll, `Tutor_Pay`, `Tutor_Wise`, statements or `Payroll_Runs`
14. `docs/admin/PRACTICE_CHAT_DELIVERY_AUDIT.md` when touching Practice Chat Level 2 delivery or rollout
15. `docs/admin/AGENT_READINESS_AUDIT_OUTCOMES.md` for the July 2026 audit implementation register, verification, privacy note, and remaining risks

`docs/admin/AUDIT_2026-06-10.md` is critique input, not a live plan. Use judgement before implementing its recommendations.

## Repo Docs Vs Obsidian Vault

Use repo docs for:

- implementation handoff
- routes, files, functions, and tests
- source-of-truth rules
- state tab schemas
- known incidents and bug fixes
- deployment and local command notes

Use the Obsidian vault for:

- higher-level operating memory
- product/architecture lessons
- decision history
- blog/case-study seeds
- language that helps Finn/Tom/Fenella understand the system

The repository must still contain every safety-critical code, validation,
ownership, security, and recovery rule. Obsidian and workspace handovers are
optional context, not prerequisites for changing this repository safely.

## Learning Log Split

Repo `docs/LEARNING_LOG.md` should capture engineering decisions that future agents need for code safety.

Obsidian `06 Learning Log/` should capture operating/product lessons that might be useful for delegation, blog posts, or future generalisation.

Do not duplicate every small change in both places. For a meaningful architectural change, add the repo note if it affects implementation, and the Obsidian note if it changes the operating model.

## Documentation Maintenance Rule

Every meaningful change affecting architecture, integrations, source-of-truth lanes, workflow state, security, deployment, financial logic, communication, or recovery should either update the relevant doc or explicitly state why no documentation change is required. Minor styling, copy polish, and local UI layout tweaks should not create documentation churn.

If a change adds a new dashboard-owned Sheets tab, also update:

- `docs/admin/STATE_TABS_SCHEMA.md`
- `scripts/backup-sheets-tabs.mjs`, unless there is a clear reason not to back it up
- `docs/admin/OPERATIONS_RUNBOOK.md` if recovery or sensitive-data handling changes

## Historical Docs

Older V1/V2 docs remain useful for background. They should not override:

- `CURRENT_STATUS.md`
- `NEW_AGENT_START_HERE.md`
- `V3_LOOP_ARCHITECTURE.md`
- `STATE_TABS_SCHEMA.md`
- current code/tests
