# Hygiene And Secrets

Last updated: 2026-06-11

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

`lib/config/theta-credentials.js` is generated and no longer tracked. It maps MMS IDs to Theta usernames, and the student portal treats username and password as the same value.

Risk level: not banking-level, but still student login credentials in git. This also blocks clean future case-study/productisation work.

Current state:

- `npm run generate-configs` writes `lib/config/theta-credentials.js` locally.
- `predev`, `prebuild`, and `prevalidate` regenerate config from `lib/config/students-registry.js`.
- `lib/config/theta-credentials.js` and `lib/config/theta-credentials.local.js` are ignored.
- Git history still contains the old generated file; history was not rewritten.

Remaining decision:

- Decide whether Theta credential rotation or a student portal password-policy change is needed because old values remain in git history.

Do not manually edit `lib/config/theta-credentials.js`; regenerate it from the registry.

## MMS API Token Exposure

`lib/mms-client.js` previously contained a hardcoded MMS bearer token/API-key JWT. That token is more sensitive than the Theta username file because it can grant API access to the MMS account.

Current state:

- the hardcoded token has been removed from code
- MMS code now reads from `MMS_BEARER_TOKEN` / legacy `MMS_DEFAULT_TOKEN`
- the old token remains in git history

Pre-push/deploy blocker:

1. Add `MMS_BEARER_TOKEN` to Railway before pushing. This may be the existing token if Finn has deliberately deferred rotation.
2. Confirm local `.env.local` also has `MMS_BEARER_TOKEN`.
3. Strongly recommended when operationally safe: rotate the exposed MMS API key/token in MMS, then update Railway/local env.
4. After deploy, smoke-check `/admin/waiting`, `/admin/capacity`, schedule refresh, onboarding MMS actions, and one student portal page.

## Test Students

Operational surfaces now use an explicit test-student flag instead of name-based exclusions.

Current state:

- supported flags include `is_test_student` on the `Students` sheet and `isTestStudent` in the registry
- `Test Studenty` is flagged in both the registry and the `Students` sheet
- `Finn Le Marinel` is flagged in the `Students` sheet
- overview, students list, issues, capacity cache health, planning student options, parent understanding, tutor absence, and the admin students API use the shared helper

Do not delete external test rows automatically. Keep them explicitly flagged unless Finn decides to remove them from MMS/Sheets.

## Secret Handling Rules

- `.env*` files are ignored and should stay local/Railway-only.
- Google OAuth/token files in the home directory are not repo artifacts.
- Never paste live tokens, Stripe secrets, OAuth refresh tokens, or private sheet IDs into docs.
- For docs and handovers, describe the variable name and owner, not the value.
- The admin AI pilot uses `ADMIN_AI_OPENAI_API_KEY` only on the canonical admin
  Railway service. Do not reuse the Practice Chat relay's `OPENAI_API_KEY`: that
  relay key has a documented browser-exposure history and separate rotation
  plan. Never prefix the admin key with `NEXT_PUBLIC_` or return it from a route.

## Local Sheets Backups

Operational Sheets backups now run through:

```bash
npm run backup:sheets
```

The backup writes ignored local CSV/JSON files under `backups/sheets/` and updates a dated Planning reminder for the next backup 14 days later.

The local macOS schedule is installed with:

```bash
npm run install:backup-schedule
```

It creates:

```text
~/Library/LaunchAgents/com.firstchord.sheets-backup.plist
```

This keeps backup data local/private while still surfacing the next backup through the dashboard's Planning layer.
