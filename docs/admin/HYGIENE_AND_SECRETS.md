# Hygiene And Secrets

Last updated: 2026-06-10

This note tracks trust-floor issues that affect deployment safety, future public writing, and new-agent continuity.

## Home Directory Git Repo

`/Users/finnlemarinel` is currently also a git repository with remote:

`https://github.com/FirstChord/first-chord-dashbord.git`

This is risky because the home directory contains many unrelated personal/work files and nested project folders. A broad `git add`, `commit`, or `push` from `/Users/finnlemarinel` could accidentally stage sensitive or irrelevant files.

Current recommendation:

- keep using `/Users/finnlemarinel/Desktop/FirstChord/music-school-dashboard` as the real repo
- do not commit from `/Users/finnlemarinel`
- remove or disable the home-directory remote only after Finn confirms nothing there needs preserving

Do not alter the home-directory git repo without explicit confirmation.

## Theta Credentials

`lib/config/theta-credentials.js` is generated and currently tracked. It maps MMS IDs to Theta usernames, and the student portal treats username and password as the same value.

Risk level: not banking-level, but still student login credentials in git. This also blocks clean future case-study/productisation work.

Current non-destructive action:

- `.gitignore` now reserves `lib/config/theta-credentials.local.js` for a future untracked/local credential artifact.

Recommended migration before removing tracked credentials:

1. update config generation to write public portal config separately from private Theta credentials
2. load Theta credentials from an untracked file or environment-backed source on the server
3. confirm the student portal still works locally and on Railway
4. rotate Theta credentials if the risk model requires it
5. remove `lib/config/theta-credentials.js` from git tracking with a deliberate commit

Do not simply delete the tracked file without replacing the import path; the generated portal helpers currently import it synchronously.

## Test Students

The overview currently excludes known test students by name so operational counts are not inflated. This protects the overview, but it is fragile because the exclusion is not a universal source-of-truth flag.

Current recommendation:

- do not delete production sheet rows automatically
- replace name-based exclusions with an explicit test/demo flag in the operational source of truth
- make all relevant surfaces use that flag consistently
- then remove hardcoded overview-only filtering

Until that migration exists, removing the overview filter may make headline counts less trustworthy.

## Secret Handling Rules

- `.env*` files are ignored and should stay local/Railway-only.
- Google OAuth/token files in the home directory are not repo artifacts.
- Never paste live tokens, Stripe secrets, OAuth refresh tokens, or private sheet IDs into docs.
- For docs and handovers, describe the variable name and owner, not the value.
