---
status: canonical
audience: [human, agent]
last_verified: 2026-07-20
---

# First Chord documentation

This is the single documentation router for the repository. It points to the
current authority for each kind of question; it is not a second current-status
or architecture document.

Coding agents start with [AGENTS.md](../AGENTS.md), then read
[CURRENT_STATUS.md](./CURRENT_STATUS.md). Humans can start from the task they
are trying to complete below.

## What are you trying to do?

| Need | Start here |
|---|---|
| See what is live, recent, next, or deliberately parked | [Current status](./CURRENT_STATUS.md) |
| Understand the system, its data, AI, or security boundaries | [Architecture](./architecture/README.md) |
| Check a school, payment, privacy, UX, or workflow rule | [Policies](./policies/README.md) |
| Deploy, diagnose, recover, or operate an integration | [Operations](./operations/README.md) |
| Carry out a recurring school process | [Workflows](./workflows/README.md) |
| Review work that is proposed, active, or parked | [Plans](./plans/README.md) |
| Look up a term, registry rule, catalogue fact, or environment detail | [Reference](./reference/README.md) |
| Understand an old decision, audit, spec, or portal-era process | [History](./history/README.md) |

## Authority order

When documents disagree, use this order:

1. Current code and focused tests.
2. [AGENTS.md](../AGENTS.md) for repository-wide safety and validation routing.
3. [CURRENT_STATUS.md](./CURRENT_STATUS.md) for active direction.
4. The focused architecture, policy, operations, or workflow document.
5. Plans and reference material.
6. Historical documents only as background.

Do not silently ignore a conflict between code and a canonical document. Fix
the document, fix the implementation, or call out the unresolved difference.

## Documentation lifecycle

Active documents use one of these statuses:

- `canonical` — the authority for a named contract or operating rule.
- `supporting` — useful current explanation, but not the sole authority.
- `active-plan` — approved direction with remaining work.
- `parked` — deliberately not current work; a new decision is required to resume.
- `historical` — retained for context and never current instruction.

The folder communicates the document's primary purpose; its status communicates
its lifecycle. Plans do not become truth because they are detailed, and history
does not override current code because it once described production.

## Repository docs versus Obsidian

Repository documentation owns implementation handoff, source-of-truth rules,
schemas, safety boundaries, workflows, integration operation, and recovery.
The Obsidian vault owns higher-level operating memory, decision history, product
lessons, and material written for Finn, Tom, or Fenella. Safety-critical rules
must remain usable from this repository alone.

## Maintenance rules

- Keep only this file as the broad documentation index.
- Update the focused canonical document when a change affects architecture,
  ownership, policy, security, workflow state, deployment, or recovery.
- Update [the state-tab contract](./architecture/data/state-tabs.md) whenever a
  dashboard-owned Sheet tab, header, key, writer, retention rule, or backup
  disposition changes.
- Use Git history and the Obsidian Learning Log for chronology; do not restart a
  repository changelog.
- Run `npm run docs:check` after moving or linking documentation.
