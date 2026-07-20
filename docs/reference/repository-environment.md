---
status: supporting
audience: [human, agent]
last_verified: 2026-07-20
---
# Repository and environment map

This is a lookup sheet for locations, deployed services, and known operators.
It is not an agent entry point or a current-status snapshot. Start with
[AGENTS.md](../../AGENTS.md), [Current status](../CURRENT_STATUS.md), and the
[documentation router](../README.md).

## Locations

| Item | Location |
|---|---|
| Repository | `/Users/finnlemarinel/Desktop/FirstChord/music-school-dashboard` |
| Obsidian vault | `/Users/finnlemarinel/FirstChordOS` |
| Obsidian operating docs | `/Users/finnlemarinel/FirstChordOS/docs/obsidian` |

Do not run repository git commands from `/Users/finnlemarinel`; confirm the
working tree with `git rev-parse --show-toplevel` when location is uncertain.

## Railway services

| Service | Domain | Role |
|---|---|---|
| `pure-spontaneity` / `first-chord-dashbord` | `https://first-chord-dashbord-production.up.railway.app` | Canonical admin/API runtime: `/admin`, authenticated writes, Gmail, Sheets, Stripe, cron, and Practice Chat writeback |
| `efficient-sparkle` | `https://efficient-sparkle-production.up.railway.app` | Public tutor/student dashboard runtime; do not use its incomplete `/admin` environment for admin or Practice Chat writebacks |
| `awake-connection` / `enhanced-music-lesson-notes` | `https://enhanced-music-lesson-notes-production.up.railway.app` | Practice Chat speech/Whisper relay |

Railway services do not share environment variables. Use the
[operations runbook](../operations/runbook.md) for credential inventory,
deployment, health checks, and recovery.

## Known operators

This is operational context, not an access-control model. Confirm role changes
with Finn rather than encoding them as permissions.

| Person | Known work |
|---|---|
| Finn | Owner/admin; onboarding, registry, deployment, most issue and student work |
| Tom | Co-leadership; payroll and shared planning work |
| Fenella | Parent-understanding check-ins |
| Finn and Tom | Friday reflection and operating/planning rhythm |

## Working rules

- Source ownership and state lanes: [ownership](../architecture/data/ownership.md)
  and [state tabs](../architecture/data/state-tabs.md).
- Current direction and deliberately parked work: [Current status](../CURRENT_STATUS.md).
- Deployment and integration recovery: [operations](../operations/README.md).
- School and system rules: [policies](../policies/README.md).
- Recurring human processes: [workflows](../workflows/README.md).
- Do not duplicate recent-work lists here; use Git history and Current status.
- Do not put credentials, live record dumps, or local backup contents in docs.
