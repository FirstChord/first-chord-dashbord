---
status: canonical
audience: [human, agent]
last_verified: null
---
# Disaster Recovery

*Created 2026-07-19. The claim this document makes — and proves — is that the school
survives any single thing dying: this Mac, the Google Sheet, or Railway. Read top to
bottom once; in an actual incident, jump to the matching section.*

**The restore path is TESTED.** `npm run restore:drill` was run for real on 2026-07-19:
all 30 tabs (10,809 rows) restored from backup into a scratch spreadsheet and verified
(headers + row counts). Re-run the drill once a term — an untested backup is a hope,
not a guarantee.

---

## Single points of failure — the register

| SPOF | What dies with it | Recovery | Tested? |
|---|---|---|---|
| **Google Sheet** ("First Chord Database") | All operational state: students, planning, logs, payroll review, song assignments | Restore latest `backups/sheets/` set → new spreadsheet (below) | **Yes — 2026-07-19 drill** |
| **This Mac** | Local tokens, `.env.local`, launchd agents (backup, song-requests check, WhatsApp group sync, **incoming bridge**), Soundslice toolshed | Cold-start runbook (below). Production keeps running meanwhile — Railway is independent of this Mac | Runbook written, not yet rehearsed on clean hardware |
| **Railway** | The live dashboard + portals + crons | Redeploy from GitHub `main`; re-enter env vars (Railway dashboard is their canonical home) | Implicitly (every push is a redeploy) |
| **`~/token_musiclessons.json`** | Local Sheets access for scripts/backups (dashboard prod unaffected — Railway has its own `SHEETS_*` creds) | Re-mint via Google OAuth; procedure in `first-chord-brain/CONTEXT.md` → credentials section | n/a |
| **MMS bearer token** (`MMS_BEARER_TOKEN`) | Schedule refresh, attendance, payroll lesson counts | Re-issue from MMS; ApiKey-profile token (long-lived). Note: calendar-write endpoints need a Teacher-session token we deliberately don't keep | n/a |
| **WhatsApp bridge session** (Baileys, business number) | Incoming message auto-capture (receive-only) | Re-link per `WHATSAPP_INCOMING_BRIDGE.md`; ban-risk posture and always-on host plan (`PI_OPS_HOST_PLAN.md`) apply | Documented there |
| **Stripe / Gmail restricted keys** | Payment reads / practice-note email | Re-issue in provider dashboards; scopes documented in `docs/architecture/ai/runtime-integration.md` (AI key), `docs/CURRENT_STATUS.md` policy notes (Stripe read scopes) | n/a |

**What is deliberately NOT a SPOF:** truth systems. MMS, Stripe, and GitHub hold their
own truth; the Sheet holds *operational* state; the dashboard holds none. Losing the
dashboard loses no data. Losing the Sheet loses at most `BACKUP_SET_RETENTION` × 14
days — actually at most 14 days (the launchd backup interval), and usually less.

## Degradation map (what breaks vs what keeps working)

- **Mac off / dead:** production dashboard, portals, Stripe crons — all fine. Lost:
  incoming WhatsApp capture (bridge), scheduled local backups, song-request Monday
  ping, local scripts. Nothing corrupts; everything resumes when a machine returns.
- **Sheet unreachable:** dashboard pages degrade to cached/stale reads (60s/5min SWR);
  portals render without assigned songs (logged warning, not an error); Practice Chat
  fails closed on its audit write. No writes are silently dropped — they error.
- **MMS down:** schedule context serves cached rows with `checked_at` staleness
  visible; payroll/attendance actions wait.

---

## Restoring the Google Sheet (the rehearsed path)

1. `npm run restore:drill` — restores the latest complete backup set to a **scratch**
   spreadsheet and verifies every tab. This is also the termly rehearsal command.
2. For a real loss: run the drill, confirm PASSED, then either promote the scratch
   spreadsheet (update `GOOGLE_SPREADSHEET_ID` in Railway + `.env.local` + brain
   `.env`) or restore tab-by-tab into a repaired original (procedure + cautions:
   `docs/operations/runbook.md` → Backups).
3. After promoting a new spreadsheet: re-run `node scripts/ensure-state-tabs.mjs`
   (recreates any tab the backup predates), re-share the sheet with the same Google
   account, and re-protect the `Students` header row (format contract).
4. **What the backup does NOT hold:** `Stripe_Amounts_Cache` (rebuilt by the Monday
   cron), `Schedule_Context` staleness (refresh from MMS), `Bridge_Status`
   (heartbeat re-appears on its own). All deliberate — caches rebuild from truth.

Partial backup sets (a `manifest.json` listing failed tabs, or none) must never be
restored from; the drill skips them automatically.

## Cold start: blank Mac → fully operational

Order matters; each step unblocks the next. Production is already fine — this
rebuilds the *local* half of the system.

1. **Prereqs:** install Node 20+, Python 3, `rg`; sign into the Google account and
   the password manager.
2. **Clone the three repos** into `~/Desktop/FirstChord/` (`music-school-dashboard`,
   `first-chord-brain`; Payment Pause per its own repo). `FirstChord/` itself is not
   a git repo. Workspace rules: root `CLAUDE.md`.
3. **Secrets back onto disk** — three files, none in git:
   - `music-school-dashboard/.env.local` — copy values from the Railway dashboard
     (its env panel is the canonical copy of every runtime secret) plus the local-only
     extras (`SHEETS_*` can be taken from `~/token_musiclessons.json` once minted).
   - `first-chord-brain/.env` — `GOOGLE_SPREADSHEET_ID`, `MMS_BEARER_TOKEN`.
   - `~/token_musiclessons.json` — re-mint per `first-chord-brain/CONTEXT.md`.
   - Soundslice toolshed `.env` (`SOUNDSLICE_APP_ID` / `SOUNDSLICE_PASSWORD`) in
     `~/Desktop/Tools:Games/FC Admin Tools/Soundslice/`.
4. **Verify reads before anything else:** `npm install`, then
   `node scripts/list-song-requests.mjs` (proves Sheets), `npm run test:admin`,
   `npm run build`.
5. **Reinstall the launchd agents** (each is idempotent):
   `node scripts/install-sheets-backup-launch-agent.mjs` and
   `node scripts/install-song-requests-launch-agent.mjs`; the WhatsApp bridge +
   group-sync agents per `WHATSAPP_INCOMING_BRIDGE.md` (bridge re-link = QR scan
   with the business number; read the ban-risk section first).
6. **Take a backup immediately** (`npm run backup:sheets`) — the new machine's first
   backup set is its proof of full access — and run `npm run restore:drill` once.
7. Restore the terminal cockpit from `~/Documents/terminal-cockpit/` if its guides
   were preserved; they are machine-local and optional.

**Standing Finn-side hardening (the honest gaps):** keep a current copy of the three
secret files in the password manager (they exist only on this Mac otherwise);
`backups/sheets/` itself lives on this Mac's disk — a periodic copy to iCloud/Drive
or an external disk removes the "backup dies with the machine" loop. Neither is
automated deliberately: both involve credential handling this workspace keeps
human-decided.

---

*Maintenance: when a new Sheets tab is added, `backup-sheets-tabs.mjs`'s `BACKUP_TABS`
must gain it in the same session (this file's 2026-07-19 origin story: five
non-rebuildable tabs — Cover_Bank_State and the four Song_* tabs — were missing from
the backup list). The contract guard added the same day fails a test when a managed
tab is not backed up, so this can no longer drift silently.*
