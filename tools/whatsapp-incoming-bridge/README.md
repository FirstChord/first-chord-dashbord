# First Chord WhatsApp Incoming Bridge

Local helper for capturing deliberately starred WhatsApp messages into the dashboard `Incoming_Message_Inbox`.

This is optional tooling. It is not part of the Railway dashboard build.

## What It Does

- connects to WhatsApp Web using Baileys
- caches recent incoming message text locally
- when a message is starred, posts the cached message text + metadata to the dashboard
- uses `INCOMING_MESSAGE_INGEST_SECRET` to authenticate with the dashboard endpoint

## What It Must Not Do

- read all WhatsApp messages into the dashboard by default
- auto-create pause/payment actions
- auto-send replies
- treat WhatsApp as source truth

The dashboard inbox is review-only.

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

```bash
npm start -- --sync-groups
```

Enumerates every group the account is in and posts them (metadata only — no message
text) to the dashboard, which keeps the First Chord ones (instrument in the title,
active within 6 months) and auto-matches a student by participant phone / name for you
to confirm in the inbox. One-shot: it connects, syncs, prints a summary, and exits.

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
