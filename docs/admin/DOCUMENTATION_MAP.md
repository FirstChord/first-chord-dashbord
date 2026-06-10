# Documentation Map

Last updated: 2026-06-10

The docs are useful, but there are many entry points. This map defines the canonical ones so future agents do not treat old drafts as current authority.

## Canonical Repo Entry Points

Read in this order:

1. `docs/admin/NEW_AGENT_START_HERE.md`
2. `docs/admin/CURRENT_STATUS.md`
3. `docs/admin/V3_LOOP_ARCHITECTURE.md`
4. `docs/admin/STATE_TABS_SCHEMA.md`
5. `docs/admin/HYGIENE_AND_SECRETS.md`
6. `docs/admin/OWNERSHIP_MATRIX.md`
7. `docs/admin/SCHOOL_POLICY.md`
8. `docs/admin/PAYMENTS_RULES.md` when touching payments, pauses, Stripe, or setup-pending logic

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

## Learning Log Split

Repo `docs/LEARNING_LOG.md` should capture engineering decisions that future agents need for code safety.

Obsidian `06 Learning Log/` should capture operating/product lessons that might be useful for delegation, blog posts, or future generalisation.

Do not duplicate every small change in both places. For a meaningful architectural change, add the repo note if it affects implementation, and the Obsidian note if it changes the operating model.

## Historical Docs

Older V1/V2 docs remain useful for background. They should not override:

- `CURRENT_STATUS.md`
- `NEW_AGENT_START_HERE.md`
- `V3_LOOP_ARCHITECTURE.md`
- current code/tests
