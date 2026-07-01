# WhatsApp Incoming Bridge

Last updated: 2026-07-01

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
npm start -- --sync-groups
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

The repo bridge keeps this cache on local disk by default:

```text
tools/whatsapp-incoming-bridge/cache/recent-messages.json
```

That folder is gitignored because it can contain parent/student message text. It lets the bridge recover message bodies after a restart if the message arrived while the bridge was running. It does not recover messages from before the bridge ever saw them.

Useful env vars for the local bridge:

```text
INCOMING_MESSAGE_WEBHOOK_URL=https://<dashboard>/api/admin/incoming-messages
INCOMING_MESSAGE_INGEST_SECRET=<same value as Railway dashboard app>
WHATSAPP_CAPTURED_BY=Finn
WHATSAPP_CACHE_LIMIT=2000
WHATSAPP_CACHE_MAX_AGE_DAYS=14
```

## Dashboard Storage

Rows are written to `Incoming_Message_Inbox`.

Lane: workflow state.

Group chat IDs are also upserted to `WhatsApp_Group_Map` when the captured message comes from a WhatsApp group (`@g.us`).

The dashboard stores deterministic hints:

- suspected category
- matched student
- match confidence
- match reasons
- review status

Current categories are deliberately small:

- `one_off_absence` — one missed lesson / cannot make it
- `extended_absence` — multi-lesson break or pause period
- `summer_break` — summer/holiday wording such as "last lesson before July/August/back to school"
- `leaving` — lessons genuinely ending
- `payment`
- `schedule`
- `concern`
- `general`

For group chats, it also stores:

- WhatsApp group ID
- latest group name
- first/last seen timestamps
- latest matched student hint
- confirmed matched MMS ID / FC ID when reviewed
- parent name/phone, tutor, and instrument context when reviewed
- who confirmed the group map and when
- latest match confidence/reasons

These are not source truth. They only help decide the next human action.

Admins can correct a message's category/student match in the inbox. If a WhatsApp group is confirmed for a student, future messages from that group use the group map as high-confidence matching evidence before weaker text/name guesses.

## Bulk Group ID Sync

Instead of learning group IDs one starred message at a time, the bridge can import them all at once (metadata only — no message content).

WhatsApp allows only **one live connection per linked device**, so there are two ways to sync depending on whether the always-on bridge is running:

- **Bridge already running (preferred):** `kill -USR1 <pid>` triggers a sync on the bridge's *live* socket — no second connection, so it never trips WhatsApp's `connectionReplaced` (status 440). Or start the bridge with `SYNC_GROUPS_ON_START=true` to sync automatically shortly after connecting.
- **Bridge not running:** `npm start -- --sync-groups` runs a one-shot (connect → sync → exit). It reconnects on transient closes but must **not** run alongside the always-on bridge (they clash with 440).

Either path enumerates every group the linked account is in (`groupFetchAllParticipating`), uses chat history for each group's last-active time, and POSTs the list to the dashboard (`mode: sync_groups`). The dashboard then, per group (`buildGroupSyncPlan` in `incoming-message-helpers.mjs`):

- **keeps only First Chord groups** — the title must contain an instrument token (every FC group title has one; personal groups don't). The roster's own instruments are unioned into the keyword list automatically.
- **drops groups inactive for 6+ months** (unknown last-active is kept, fail-open).
- **auto-matches a student** by participant phone (deterministic, strongest), then by the known title format. FC group titles are `{Student first name} {Instrument} Lessons {emoji}` (e.g. "Alex Guitar Lessons 🎸"), so first-name + the student's own instrument is a strong signal that also disambiguates same-name students on different instruments. Stored as a `review` hint with the matched student, FC ID, and instrument.

> **Format contract:** the group-title convention `{First name} {Instrument} Lessons {emoji}` is what both the instrument filter and the name/instrument matcher rely on. If that naming changes, revisit `detectInstrumentInName` / `matchGroupToStudent` in `incoming-message-helpers.mjs`.

Confirmed groups are never downgraded by a sync — they only get their name/last-active refreshed. Ignored groups are left alone.

Triage happens in the inbox's **WhatsApp groups** panel: each `review` group shows a student dropdown (pre-filled with the best guess) plus **Confirm** / **Not FC** buttons (`mode: review_group`). Confirming stores the full student/parent/tutor context and flips the group to `confirmed`, so every future message from it matches at high confidence with no further work. New groups that appear after a sync still arrive via the reactive starred-message path, or re-run the sync.

Inbox status buttons:

- `Convert to plan + draft reply`: saves the reviewed category/student/group-map training, creates a linked `Planning_Items` action, archives the message (`converted`), and returns a suggested WhatsApp reply. See "From message to action" below.
- `Save correction`: saves the reviewed category/student/group-map training and keeps the message open for action.
- `Save + archive`: saves the correction and archives the message because the relevant action has been handled or logged elsewhere.
- `Archive handled`: archives a message without changing the correction fields.
- `Ignore`: close noise/no-action messages without converting them.
- `Delete test`: hard-delete test/noise rows only.

Archived/ignored rows are hidden by default so the inbox stays focused on messages still needing a decision.

## From Message to Action

Once a message is read correctly, `Convert to plan + draft reply` closes the loop:

1. Applies any category/student/group-map correction from the panel.
2. Creates a `Planning_Items` action (via `savePlanningItem`) linked to the matched student. The planning id is derived from the incoming id (`planning_<incomingId>`), so re-converting the same message upserts the same task instead of duplicating. Category maps to a planning `area` (absence/schedule → `workflow`, payment/leaving → `finance`, concern/general → `parent`). The original message, sender, and the suggested reply travel in the item notes.
3. Writes `created_planning_id` back onto the inbox row and marks it `converted`.
4. Returns a suggested WhatsApp reply, shown in an editable box with a Copy button.

The reply is a **copy-paste draft only** — consistent with the transport-only boundary above, nothing is sent to WhatsApp automatically. The human edits it and sends it themselves. Reply wording is per-category and lives in `buildIncomingReplyTemplate` (`lib/admin/incoming-message-helpers.mjs`); the planning mapping lives in `buildIncomingPlanningDraft`.

## Classification Evidence

Starred bridge capture gives the dashboard:

- message text
- WhatsApp message ID
- chat/group ID
- chat/group name where available
- sender display name where available
- sender phone/JID where available
- message timestamp
- capture timestamp
- captured-by name
- raw JSON with message type, `fromMe`, and whether the bridge cache was hit

Manual paste capture gives the dashboard:

- message text
- optional sender name
- optional sender phone
- optional chat/group name
- logged-in dashboard user as the actor
- capture timestamp

The strongest future classification/matching evidence is sender phone, message text, chat/group name, and timestamp. Manual paste is still useful, but starred capture usually gives better metadata.

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
