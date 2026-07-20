---
status: canonical
audience: [human, agent]
last_verified: null
---
# Operations Runbook

Audience: Tom or another semi-technical operator when Finn is unavailable.

This runbook covers operational recovery for the First Chord dashboard. It is intentionally practical: what the system needs, what breaks when something expires, and the safest recovery route.

## Golden Rules

- Do not edit generated files by hand. Edit source files such as `lib/config/students-registry.js`, then run `npm run generate-configs`.
- Do not commit backups, `.env` files, local token files, or generated secret artifacts.
- Do not deploy the MMS-token migration unless Railway has `MMS_BEARER_TOKEN` set. Rotating the MMS API key is strongly recommended because the old token remains in git history; Finn may defer rotation temporarily if coordinating dependent tools is higher risk.
- Before any deploy, run:

```bash
npm run hygiene:check
npm run test:admin
npm run lint
npm run build
```

- Pull requests and pushes to `main` repeat clean install, tests, application
  lint, and production build in `.github/workflows/ci.yml`. A green local run is
  not a substitute for investigating a failed GitHub check.
- Pushing `main` deploys through Railway. Confirm before pushing.
- Parent-facing, payment-affecting, and deletion/archive actions should stay human-approved.

## Main Systems

| System | What it owns | Dashboard dependency |
| --- | --- | --- |
| Google Sheets | Operational school truth and dashboard workflow state | Most admin pages, issues, planning, parent understanding, tutor absence, backups |
| Registry | Portal/dashboard config truth | Student portal routes, registry-vs-Sheets issue checks |
| MMS | Lesson/scheduling/contact truth | Waiting list, schedule context, onboarding, capacity, tutor absences |
| Stripe | Payment provider truth | Payment issue checks and student Stripe refreshes |
| Railway | Hosted app runtime | Live dashboard and portal |
| GitHub | Repo, generated-config action, registry write path in production | Deploy source, workflow status, production registry writes |

## Credential And Env Inventory

These names come from real code reads of `process.env` and local token paths.

### Railway / Production Env

| Name | Used by | What breaks if missing/expired | Refresh / recovery |
| --- | --- | --- | --- |
| `NEXTAUTH_SECRET` | NextAuth admin login | Admin sessions/login fail or become invalid | Set a strong secret in Railway. FINN TO FILL IN rotation source. |
| `NEXTAUTH_URL` | NextAuth and generated dashboard links | Auth callback/link generation can point at wrong host | Set to the live Railway URL. Local default is `http://localhost:3000`. |
| `GOOGLE_CLIENT_ID` | Admin Google OAuth | Admin login unavailable | Refresh in Google Cloud OAuth app, then update Railway. FINN TO FILL IN console location. |
| `GOOGLE_CLIENT_SECRET` | Admin Google OAuth | Admin login unavailable | Refresh in Google Cloud OAuth app, then update Railway. FINN TO FILL IN console location. |
| `ADMIN_ALLOWED_EMAILS` | Admin auth allow-list | Correct users may be blocked, or wrong users may be allowed if misconfigured | Comma-separated allowed admin emails in Railway. |
| `ADMIN_AI_ISSUE_BRIEFING_ENABLED` | Optional admin Issues AI pilot | `false`/missing keeps the deterministic explanation working and the AI call unavailable | Set to `true` only after the dedicated key, privacy boundary and smoke check are ready. Set back to `false` for immediate rollback. |
| `ADMIN_AI_REPLY_DRAFT_ENABLED` | Optional incoming-message reply proposal pilot | `false`/missing hides new-draft controls; stored proposals remain reviewable so decisions are not stranded | Leave unset until Finn accepts the privacy and policy terms in `docs/architecture/ai/tool-contracts.md`. Set to `true` only on the canonical admin Railway service; set back to `false` for immediate rollback. |
| `ADMIN_AI_OPENAI_API_KEY` | Server-side OpenAI Responses API call for issue briefing | AI pilot returns unavailable; deterministic Issues workflow is unaffected | Use a separate restricted/budget-capped project key on the canonical admin Railway service only. Do not reuse the historically exposed Practice Chat relay key. Never expose as `NEXT_PUBLIC_*`. |
| `ADMIN_AI_OPENAI_MODEL` | Optional model override for the issue pilot | Defaults to `gpt-5.6-luna` | Change only with representative contract/evaluation checks; record the model used in pilot results. |
| `GOOGLE_SPREADSHEET_ID` | Admin Sheets integration | Admin data reads/writes fail | Set to the main First Chord operational Sheet ID. FINN TO FILL IN exact Sheet link. |
| `SHEETS_REFRESH_TOKEN` | Google Sheets OAuth | Sheets reads/writes fail once token is invalid | Generate a new OAuth refresh token with Sheets scope, then update Railway. FINN TO FILL IN exact refresh procedure. |
| `SHEETS_CLIENT_ID` | Google Sheets OAuth | Sheets reads/writes fail | Update from Google Cloud OAuth credentials. |
| `SHEETS_CLIENT_SECRET` | Google Sheets OAuth | Sheets reads/writes fail | Update from Google Cloud OAuth credentials. |
| `MMS_BEARER_TOKEN` | Admin MMS integration | Waiting list, schedule refresh, capacity, onboarding MMS actions, tutor absence lesson discovery, and some portal/MMS routes fail | CRITICAL: this used to be hardcoded in `lib/mms-client.js` and is now removed from code. Before pushing/deploying, Railway must have this value. Rotation is strongly recommended because the old token remains in git history, but Finn may defer rotation temporarily and reuse the current token. FINN TO FILL IN exact token source. |
| `MMS_BASE_URL` | Admin MMS integration | MMS calls hit wrong host if changed | Usually `https://api.mymusicstaff.com/v1`. |
| `MMS_DEFAULT_BILLING_RATE` | MMS onboarding billing profile default | New MMS billing profile may use wrong fallback rate | Keep aligned with current lesson pricing policy. |
| `MMS_BILLING_EVENT_CATEGORY_ID` | MMS onboarding billing profile | Billing profile creation may use wrong/default category | Confirm from MMS billing event category. FINN TO FILL IN source. |
| `MMS_FIRST_LESSON_EVENT_CATEGORY_ID` | MMS first-lesson/event creation | First lesson event category may be missing or wrong | Confirm from MMS event categories. FINN TO FILL IN source. |
| `MMS_DEFAULT_TOKEN` | Older MMS proxy/tutor dashboard compatibility routes | Older dashboard/proxy routes may fail | Prefer `MMS_BEARER_TOKEN` for admin; keep this only while legacy routes need it. FINN TO FILL IN whether it can be retired. |
| `MMS_API_URL` | Older MMS proxy routes and placeholder service config | Older proxy routes may hit wrong host | Usually `https://api.mymusicstaff.com`. |
| `GITHUB_TOKEN` | Production registry writes and workflow health cards | Registry edits from admin fail in production; GitHub workflow health shows unknown | Use a token with repo/workflow access. FINN TO FILL IN token owner and renewal. |
| `STRIPE_API_KEY` | Stripe/payment scans | Payment issue refreshes and student Stripe checks fail | Use a restricted live key with Read access for Customers, Subscriptions, Invoices, Prices, and Payment Intents. Payment Intents Read is required by the live issue scan's `latest_invoice.payment_intent` expansion. Edit permissions in Stripe; update Railway/local `.env.local` only when the key value itself is rotated. |
| `STRIPE_PAYMENT_LINK` or `PAYMENT_LINK` | Onboarding message templates | Payment link copy falls back to placeholder | Set to current one-to-one payment link. |
| `GROUP_LESSON_PAYMENT_LINK` | Group onboarding copy | Group payment link may be wrong or use fallback | Set to current group lesson payment link. |
| `HANDBOOK_URL` | Onboarding and parent messaging copy | Handbook link may be wrong or use default | Usually `https://firstchord.co.uk/handbook`. |
| `GMAIL_CLIENT_ID` | Practice note email sending | Practice Chat Level 2 falls back to `GOOGLE_CLIENT_ID`; if neither is present, email sending fails | Optional when the Gmail refresh token was generated with the existing dashboard Google OAuth client. |
| `GMAIL_OAUTH_CLIENT_ID` | Legacy/alternate Gmail token scripts | Token minting scripts may not find the client ID if they do not fall back | Prefer `GMAIL_CLIENT_ID`; keep aliases only if a local script still reads them. |
| `GMAIL_CLIENT_SECRET` | Practice note email sending | Practice Chat Level 2 falls back to `GOOGLE_CLIENT_SECRET`; if neither is present, email sending fails | Optional when the Gmail refresh token was generated with the existing dashboard Google OAuth client. |
| `GMAIL_OAUTH_CLIENT_SECRET` | Legacy/alternate Gmail token scripts | Token minting scripts may not find the client secret if they do not fall back | Prefer `GMAIL_CLIENT_SECRET`; keep aliases only if a local script still reads them. |
| `GMAIL_REFRESH_TOKEN` | Practice note email sending | Practice Chat Level 2 cannot send First Chord parent emails once missing/revoked | Generate as `musiclessons@firstchord.co.uk` with `https://www.googleapis.com/auth/gmail.send`; do not reuse Sheets token. Re-mint with `node scripts/mint-gmail-token.mjs` (use the same OAuth client as `GMAIL_CLIENT_ID`/`GOOGLE_CLIENT_ID`). An `invalid_grant` failure means this token is dead — re-mint it. The OAuth consent screen is Internal, so tokens don't expire on a schedule. |
| `PRACTICE_NOTES_FROM_EMAIL` | Practice note email sending | Sender may default incorrectly | Usually `musiclessons@firstchord.co.uk`. |
| `PRACTICE_NOTES_FROM_NAME` | Practice note email sending | Sender display name may default incorrectly | Usually `First Chord Music School`. |
| `PRACTICE_CHAT_API_SECRET` | Practice Chat PWA handoff guard | PWA snapshot and Level 2 writeback calls reject when the matching header is missing | A coarse shared secret passed by the trusted tutor handoff. It is not tutor identity: the Level 2 route additionally requires the self-attested tutor to match the student's single recorded tutor and the PWA's recipient-specific human confirmation. |
| `PRACTICE_NOTES_ENABLED_TUTORS` | Optional Level 2 rollout allow-list | A listed tutor's students cannot send when the name is omitted | Comma-separated canonical tutor short names. If omitted, all registered tutors are enabled. Use this only as a temporary operational restriction, not as identity proof. |
| `NEXT_PUBLIC_PRACTICE_CHAT_DASHBOARD_BASE_URL` | Practice Chat quick-link API target override | Practice Chat links may post back to the wrong Railway domain if the default changes | Optional. Defaults to the canonical admin API app `https://first-chord-dashbord-production.up.railway.app`; set it if the admin Railway domain changes. |
| `INCOMING_MESSAGE_INGEST_SECRET` | Incoming message bridge guard | n8n/starred-WhatsApp bridge posts to `/api/admin/incoming-messages` are rejected; manual admin paste still works | Shared secret for external inbound-message capture. Send it as `x-firstchord-incoming-secret`. This is intake-only auth, not permission to auto-act on messages. |
| `SCHEDULE_REFRESH_SECRET` | Schedule refresh cron and manual cron endpoint | GitHub schedule refresh cannot update `Schedule_Context`; capacity/value/schedule context may become stale | Must be set in Railway and GitHub Actions secrets. If missing, the cron endpoint returns 503. |
| `FINANCE_SNAPSHOT_SECRET` | Finance snapshot cron endpoint | Weekly/monthly `Finance_Snapshot` rows are not created | Must be set in Railway and GitHub Actions secrets. If missing, the cron endpoint returns 503. |
| `NEXT_PUBLIC_PAYMENT_PAUSE_PWA_URL` | Planning/payment pause quick links | Pause task links may open the default/old pause tool URL | Set only if the pause PWA URL changes. |
| `DISABLE_API_CACHE` | API cache emergency bypass | Not required; setting `true` bypasses cache | Use only for debugging stale data. |
| `DISABLE_MMS_CACHE` | MMS cache emergency bypass | Not required; setting `true` bypasses MMS cache | Use only when debugging stale MMS reads. |
| `ANALYZE` | Next bundle analysis | No operational impact | Development-only. |

### Local Development Files

| File | Used by | What breaks if missing | Recovery |
| --- | --- | --- | --- |
| `.env.local` | Local Next.js runtime | Local admin pages lose access to env-backed services | Recreate from Railway env values. Do not commit. |
| `.env` | Some local scripts/tools | Local scripts may fail | Prefer `.env.local` for app runtime. Do not commit. |
| `~/token_musiclessons.json` | Local Google Sheets auth fallback in `lib/admin/sheets.js` | Local Sheets reads/writes fail unless env OAuth values are present | Regenerate Google OAuth token JSON. FINN TO FILL IN exact command/account. |
| `lib/config/theta-credentials.js` | Student portal Theta login lookup | Student portal credential lookup fails if config generation has not run | Run `npm run generate-configs`. This file is generated and ignored. |

### Local Tool Env

These are used by local helper tools rather than the Railway app. Keep them out of git.

| Name | Used by | What breaks if missing | Recovery |
| --- | --- | --- | --- |
| `DASHBOARD_BASE_URL` or `INCOMING_MESSAGE_WEBHOOK_URL` | `tools/whatsapp-incoming-bridge` | Starred/manual WhatsApp captures post to the wrong dashboard or fail | Set to the canonical admin Railway URL. |
| `INCOMING_MESSAGE_INGEST_SECRET` | `tools/whatsapp-incoming-bridge` | Bridge posts are rejected by the dashboard API | Must match Railway's value. Store in the bridge `.env.local`, not in git. |
| `BAILEYS_AUTH_DIR` | WhatsApp bridge local session | Bridge may ask for a new WhatsApp pairing or use a different session | Defaults to the local auth folder. Keep this private and local. |
| `BAILEYS_LOG_LEVEL` / `LOG_LEVEL` | WhatsApp bridge logging | No operational breakage | Optional debugging only. |
| `DRY_RUN` | WhatsApp bridge testing | Messages may be logged but not posted when set true | Use for local testing only. |
| `WHATSAPP_CACHE_PATH`, `WHATSAPP_CACHE_LIMIT`, `WHATSAPP_CACHE_MAX_AGE_DAYS`, `WHATSAPP_CAPTURED_BY`, `WRITE_STARRED_LOG`, `SYNC_GROUPS_ON_START`, `GROUP_SYNC_MAX_ATTEMPTS`, `GROUP_SYNC_WAIT_MS` | WhatsApp bridge capture/group-map helpers | Group cache, capture attribution, or starred-log behaviour may differ from expected | Leave defaults unless debugging the bridge. Document any permanent change in `docs/operations/integrations/whatsapp-incoming-bridge.md`. |

## Secret Handling Notes

- `lib/config/theta-credentials.js` used to be tracked. It is now generated locally/build-time and ignored.
- Git history still contains old Theta credential material. We have not rewritten history. Credential rotation or portal-password policy changes are Finn's decision.
- `lib/mms-client.js` used to contain a hardcoded MMS bearer token/API-key JWT. This is more sensitive than the Theta username file because it can grant MMS API access. The code now requires `MMS_BEARER_TOKEN`, but the old token remains in git history. Rotate the MMS API key as the highest-priority post-migration hygiene action when it is operationally safe.

## Railway Project Map

As of 13 June 2026, the Railway account has three relevant projects:

| Project | Service | Domain | Role | Env shape |
| --- | --- | --- | --- | --- |
| `pure-spontaneity` | `first-chord-dashbord` | `https://first-chord-dashbord-production.up.railway.app` | Canonical admin/API runtime. Use this for `/admin`, Practice Chat note writes, Gmail sends, Sheets writes, Stripe scans, and internal operating-system work. | Full admin env: Google OAuth, Sheets, Gmail, Stripe, GitHub, MMS, admin auth. |
| `efficient-sparkle` | `efficient-sparkle` and `first-chord-dashbord` | `https://efficient-sparkle-production.up.railway.app`, `https://first-chord-dashbord-production-d599.up.railway.app` | Legacy/public tutor-student dashboard runtime. `/dashboard` works here. `/admin` is not fully configured on the old public domain. | MMS env plus the four Sheets variables (`GOOGLE_SPREADSHEET_ID`, `SHEETS_REFRESH_TOKEN`, `SHEETS_CLIENT_ID`, `SHEETS_CLIENT_SECRET`), added 2026-07-12 so song assignments read/write works on the public domains. No Gmail/Stripe/GitHub/admin auth. |
| `awake-connection` | `enhanced-music-lesson-notes` | `https://enhanced-music-lesson-notes-production.up.railway.app` | Practice Chat speech/Whisper relay. | OpenAI relay env only. |

Do not assume a GitHub deploy to one Railway service means all Railway services have the same environment variables. Practice Chat quick links should use the canonical admin API base URL for writeback, even if the tutor opens the public dashboard from an older domain.

### AI issue briefing pilot recovery

For the exact request flow, provider payload, safe log fields and error-code
map, see `docs/architecture/ai/runtime-integration.md`.

The AI button is non-consequential and the deterministic explanation is always
the fallback. If calls fail, become slow, produce validation failures, or show
materially misleading wording:

1. Set `ADMIN_AI_ISSUE_BRIEFING_ENABLED=false` on the canonical admin Railway
   service and redeploy/restart. No Sheets/provider reconciliation is required.
2. Confirm **Why does this issue exist?** still loads the deterministic rule,
   evidence, caveats and next step.
3. Inspect runtime metadata by opaque request ID. Logs must not contain the
   prompt, model output, MMS ID, student name, contact details or provider IDs.
4. Fix/evaluate locally with synthetic or redacted fixtures before re-enabling.
5. Rotate `ADMIN_AI_OPENAI_API_KEY` if exposure is suspected; do not rotate or
   interrupt the separate Practice Chat transcription key as part of this step.

### Incoming reply proposal pilot recovery

If reply proposals fail validation, become slow, or produce materially
misleading wording, set `ADMIN_AI_REPLY_DRAFT_ENABLED=false` on the canonical
admin Railway service and redeploy/restart. This removes only the new-draft
controls: stored proposals remain visible so an admin can use, edit, or discard
them. No message is sent automatically and no Sheets/provider reconciliation is
required. Inspect only privacy-safe request metadata; do not add parent message
text, proposal bodies, student identifiers, or contact details to logs. Fix and
evaluate with synthetic/redacted fixtures before re-enabling. If the shared
restricted AI key may be exposed, rotate it and re-check both AI pilots.

## Component Recovery Matrix

This is the first place to look when something is down. The detailed docs linked in the final column remain the source for edge cases.

| Component | Purpose / owner | Healthy state and evidence | Safe retry | Do not retry blindly | Related docs/tests/pages |
| --- | --- | --- | --- | --- | --- |
| Admin app, auth, and Railway deploy | Hosts `/admin`, portals, APIs, and authenticated operating workflows. Owner: Finn. | Railway service `pure-spontaneity` is serving the canonical domain; `/admin/login` works; `npm run test:admin` and `npm run build` pass locally. | Railway redeploy of the last good commit; local rebuild; restart service after env changes. | Do not push/redeploy untested code to fix a live outage unless local build passes or rollback is the explicit plan. | This runbook; `docs/operations/incidents/bug-fixes.md`; `/admin`; `/admin/login`. |
| Google Sheets state store | Operational school truth and dashboard workflow state. Owner: Finn/Tom depending on workflow. | Admin pages load; writes persist; backup script completes; managed tabs match `docs/architecture/data/state-tabs.md`. | Re-run a failed save only after checking the page did not already write; run `npm run backup:sheets` for recovery snapshots; run `npm run ensure:state-tabs` when tabs are missing. | Do not rename headers/tabs casually. Do not bulk paste over a tab without first duplicating it or using a dated backup. | `docs/architecture/data/state-tabs.md`; `scripts/backup-sheets-tabs.mjs`; `npm run backup:sheets`; `/admin/planning`, `/admin/issues`. |
| MMS integration | External lesson, schedule, attendance, contact, and billing-continuity source. Owner: Finn. | MMS health card is healthy; waiting list/capacity/tutor absence lesson lookup return expected data; `MMS_BEARER_TOKEN` is present. | Restart after env changes; refresh specific schedule caches; use `DISABLE_MMS_CACHE=true` briefly only for stale-read diagnosis. | Do not assume an empty MMS result means no lessons exist until token, date, tutor ID, and cache have been checked. Do not drop MMS attendance writes while payroll still relies on MMS. | `/admin/waiting`; `/admin/capacity`; `/admin/workflows/tutor-absence`; `lib/admin/mms.js`; `docs/workflows/tutors/absence-to-pause.md`. |
| Practice Chat and Gmail delivery | Captures lesson notes, optionally marks attendance, and sends parent emails. Owner: Finn. | The final tutor screen names the selected student and exact server-derived parent email, and requires the recipient-specific checkbox; the selected tutor self-attests and matches the student's single recorded tutor assignment. `Practice_Notes_Log` records that self-attestation, Gmail ID, MMS attendance ID, and completed state; `practice_note_delivery_claims` holds one matching terminal claim. | If a draft/snapshot failed before provider work, re-run after checking the selected lesson. After an MMS-success/Gmail-error row, follow up manually—the route deliberately refuses to retry an ambiguous Gmail send. | Do not double-submit parent emails or delete a terminal claim to “try again.” Do not treat `acting_tutor` as verified identity; investigate a mismatch or missing/conflicting tutor record before sending. | `docs/workflows/practice-chat/delivery.md`; `docs/architecture/data/state-tabs.md`; `tests/admin/practice-notes-*.test.mjs`; student detail recent notes panel. |
| Incoming WhatsApp bridge | Captures starred/manual WhatsApp messages into a review inbox. Owner: Finn/Tom for local operation. | Bridge logs `WhatsApp bridge connected`; starred messages post 200 to `/api/admin/incoming-messages`; `Incoming_Message_Inbox` rows appear; `WhatsApp_Group_Map` has current group IDs. | Restart the local bridge; run a manual `--send-test`; re-sync groups when mappings are stale. | Do not let captured messages auto-pause, auto-message, or auto-change payments. Bridge intake is evidence capture only. | `docs/operations/integrations/whatsapp-incoming-bridge.md`; `tools/whatsapp-incoming-bridge/README.md`; `/admin/incoming-messages`. |
| Tutor absence and pause bridge | Turns tutor-away decisions into cover/cancel communication and structured pause plans. Owner: Finn/Tom. | Tutor absence record shows the chosen outcome; cancelled dates produce grouped structured pause planning items; superseded single-day plans are parked; finance pause forecast reads the grouped item. | Repair/merge structured pause dates from the planning card if capture was messy; park duplicate plans instead of deleting history unless they are test records. | Do not run Stripe pauses automatically from tutor absence. Do not message parents before cover/cancel decision is confirmed. | `docs/workflows/tutors/absence-to-pause.md`; `/admin/workflows/tutor-absence`; `/admin/planning`; tests around tutor absence pause planning. |
| Finance snapshots and payroll context | Read-only finance estimate, snapshots, expenses, payroll review, and Wise preparation. Owner: Finn/Tom. | `/admin/finance` loads; latest `Finance_Snapshot` row exists after weekly/monthly cron; `Payroll_Runs` status reflects review/payment state; estimates are labelled as estimates. | Re-run snapshot cron with the secret if GitHub action failed; correct config tabs (`Tutor_Pay`, `Expenses`) before trusting numbers. | Do not treat finance estimates as Stripe/accounting truth. Do not mark payroll paid unless Tom has actually paid it. | `/admin/finance`; `/admin/payroll`; `.github/workflows/finance-snapshot.yml`; `docs/plans/active/tutor-payroll.md`; finance/payroll tests. |
| Backups and restore | Local recovery copy of operational Sheets tabs. Owner: Finn, with Tom able to follow runbook. | `npm run backup:sheets` creates dated CSV/JSON files plus `manifest.json`; no failed tabs; planning reminder moves 14 days forward. | Re-run after fixing auth/network; restore into a duplicate/temp Sheet tab first. | Do not commit backups. Do not overwrite live tabs without comparing headers and taking a current backup. | Backup section below; `scripts/backup-sheets-tabs.mjs`; `backups/sheets/` ignored directory. |

## Component Runbook Template

Use this compact shape when adding a new high-risk component doc. Do not force it onto small styling or copy-only changes.

```md
## Component Name

Purpose:
Owner:
Source of truth:
Inputs:
Outputs:
Dependencies:
Sensitive data:
Healthy state:
Health signals:
Last successful activity:
Common failure modes:
Diagnostic steps:
Safe retry procedure:
Actions that must not be retried blindly:
Rollback or recovery procedure:
Escalation point:
Related tests:
Related dashboard pages:
Last verified:
```

## If MMS API Is Failing

Symptoms:

- Waiting list cannot load or refresh.
- Schedule context refresh fails.
- Capacity/free-slot data looks stale.
- Tutor absence lesson lookup finds no lessons when MMS clearly has lessons.
- Onboarding MMS activation, billing profile, or first lesson creation fails.

Checks:

```bash
rg "MMS_BEARER_TOKEN|MMS_DEFAULT_TOKEN" .env.local .env
npm run build
```

Recovery:

1. Confirm `MMS_BEARER_TOKEN` is present in Railway env for production or `.env.local` locally. After the secret migration commit, Railway must have this variable before deploy.
2. If local only is failing, restart the dev server after editing `.env.local`.
3. If production is failing, update Railway env and redeploy/restart the service.
4. If token is expired, refresh it from MMS/session source. FINN TO FILL IN exact source.
5. Use `DISABLE_MMS_CACHE=true` only briefly if stale cached MMS reads are suspected.

## If Google Sheets Auth Is Failing

Symptoms:

- Admin overview fails.
- Issue/planning/parent-understanding/tutor-absence state does not save.
- Error mentions Sheets, OAuth, spreadsheet ID, or missing tab.

Checks:

```bash
rg "GOOGLE_SPREADSHEET_ID|SHEETS_REFRESH_TOKEN|SHEETS_CLIENT_ID|SHEETS_CLIENT_SECRET" .env.local .env
ls ~/token_musiclessons.json
npm run test:admin
```

Recovery:

1. In production, confirm Railway has `GOOGLE_SPREADSHEET_ID`, `SHEETS_REFRESH_TOKEN`, `SHEETS_CLIENT_ID`, and `SHEETS_CLIENT_SECRET`.
2. Locally, either use those env vars or ensure `~/token_musiclessons.json` exists.
3. If the refresh token has expired/revoked, generate a new one with Google Sheets scope and update Railway/local env. FINN TO FILL IN exact command/account.
4. If a tab is missing, compare against `docs/architecture/data/state-tabs.md`. The app can create some managed state tabs, but do not rename tabs casually.

## If Railway Deploy Is Broken

Symptoms:

- Live site returns `502 Bad Gateway`.
- Railway says deploys are paused or limited.
- GitHub push happened but live URL did not change.

Checks:

```bash
npm run test:admin
npm run build
railway status
railway logs
railway domain
```

Recovery:

1. Confirm local tests/build pass. If local build fails, fix code before redeploying.
2. Check Railway dashboard for paused deploys or limited access.
3. Confirm the service that owns the live public URL. See `docs/operations/incidents/bug-fixes.md` for the previous 502 service/domain mismatch.
4. If Railway is linked locally:

```bash
railway redeploy
```

5. If redeploy does not move the correct service and the code builds locally:

```bash
railway up --detach
```

6. Verify the live URL with:

```bash
curl -I https://efficient-sparkle-production.up.railway.app/dashboard
```

Rollback:

1. Use Railway's Deployments view to redeploy the last known-good deployment.
2. If the bad deploy came from a commit and needs code rollback, revert the commit in git, run tests/build, then push/redeploy.
3. Do not use destructive git reset on shared branches.

## If Dashboard Login Is Failing

Symptoms:

- `/admin/login` says auth is not configured.
- Google sign-in fails.
- Login succeeds but admin pages redirect or deny access.

Checks:

```bash
rg "NEXTAUTH_SECRET|NEXTAUTH_URL|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|ADMIN_ALLOWED_EMAILS" .env.local .env
```

Recovery:

1. Confirm Railway has all auth env vars.
2. Confirm `NEXTAUTH_URL` exactly matches the live Railway URL.
3. Confirm Google OAuth authorized redirect URI includes:

```text
https://<railway-domain>/api/auth/callback/google
```

4. Confirm the user's email is included in `ADMIN_ALLOWED_EMAILS`.
5. If Google client secret was rotated, update Railway and redeploy/restart.

## Deploy Process

Pre-push blocker for the secret migration:

- Add `MMS_BEARER_TOKEN` to Railway before pushing. This may be the existing token if Finn has deliberately deferred rotation.
- Confirm local `.env.local` also has `MMS_BEARER_TOKEN`.
- Strongly recommended: rotate the MMS API key/token that used to be hardcoded in `lib/mms-client.js`, then update Railway/local env with the rotated value.
- Smoke-check MMS-backed pages immediately after deploy: `/admin/waiting`, `/admin/capacity`, and one student portal page.

1. Confirm repo:

```bash
git rev-parse --show-toplevel
```

Expected:

```text
/Users/finnlemarinel/Desktop/FirstChord/music-school-dashboard
```

2. Run:

```bash
npm run test:admin
npm run build
```

3. Commit intentionally.
4. Push only after confirming with Finn:

```bash
git push origin main
```

5. Watch Railway deploy and smoke-test:

- `/admin`
- `/admin/flags`
- `/admin/planning`
- `/admin/workflows/parent-understanding`
- one student portal page

## Sheets Backups

Default backup location:

```text
backups/sheets/
```

This directory is ignored by git and must not be committed because it contains student and parent data.

Manual weekly backup command:

```bash
npm run backup:sheets
```

Before first use or after adding a new dashboard-owned state tab, verify/create managed tabs:

```bash
npm run ensure:state-tabs
```

Local fortnightly schedule:

```bash
npm run install:backup-schedule
```

This installs a macOS LaunchAgent:

```text
~/Library/LaunchAgents/com.firstchord.sheets-backup.plist
```

It runs `npm run backup:sheets` every 14 days from the dashboard repo. Logs are written to:

```text
backups/sheets/launchd.out.log
backups/sheets/launchd.err.log
```

The backup script also updates the existing Planning layer with a recurring action:

```text
Run operational Sheets backup
```

After each successful backup, its target date is moved 14 days forward. If a backup is missed, it appears through the existing dated planning/overview flow as due or overdue.

First verified run:

```text
backups/sheets/2026-06-11T07-04-09Z/
```

That run backed up all existing dashboard-owned state tabs plus `Students`. `Students_Archive` was recorded as skipped because that tab has not been created by the archive workflow yet.

Follow-up verified run after creating `Students_Archive`:

```text
backups/sheets/2026-06-11T12-46-00Z/
```

That run backed up all then-current tabs with zero failed or skipped tabs and set the next planning reminder for `2026-06-25`.

New dashboard-owned state tabs should be added to `scripts/backup-sheets-tabs.mjs`. `Practice_Notes_Log` is included because it stores student-linked note snapshots from Practice Chat. Communication and WhatsApp tabs are included because they hold incoming-message evidence and group identity mappings: `Communication_Log`, `Incoming_Message_Inbox`, and `WhatsApp_Group_Map`. Finance/payroll tabs are included because they store sensitive operating assumptions and review state: `Tutor_Pay`, `Expenses`, `Expense_Log`, `Finance_Snapshot`, `Payroll_Runs`, and `Tutor_Wise`.

If `docs/architecture/data/state-tabs.md` gains a new dashboard-owned tab, update the backup script in the same change or explicitly explain why that tab should not be backed up.

Retention policy for now:

- Keep local dated backups in `backups/sheets/`.
- Keep only the latest 8 backup sets. The backup script prunes older dated folders after a successful backup.
- This retention cap matters because the backups include communication/WhatsApp message evidence, which is useful for recovery but sensitive.
- Do not upload to public storage.
- FINN TO FILL IN whether a private Google Drive backup folder should become the long-term destination.

Restore principle:

1. Open the dated backup folder.
2. Find the affected tab CSV/JSON.
3. Compare headers with the current Google Sheet tab.
4. Restore rows by copying from CSV/JSON into the matching tab, or into a temporary tab first for inspection.
5. For full-tab restore, create a duplicate tab before overwriting anything.

The backup script and first verified backup are part of the operational hygiene hardening pass.

## Known Gaps Finn Should Fill

- Rotate the exposed MMS API key/token that used to be hardcoded in git history when dependent tools can be coordinated.
- Exact source/steps for refreshing MMS bearer tokens.
- Exact Google Cloud project and OAuth refresh-token generation steps.
- Current owner and expiry/rotation policy for `GITHUB_TOKEN`.
- Whether `MMS_DEFAULT_TOKEN` can be retired after legacy MMS routes are reviewed.
- Whether old Theta credential material in git history needs rotation or a portal-password policy change.
- Whether Sheets backups should be copied to a private Google Drive folder after each local run.
