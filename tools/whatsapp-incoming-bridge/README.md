# First Chord WhatsApp Incoming Bridge

Local helper that captures WhatsApp messages into the dashboard `Incoming_Message_Inbox`.

This is optional tooling. It is not part of the Railway dashboard build. Full semantics live in `docs/admin/WHATSAPP_INCOMING_BRIDGE.md` (the authoritative doc); this README is setup/ops only.

## What It Does

- connects to WhatsApp Web using Baileys
- caches recent incoming message text locally
- **auto-captures every live text message from dashboard-confirmed FC lesson groups** (since 2026-07-06 — no starring needed; it fetches the confirmed chat list from the dashboard on connect and 6-hourly)
- still posts **starred** messages from anywhere (DMs, unconfirmed groups, emphasis)
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

Starred-message updates may arrive without message text. The bridge keeps a recent local cache from `messages.upsert`; if the message arrived before the bridge saw it, or is outside the cache window, the dashboard receives a placeholder and the row needs manual review.
