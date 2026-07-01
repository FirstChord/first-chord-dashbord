# First Chord WhatsApp Incoming Bridge

Local helper for capturing deliberately starred WhatsApp messages into the dashboard `Incoming_Message_Inbox`.

This is optional tooling. It is not part of the Railway dashboard build.

## What It Does

- connects to WhatsApp Web using Baileys
- caches incoming message text locally in memory
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

## Test Without WhatsApp

```bash
npm start -- --send-test "Alex is away next Friday"
```

Then check `/admin/incoming-messages`.

## Run

```bash
npm start
```

If it prints a QR code, scan it in WhatsApp:

```text
WhatsApp > Settings > Linked Devices > Link a Device
```

## Privacy

By default, the bridge does not write message payloads to disk. If debugging is needed:

```bash
export WRITE_STARRED_LOG=true
```

That writes to `logs/starred-payloads.ndjson`, which is gitignored and contains personal data.

## Known Fragility

Starred-message updates may arrive without message text. The bridge keeps a recent in-memory cache from `messages.upsert`; if the message is too old or the process restarted, the dashboard receives a placeholder and the row needs manual review.
