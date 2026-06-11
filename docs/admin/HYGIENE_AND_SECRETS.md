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

1. Rotate the exposed MMS API key/token in MMS.
2. Add the rotated value to Railway as `MMS_BEARER_TOKEN`.
3. Update local `.env.local` with the same current value.
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
