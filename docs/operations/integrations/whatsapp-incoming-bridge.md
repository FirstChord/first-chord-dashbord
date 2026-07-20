---
status: canonical
audience: [human, agent]
last_verified: 2026-07-20
---
# WhatsApp Incoming Bridge

## Purpose

The local Baileys bridge copies live parent messages from human-confirmed First
Chord lesson groups into the admin inbox. It is a receive-only intake aid, not a
WhatsApp sender or a source of operational truth.

Manual **Quick capture** on `/admin/incoming-messages` is the fallback for direct
messages, unconfirmed groups, bridge downtime, and anything missed while the
bridge was offline. Starring is not a capture path.

## Active Capture Contract

The bridge posts only `messages.upsert` events with `type === "notify"` whose
chat ID is in its dashboard-supplied confirmed-group set. It skips:

- history/append batches, unconfirmed chats, and an empty confirmed set
- duplicate message IDs already posted by that process
- media with no extractable text or caption

`AUTO_CAPTURE_CONFIRMED_GROUPS` defaults to `true`. Setting it to `false`
disables automated capture; it does not enable a starred-message fallback.

Each post includes source `whatsapp_group_auto`, stable WhatsApp chat/message
IDs, sender metadata, text, timestamps, `from_me`, and small raw metadata. The
dashboard re-checks that the chat is still `confirmed` before storing it. Its
replay identity is `source + chat_id + external_message_id`, so a repeated post
is a no-op.

Own-account, configured staff, and the confirmed group's tutor replies do not
create parent-message rows. They stamp reply evidence on still-open rows; they
do not mark the work handled.

Parent messages are deterministically classified and matched as proposals.
General messages with no detected date or duration arrive pre-archived as
`ignored`; specific categories or date evidence remain open. Neither result
authorises a payment, pause, attendance, archive, planning, or messaging action.

## Confirmed-Group Gate

On connection, and every six hours by default, the bridge requests
`GET /api/admin/incoming-messages?mode=confirmed_groups` using
`INCOMING_MESSAGE_INGEST_SECRET`. A refresh failure retains the previous set;
failure with no set retries after ten minutes. An empty set means no capture.

Group discovery sends metadata only: group ID/title, up to 50 participant phone
JIDs, and last-known activity. The dashboard proposes matches using participant
phones and the group-title convention:

```text
{Student first name} {Instrument} Lessons {emoji}
```

The dashboard requires a group JID, an instrument token, and activity within six
months; unknown activity is retained for review. Sync may rebucket only automatic
`review`/`unmatched` states. Human `confirmed` and `ignored` decisions persist.
Confirmation requires a real student and stores the group/student/parent/tutor
context that becomes the capture allow-list.

Use `SIGUSR1` to sync on the existing live socket. Use the one-shot
`npm start -- --sync-groups` only while the normal bridge is stopped: two Baileys
sockets sharing one auth directory replace each other (status 440). The launchd
template signals the live bridge on Monday at 06:30.

## Endpoint And Storage

External capture and bridge-control requests use:

```text
POST /api/admin/incoming-messages
x-firstchord-incoming-secret: <INCOMING_MESSAGE_INGEST_SECRET>
```

The dashboard writes:

- `Incoming_Message_Inbox`: captured evidence and human workflow state
- `WhatsApp_Group_Map`: proposed and confirmed group mappings
- `Bridge_Status`: one heartbeat row for the primary bridge

See [State tabs](../../architecture/data/state-tabs.md) for field ownership and
retention. The route must remain secret-authenticated and must re-check the
confirmed group server-side.

## From Evidence To Action

Admins can correct the proposed category/student, archive noise, or convert a
message into an idempotently linked `Planning_Items` action. The returned reply
is editable clipboard text only. Copying logs `Communication_Log`; it does not
prove the reply was sent.

The outbound guard replaces both `sock.sendMessage` and `sock.relayMessage` with
throwing functions. Keep
`tests/admin/whatsapp-bridge-outbound-guard.test.mjs` green. Any future sending
must be a separate, approved official-API workflow.

## Health And Recovery

After connecting, the bridge refreshes confirmed groups and posts a heartbeat,
then repeats the heartbeat about every 30 minutes. Dashboard health warns when:

- heartbeat age is at least two hours
- the confirmed-group count is zero
- no auto-capture has been recorded for at least three days

The watchdog normally exits after more than ten minutes disconnected, or after
roughly 65 minutes without proven health at the default heartbeat. launchd
`KeepAlive` then relaunches it. A logged-out session needs a QR re-link.

Recovery order:

1. Use Quick capture for any urgent missed message.
2. Check bridge logs, dashboard heartbeat, and confirmed-group count.
3. Restart/re-link the single bridge process if needed.
4. Signal a live group sync if mappings are stale.
5. Do not promise backlog recovery: history/append batches are cached locally
   but deliberately are not posted after reconnect.

## Local Cache And Privacy

The JSON cache defaults to 2,000 messages and 14 days. It contains message text
and identity metadata, is gitignored, and currently supports diagnostics and
heartbeat counts—not replay or recovery. Treat it as sensitive and consider its
removal if those diagnostics no longer justify retaining message bodies.

`WRITE_STARRED_LOG` and `starred-payloads.ndjson` are legacy names; when enabled,
the log can contain current test/auto payloads and personal data. Never commit it.

Baileys is unofficial and can break or lead to account restriction. Risk is
bounded by receive-only operation, low-frequency metadata reads, a separate
manual-capture path, and keeping MMS/Sheets—not WhatsApp automation—as truth.

## Code And Checks

- local bridge: `tools/whatsapp-incoming-bridge/`
- dashboard orchestration: `lib/admin/incoming-messages.js`
- deterministic rules: `lib/admin/incoming-message-helpers.mjs`
- Sheets adapter: `lib/admin/sheets/incoming-messages.mjs`
- focused tests: `tests/admin/incoming-*.test.mjs` and
  `tests/admin/whatsapp-bridge-outbound-guard.test.mjs`

There is no end-to-end socket/watchdog contract test. Changes to live event,
heartbeat, refresh, or reconnect handling need a manual bridge smoke check.
