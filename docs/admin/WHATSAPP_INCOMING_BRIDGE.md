# WhatsApp Incoming Bridge

Last updated: 2026-06-30

## Purpose

Capture selected inbound WhatsApp messages into the dashboard so Finn/Tom can review them and turn them into planning/workflow action when appropriate.

This is for messages such as:

- parent says a student will miss a lesson
- parent asks for a pause/holiday period
- parent raises a payment or schedule question
- tutor/parent message should not disappear in WhatsApp memory

## Boundary

The bridge is transport only.

It must not:

- auto-pause Stripe
- auto-send WhatsApp replies
- create payment expectation changes
- mark lessons absent
- decide that a message is true

It may:

- capture a starred/manual message
- send metadata to the dashboard
- let the dashboard classify/match it as a review hint

Humans still approve the consequential action.

## Dashboard Endpoint

Route:

```text
POST /api/admin/incoming-messages
```

External bridge requests must include:

```text
x-firstchord-incoming-secret: <INCOMING_MESSAGE_INGEST_SECRET>
```

Manual admin paste works through the logged-in `/admin/incoming-messages` page and does not need the bridge secret.

## Payload Shape

Recommended bridge payload:

```json
{
  "source": "whatsapp_starred",
  "external_message_id": "message id from WhatsApp",
  "chat_id": "chat or group id",
  "chat_name": "chat/group display name if known",
  "sender_name": "sender display name if known",
  "sender_phone": "+447...",
  "message_text": "The message body",
  "message_at": "2026-06-30T20:30:00.000Z",
  "captured_at": "2026-06-30T20:31:00.000Z",
  "captured_by": "Finn",
  "raw_json": "{...optional original payload...}"
}
```

## Dashboard-Owned Bridge Tool

Preferred local tool:

```text
tools/whatsapp-incoming-bridge/
```

It is optional tooling and is not part of the Railway dashboard build. It has its own `package.json` so Baileys does not become a dashboard production dependency.

Useful commands:

```bash
cd tools/whatsapp-incoming-bridge
npm install
npm start -- --send-test "Alex is away next Friday"
npm start
```

See `tools/whatsapp-incoming-bridge/README.md` for setup.

## Old Local Prototype

Local folder:

```text
~/Desktop/whatsapp
```

That folder is not part of this repo. It currently sits under the old home-directory git clone, so do not commit from there. Treat it as reference/history only.

The local Baileys prototype should cache incoming message bodies from `messages.upsert`. A later `messages.update` star event often contains only the message key, not the message text. If the cache misses, the dashboard should still receive a placeholder, but those rows need manual review.

Useful env vars for the local bridge:

```text
INCOMING_MESSAGE_WEBHOOK_URL=https://<dashboard>/api/admin/incoming-messages
INCOMING_MESSAGE_INGEST_SECRET=<same value as Railway dashboard app>
WHATSAPP_CAPTURED_BY=Finn
WHATSAPP_CACHE_LIMIT=2000
```

## Dashboard Storage

Rows are written to `Incoming_Message_Inbox`.

Lane: workflow state.

The dashboard stores deterministic hints:

- suspected category
- matched student
- match confidence
- match reasons
- review status

These are not source truth. They only help decide the next human action.

## Rollout

1. Use manual paste on `/admin/incoming-messages`.
2. Test the local starred-message bridge with one or two non-sensitive messages.
3. Confirm rows include real message text, sender phone, and useful match hints.
4. Only then decide whether this replaces the WhatsApp Brain group habit.

## Risks

- Starred update may arrive after the original message has fallen out of cache.
- WhatsApp/Baileys is unofficial and can break.
- Logs contain personal data; do not commit or upload them publicly.
- Phone/name matching can be wrong. Keep review manual.
