# WhatsApp Incoming Bridge

Last updated: 2026-07-06

## Purpose

Capture selected inbound WhatsApp messages into the dashboard so Finn/Tom can review them and turn them into planning/workflow action when appropriate.

This is for messages such as:

- parent says a student will miss a lesson
- parent asks for a pause/holiday period
- parent raises a payment or schedule question
- tutor/parent message should not disappear in WhatsApp memory

## Capture Modes

Two capture paths, one boundary:

1. **Auto-capture (primary since 2026-07-06):** every live text message in a **dashboard-confirmed FC lesson group** posts to the dashboard automatically — no starring. The bridge asks the dashboard which chats qualify (`GET ?mode=confirmed_groups`, secret-authenticated, refreshed on connect + every 6h) and the dashboard re-checks the confirmed group map server-side, so the human-confirmed map is the single gate. Messages from the school side (our own account via `from_me`, or staff personal numbers listed in the dashboard env `INCOMING_STAFF_PHONES` — Tom is in every group under his own number) never become inbox rows; they stamp open items from that chat as **"Replied in WhatsApp"** evidence. Parent messages with no operational signal (category `general`, no dates) land pre-archived (`ignored`, reason noted) so the inbox only shows work. Direct (non-group) chats are deliberately not auto-captured.
2. **Starring** still works for anything else: DMs, unconfirmed groups, or emphasis. The bridge shares its dedupe set across both paths and the dashboard's capture ids are source-inclusive but replay-safe, so starring an already-captured message never duplicates it.

Env for auto-capture: `AUTO_CAPTURE_CONFIRMED_GROUPS` (default on; set `false` to fall back to starred-only) and `CONFIRMED_GROUPS_REFRESH_MS` on the bridge; `INCOMING_STAFF_PHONES` (comma list, any UK format) on the dashboard.

Because capture is now automatic, **silence is a failure signal**. The bridge posts a heartbeat (`mode: bridge_status` → single-row `Bridge_Status` tab) on connect and every ~30 min (`BRIDGE_HEARTBEAT_MS`), carrying connected-since, confirmed-group count, cache size, and version. `assessBridgeHealth` warns when the heartbeat is more than 2h old (**down/unlinked**), the confirmed-group list is empty (**alive but capturing nothing** — the 2026-07-06 rollout failure), or no auto-capture has landed for 3+ days (**suspiciously quiet**). Healthy state shows as a one-line strip on the inbox page; problems become an amber "WhatsApp bridge" card on `/admin`. Heartbeats are fail-silent on the bridge side — a Sheets/network hiccup never affects capture.

For auditing the noise policy, the inbox has an **"Auto-archived (N)"** filter showing only rows the rules archived (auto-captured, `ignored`, no `reviewed_by`) — skim it weekly during the trust-building period; any mistake found is an eval-fixture addition.

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

The local Baileys prototype should cache incoming message bodies from `messages.upsert`. A later `messages.update` star event often contains only the message key, not the message text. If the cache misses, the dashboard still receives a placeholder row.

**Capture semantics (dashboard side).** A star event only works fully for messages the bridge saw arrive live — star messages **promptly**; anything older than the bridge cache arrives textless. The dashboard makes those failures reviewable instead of junk:

- Bridge captures are identified by `source + chat_id + external_message_id` only, so WhatsApp's star replays (it re-announces star state on reconnect/restart) upsert the same inbox row instead of duplicating it (`buildIncomingMessageId`).
- A replay that adds nothing is skipped; a replay that *recovers* real text for a stored placeholder row heals it — fresh classification and student match, but human decisions (archive status, review note, planning link) are preserved (`mergeIncomingCapture`).
- Placeholder captures land as `needs_review`, and the inbox card shows a paste box: paste the original message from WhatsApp and it is re-classified, re-matched, and reopened (`mode: update_text`).

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

- `Convert to plan + draft reply`: saves the reviewed category/student/group-map training, creates a linked `Planning_Items` action, archives the message (`converted`), and returns a suggested WhatsApp reply. See "From message to action" below. When both guesses are measured-strong (`isOneTapConvertEligible`: high-confidence student match + a specific category, not `general`/`absence_pause`), the same button also appears directly on the card — one tap, no correction panel. The classifier eval harness (`npm run eval:incoming`; accuracy floors pinned in `incoming-classifier-eval.test.mjs`) now uses independent synthetic cases. It is a regression guard, not proof of production accuracy; human corrections and harmful archive mistakes should form a separately governed holdout before automation widens.
- `Save correction`: saves the reviewed category/student/group-map training and keeps the message open for action.
- `Save + archive`: saves the correction and archives the message because the relevant action has been handled or logged elsewhere.
- `Archive handled`: archives a message without changing the correction fields.
- `Ignore`: close noise/no-action messages without converting them.
- `Delete test`: hard-delete test/noise rows only.

Archived/ignored rows are hidden by default so the inbox stays focused on messages still needing a decision.

## From Message to Action

Once a message is read correctly, `Convert to plan + draft reply` closes the loop:

1. Applies any category/student/group-map correction from the panel.
2. Extracts dates/durations from the message text (`extractDatesFromMessage`, resolved against the message timestamp; the card previews the same guess as "Dates spotted"). When an absence-category message has usable dates **and** a matched student, the plan is built with `buildStructuredPausePlanningDraft` — the same pause note format the pause forecast and finance outlook parse — so the message joins the pause loop with no re-typing. Otherwise it stays a generic action (category maps to a planning `area`: absence/schedule → `workflow`, payment/leaving → `finance`, concern/general → `parent`) with any spotted dates noted.
3. Creates the `Planning_Items` action (via `savePlanningItem`) linked to the matched student. The planning id is derived from the incoming id (`planning_<incomingId>`), so re-converting the same message upserts the same task instead of duplicating. The original message, sender, and the suggested reply travel in the item notes.
4. Writes `created_planning_id` back onto the inbox row and marks it `converted`.
5. Returns a suggested WhatsApp reply — with the extracted dates confirmed back to the parent when they were read — shown in an editable box with a Copy button.

The reply is a **copy-paste draft only** — consistent with the transport-only boundary above, nothing is sent to WhatsApp automatically. The human edits it and sends it themselves. Reply wording is per-category and lives in `buildIncomingReplyTemplate` (`lib/admin/incoming-message-helpers.mjs`); the planning mapping lives in `buildIncomingPlanningDraft`.

## Scheduled Weekly Re-sync

To keep the group map fresh without manual effort, a launchd agent signals the running bridge to re-sync weekly (`SIGUSR1` on the live socket — no restart, no 440). New students' groups appear; departed students drop out (roster bucketing → `unmatched`).

Template lives in the repo at `tools/whatsapp-incoming-bridge/launchd/com.firstchord.whatsapp-group-sync.plist`. Install (machine-local, not committed to `~/Library/LaunchAgents`):

```bash
cp tools/whatsapp-incoming-bridge/launchd/com.firstchord.whatsapp-group-sync.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.firstchord.whatsapp-group-sync.plist
launchctl print gui/$(id -u)/com.firstchord.whatsapp-group-sync | grep -iE 'state|Weekday|Hour'
```

Runs Monday 06:30 (`StartCalendarInterval`); if the Mac is asleep, launchd runs it on next wake. `state = not running` between runs is normal (it's idle until scheduled). The bridge must be running for the signal to do anything (it's a `KeepAlive` launchd agent, so it normally is).

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

## Ban-Risk Posture

Baileys is an **unofficial** WhatsApp client, so using it is against WhatsApp's ToS by definition. The goal is not "never get flagged" — it's to keep risk low *and* make a ban not matter. What actually drives enforcement, and where we sit:

- **Sending is the dominant ban signal** (spam volume, messaging non-contacts, bulk identical messages, recipient reports). The bridge **never sends** — this is the biggest lever and we're at the floor. It's now *structurally enforced*: `outbound-guard.js` neutralises `sock.sendMessage`/`relayMessage` right after socket creation, so any code path (or dependency behaviour) that tries to message a parent throws instead. A test (`tests/admin/whatsapp-bridge-outbound-guard.test.mjs`) keeps it from regressing.
- **Passive footprint is minimal:** `markOnlineOnConnect: false`; the only active WhatsApp reads are group-metadata fetches (weekly re-sync + on start), which are infrequent by design. No presence broadcasts, no read-receipt calls.
- **Narrowing capture to confirmed FC groups is for privacy/blast-radius, not ban-avoidance.** That filtering happens client-side after delivery, so it's invisible to WhatsApp — worth doing to minimise parent data leaving WhatsApp, but it does not lower detection risk.
- **Blast-radius is the real mitigation, and it's a decision not code:** (1) the bridge must link the **business** number (it's the one in the parent groups); (2) keep personal identity on a *separate* number so a ban/unlink doesn't take out personal comms — **open action for Finn** (currently the business number doubles as personal); (3) the fallback stays real — manual paste-to-classify works from any device and **MMS + Sheets are source of truth**, so losing the bridge loses automation, not data.

Future sending (reminders, approved replies) must go through the **official WhatsApp API** as a separate approve-before-send path — never this bridge.

## Risks

- Starred update may arrive after the original message has fallen out of cache.
- WhatsApp/Baileys is unofficial and can break — see Ban-Risk Posture above for how that risk is bounded.
- Logs contain personal data; do not commit or upload them publicly.
- Phone/name matching can be wrong. Keep review manual.
