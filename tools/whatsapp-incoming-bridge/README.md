# First Chord WhatsApp Incoming Bridge

Local helper that captures WhatsApp messages into the dashboard `Incoming_Message_Inbox`.

This is optional tooling. It is not part of the Railway dashboard build. Full semantics live in `docs/admin/WHATSAPP_INCOMING_BRIDGE.md` (the authoritative doc); this README is setup/ops only.

## What It Does

- connects to WhatsApp Web using Baileys
- caches recent incoming message text locally
- **auto-captures every live text message from dashboard-confirmed FC lesson groups** (since 2026-07-06 — no starring needed; it fetches the confirmed chat list from the dashboard on connect and 6-hourly). This is now the **only** capture channel — the starred-message path was removed 2026-07-07 (see `git log`); anything outside a confirmed group is handled via Quick capture on the dashboard.
- uses `INCOMING_MESSAGE_INGEST_SECRET` to authenticate with the dashboard endpoint

## What It Must Not Do

- ingest chats outside the human-confirmed group map (no DMs, no personal groups — the dashboard re-checks the map on every capture)
- auto-create pause/payment actions
- auto-send replies
- treat WhatsApp as source truth

The dashboard inbox is review-only.

## Auto-Capture Env

```bash
export AUTO_CAPTURE_CONFIRMED_GROUPS=true   # default on; false = starred-only
export CONFIRMED_GROUPS_REFRESH_MS=21600000 # optional, default 6h
```

Staff numbers (Tom's personal number, so school replies stamp items instead of creating rows) are configured on the **dashboard** side: Railway env `INCOMING_STAFF_PHONES`.

## Sleep / Offline Behaviour

The bridge only captures while this Mac is awake. WhatsApp queues messages for offline linked devices, so after the Mac wakes the bridge reconnects and the queued messages are delivered and captured — the loop is **delayed, not broken**. Backstops: the dashboard shows a "WhatsApp capture quiet" card after 3 silent days, and manual Quick capture on `/admin/incoming-messages` works from any device at any time. If the device stays offline ~14 days, WhatsApp unlinks it — re-scan the QR (`npm start` shows it).

## Resilience (watchdog + relaunch)

launchd's `KeepAlive` only relaunches on process **exit**. The failure mode this misses is a process that's alive-but-hung — e.g. the Mac slept, the WhatsApp socket died without a clean `close`, and every timer (heartbeat, reconnect) froze. Observed 2026-07-08: 11h with no heartbeat while the process was still "running".

The in-process **watchdog** closes that gap. It tracks a "last healthy" moment — a connect, a heartbeat posted while connected, or a live capture — and if nothing healthy happens for `BRIDGE_WATCHDOG_STALE_MS` it force-exits (`process.exit(1)`), turning the hang into an exit so launchd starts a **fresh** process. The watchdog timer is deliberately not `unref`'d, so it keeps firing (and fires on wake after sleep). The plist has a `ThrottleInterval` of 30s so a fast-exiting process can't spin.

```bash
export BRIDGE_WATCHDOG=true              # default on; false disables the watchdog
export BRIDGE_WATCHDOG_STALE_MS=900000   # optional, default 15m, floor 5m
export BRIDGE_WATCHDOG_CHECK_MS=120000   # optional, default 2m, floor 30s
```

The watchdog makes recovery automatic, but it does **not** remove the single point of failure that the bridge runs on one Mac. The durable fix is hosting it somewhere always-on (e.g. a Raspberry Pi / always-on box). For the group-chat use case, a linked-device library (Baileys) is required — the official WhatsApp Cloud API cannot read arbitrary group chats.

## Setup

```bash
cd tools/whatsapp-incoming-bridge
npm install
```

Create a local `.env` or export env vars in the terminal:

```bash
export DASHBOARD_BASE_URL="https://first-chord-dashbord-production.up.railway.app"
export INCOMING_MESSAGE_INGEST_SECRET="same value as Railway"
export WHATSAPP_CAPTURED_BY="Finn"
```

Optional, to reuse the existing local Baileys login:

```bash
export BAILEYS_AUTH_DIR="~/auth_info_baileys"
```

Without that, the bridge stores auth in `tools/whatsapp-incoming-bridge/auth_info_baileys/`, which is gitignored.

Optional cache settings:

```bash
export WHATSAPP_CACHE_PATH="./cache/recent-messages.json"
export WHATSAPP_CACHE_LIMIT="2000"
export WHATSAPP_CACHE_MAX_AGE_DAYS="14"
```

The cache is gitignored and can contain parent/student message text.

## Test Without WhatsApp

```bash
npm start -- --send-test "Alex is away next Friday"
```

Then check `/admin/incoming-messages`.

## Import all groups at once

Enumerates every group the account is in and posts them (metadata only — no message
text) to the dashboard, which keeps the First Chord ones (instrument in the title,
active within 6 months) and auto-matches a student by participant phone / name for you
to confirm in the inbox.

WhatsApp allows only **one live connection per linked device**, so how you sync depends
on whether the always-on bridge is already running:

**If the bridge is already running** (recommended) — trigger a sync on its live
connection with a signal, so there's no second connection and no `connectionReplaced`
(440) clash:

```bash
kill -USR1 "$(pgrep -f 'node bridge.js')"
```

Watch the bridge's own log output for `Live group sync complete`. You can also start the
bridge with `SYNC_GROUPS_ON_START=true` to sync automatically a few seconds after it
connects.

**If the bridge is NOT running** — use the one-shot command (connects, syncs, prints a
summary, exits):

```bash
npm start -- --sync-groups
```

> Don't run `--sync-groups` while the always-on bridge is running — the two connections
> fight (status 440). Use the `kill -USR1` signal instead.

## Run

```bash
npm start
```

If it prints a QR code, scan it in WhatsApp:

```text
WhatsApp > Settings > Linked Devices > Link a Device
```

## Privacy

By default, the bridge writes a small recent-message cache to `cache/recent-messages.json`. This lets a message be captured if it arrived while the bridge was running but was starred later, even after a restart.

If debugging is needed:

```bash
export WRITE_STARRED_LOG=true
```

That writes to `logs/starred-payloads.ndjson`, which is gitignored and contains personal data.

## Known Fragility

- **Single-host dependency.** The bridge runs on one Mac; if it's asleep/off, capture is delayed until it wakes (messages queue, then deliver). The watchdog (above) makes a *hung* process self-heal, but the Mac still has to be on. Always-on hosting is the real fix.
- **WhatsApp closes the socket routinely** (status 428/503/440). Normal — the bridge reconnects on any non-logout close. Only a `loggedOut` close (device unlinked) needs a QR re-scan.
- **One live connection per linked device.** Don't run `--sync-groups` while the always-on bridge is up (status 440 clash) — use `kill -USR1` instead.
