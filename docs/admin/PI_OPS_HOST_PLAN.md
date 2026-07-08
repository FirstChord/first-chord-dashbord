# Always-On Ops Host (Raspberry Pi) — Migration Plan

**Status:** planned, not started. Written 2026-07-08. Revisit when the hardware arrives (Finn: ~2 weeks).

**Why:** the WhatsApp bridge and three scheduled jobs currently run as macOS launch agents on Finn's MacBook. They only run while that Mac is awake — if it sleeps or is shut, capture is delayed and backups/syncs silently don't happen. A small always-on box removes that single point of failure. See Learning Log [[2026-07-08 - Bridge Watchdog Turns a Hang into a Relaunch]] for the incident that prompted this.

**Why a Pi over Railway (for the bridge specifically):** a WhatsApp linked-device socket wants a **residential IP** — datacentre IPs (Railway) are more likely to be challenged or logged out. A Pi also keeps physical control of the WhatsApp auth session and has no per-service cost for a persistent stateful process. Railway remains the right home for the *stateless* dashboard. For reading parent **group chats**, a linked-device library (Baileys) is required regardless of host — the official WhatsApp Cloud API cannot read arbitrary group chats.

---

## What moves to the Pi

| Current launch agent | What it does | Cadence | Pi equivalent |
|---|---|---|---|
| `com.firstchord.whatsapp-incoming-bridge` | Baileys bridge → dashboard inbox | always-on | **systemd service**, `Restart=always` (watchdog stays as 2nd layer) |
| `com.firstchord.sheets-backup` | `npm run backup:sheets` (+ census) | every 14 days | **systemd timer**, `Persistent=true` (runs missed jobs after downtime) |
| `com.firstchord.whatsapp-group-sync` | `SIGUSR1` → bridge live group re-sync | Mon 06:30 | **systemd timer**, `OnCalendar=Mon 06:30` |
| `com.firstchord.sync` | *(orphaned — script deleted)* | — | **do not migrate; delete** (see Housekeeping) |

Not moving (stays as-is): the Railway dashboard; `first-chord-brain` regeneration is run on demand, not scheduled — migrate only if it becomes a cron.

---

## Hardware

- **Raspberry Pi 5, 4GB** (8GB if you want headroom for future jobs). The bridge idles ~100MB.
- **Boot from a USB SSD, not a microSD.** SD-card corruption is the classic Pi failure; a cheap USB3 SSD removes it. ~120GB is plenty.
- **Official 27W USB-C PSU** (the Pi 5 is picky about power).
- **Case with a fan** (Pi 5 runs warm) — the official Active Cooler is fine.
- **Optional but recommended: a small UPS/battery HAT** so a power blip doesn't corrupt a write or drop the WhatsApp link.

## OS & runtime

- **Raspberry Pi OS Lite (64-bit)**, headless. Flash with Raspberry Pi Imager; preset the hostname (`fc-ops`), a user, Wi-Fi/ethernet, and enable SSH in the imager so it's headless from first boot. Ethernet preferred for a stable WhatsApp connection.
- **Node** (match the Mac's major, currently v22): install via NodeSource apt repo.
- **Python 3** (`sudo apt install python3 python3-venv`) only if/when `first-chord-brain` jobs move too.
- Create a dedicated user (e.g. `fcops`) and put the repos under `/home/fcops/`. Clone `music-school-dashboard`; `npm ci` inside `tools/whatsapp-incoming-bridge` and at the repo root (the backup script needs the root deps).

## Secrets (never in git)

Recreate these on the Pi as local files, copied by hand (not committed):
- `tools/whatsapp-incoming-bridge/.env` — `DASHBOARD_BASE_URL`, `INCOMING_MESSAGE_INGEST_SECRET`, `WHATSAPP_CAPTURED_BY`, plus any watchdog overrides.
- Root `.env.local` / `.env` for `backup:sheets` — `GOOGLE_SPREADSHEET_ID` and the Google auth (`~/token_musiclessons.json` equivalent). Confirm the token path the backup script expects and copy it over.
- `auth_info_baileys/` — either copy the Mac's directory over (keeps the existing link) or re-scan the QR on first `npm start` (see below).

---

## systemd units (templates)

`/etc/systemd/system/fc-bridge.service`:

```ini
[Unit]
Description=First Chord WhatsApp incoming bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=fcops
WorkingDirectory=/home/fcops/music-school-dashboard/tools/whatsapp-incoming-bridge
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=30
# Keep the in-process watchdog too: systemd, like launchd, only sees exits,
# not a hung-but-alive process. The watchdog turns a hang into an exit.

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/fc-sheets-backup.service` (+ `.timer`):

```ini
# fc-sheets-backup.service
[Unit]
Description=First Chord Sheets backup + census
[Service]
Type=oneshot
User=fcops
WorkingDirectory=/home/fcops/music-school-dashboard
ExecStart=/usr/bin/npm run backup:sheets
```
```ini
# fc-sheets-backup.timer
[Unit]
Description=Fortnightly First Chord Sheets backup
[Timer]
OnCalendar=Sat *-*-1..7,15..21 03:00   # ~1st and 3rd Saturday, 03:00
Persistent=true                         # runs a missed backup after downtime
[Install]
WantedBy=timers.target
```

`fc-group-sync.timer` → `OnCalendar=Mon 06:30`, running a one-shot that signals the bridge:
`ExecStart=/usr/bin/systemctl kill -s SIGUSR1 fc-bridge.service` (cleaner than `pkill`).

Enable: `sudo systemctl enable --now fc-bridge.service fc-sheets-backup.timer fc-group-sync.timer`.

> **`Persistent=true` is the upgrade over launchd here** — launchd's `StartInterval` timer resets on every load, so frequent reboots can indefinitely delay a backup. A systemd persistent timer runs the missed job on next boot.

## WhatsApp re-link

WhatsApp allows one live connection per linked device, so **stop the Mac bridge before starting the Pi one** (two live sockets fight → status 440). Then either:
- copy `auth_info_baileys/` from the Mac to the Pi (keeps the current link — no re-scan), or
- run `npm start` once on the Pi and scan the QR (`WhatsApp > Settings > Linked Devices > Link a Device`).

Confirm on the dashboard: heartbeat fresh, confirmed groups back to ~170, a test message captured.

## Alerting (so a human isn't the monitor)

Today the only outage signal is the amber card on `/admin` — which requires someone to look. Add a small cron/timer on the Pi that reads the dashboard's `Bridge_Status` heartbeat and pushes a notification (e.g. ntfy.sh, a Telegram bot, or email) when it's stale > ~1h. *Caveat:* if the Pi hosts the bridge, the alerter is watching itself — fine for "bridge stuck, Pi up", but a truly independent check (phone/other box) is better long-term.

---

## Migration order (low-risk, reversible)

1. Pi up, headless, Node installed, repo cloned, deps installed — **no jobs enabled yet.**
2. Move **sheets-backup** first (lowest risk, read-only): copy secrets, enable the timer, run it once manually (`systemctl start fc-sheets-backup.service`), confirm a backup set + `census.json` appear. Leave the Mac one as-is for one cycle, then disable it.
3. Move **the bridge**: stop the Mac bridge (`launchctl bootout …`), copy `auth_info_baileys` + `.env`, enable `fc-bridge.service`, confirm heartbeat + a captured test message. Keep the Mac plist unloaded but present for a week as rollback.
4. Move **group-sync** (depends on the bridge being on the Pi now).
5. Add **alerting**.
6. Once stable ~1 week, remove the Mac launch agents (keep the tracked plist copies under `tools/whatsapp-incoming-bridge/launchd/` for reference).

**Rollback at any step:** re-`bootstrap` the Mac launch agent and stop the Pi unit — the Mac setup is unchanged underneath.

---

## Housekeeping to do now (before the Pi)

- **`com.firstchord.sync` is orphaned** — its script `/Users/finnlemarinel/Desktop/sync_to_icloud.sh` was deleted, so launchd fail-loops it (exit 78, `KeepAlive`). It is not a First Chord ops job. Disable it: `launchctl bootout gui/$(id -u)/com.firstchord.sync` and remove `~/Library/LaunchAgents/com.firstchord.sync.plist`. (Confirm with Finn first — it may be a personal iCloud-sync leftover.)

## Future jobs the Pi could also host

Second-order value once it exists: `first-chord-brain` identity regeneration on a schedule; a LAN status page (bridge health / last sync / last backup at a glance); a second local copy of the Sheets/DB backups on the Pi's disk. See CURRENT_STATUS for the running list.
