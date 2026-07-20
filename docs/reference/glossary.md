---
status: supporting
audience: [human, agent]
last_verified: null
---
# Glossary

Plain-English explanations of technical terms used in the admin dashboard. This is a general reference (not a dated change log) — add to it whenever new jargon appears. A mirror lives in the Obsidian "First Chord OS" vault (`09 Glossary`).

- **Path template** — a named ordered list of catalogue song IDs (`lib/config/path-templates.mjs`, canonical hand-edited). "Assign path" instantiates it into per-student `Song_Assignments` rows; the student copy is personal from then on.

## Proposals inbox

The "machine prepares, human commits" pattern made concrete: a machine-produced suggestion (a **proposal**) sits in the generic `Proposals` tab until a human uses, edits or discards it — the machine never acts. A **lane** is one kind of proposal; V1's only lane is `incoming_reply` (suggested WhatsApp replies on open incoming messages). Proposals expire after 7 days and are **superseded** if the message under them changes or a fresh draft is made. Telemetry is derived, not stored: an approved proposal whose applied text matches the proposed text was *used unmodified* — the gate metric for adding a second lane.

## Notice window

Which band of the Lesson Cancellation Policy a one-off absence falls in, computed from the lesson date (from the message's own dates, else `Schedule_Context`) minus the message date: `seven_plus` (cancelled, not charged), `inside_week` (charged; Zoom-at-slot or practice video), `same_day` (charged; no video). If the window can't be computed, the ambiguity rule applies: a neutral acknowledgement that commits to nothing.

## Cover bank

The pool of tutors who have said (in a phone survey run by Fenella) whether they're happy to cover other tutors' shifts (yes/no — every cover is arranged by asking, so "maybe" carries nothing), on which days, and whether a same-day ask is OK or they need notice. Answers live in the `Cover_Bank_State` tab; the `/admin/workflows/cover-bank` page cross-references them live against teaching days from `Schedule_Context`, flagging (not hiding) tutors who already teach that day. External tutors — people not currently teaching at the school — can be added to the bank and exist only as `ext:<slug>` rows in that tab.

## Loading skeleton

A placeholder layout shown instantly while a page's real data is still loading — grey pulsing shapes where the real content will appear, instead of a blank or frozen screen.

- Admin pages fetch data (Sheets/MMS) on the server before they can render. Without a skeleton, navigation left the previous page frozen until data arrived. The skeleton gives immediate feedback so the app feels responsive.
- It is a **perceived-performance** technique — it does not make data load faster (caching does that).
- Implemented as `app/admin/loading.js`, a single Suspense fallback Next.js shows across the whole `/admin` subtree during navigation. The layout (nav/header) stays; only `<main>` swaps to the skeleton. A specific route can override with its own `loading.js`.

## Perceived performance

How fast something *feels* vs how fast it technically is. Skeletons improve perceived performance; caches improve actual performance.

## Cache / TTL

A cache keeps a temporary copy of data to avoid re-fetching. TTL ("time to live") is how long the copy is trusted before refetching.

- The Sheets read cache (`SHEETS_READ_TTL_MS` in `lib/admin/sheets/core.mjs`) is fresh for 60s, then uses bounded stale-while-revalidate for a short window. Recent stale rows can render instantly while the server refreshes the cache in the background; very old rows block for a fresh Google Sheets read. Dashboard writes call `invalidateSheetReadCache` for the affected tab, so the admin's own edits appear immediately. External writers are bounded by the hard max age.

## Stale-While-Revalidate

A cache pattern where the app serves a recently-stale value immediately, then refreshes it in the background for the next request.

- First Chord uses this only with a hard cap. It is meant for admin speed, not for replacing source-of-truth checks.
- If a workflow must know live MMS, Stripe, or a just-edited Sheet value, use an explicit refresh or direct source read.

## Server component

A page rendered on the server (fetching its data there) before sending HTML to the browser. Most admin pages are server components — hence the data wait on navigation and the value of the loading skeleton.

## Prefetch

The browser loading a linked route before the user clicks (on hover/in-viewport), making the click feel instant. Next.js `<Link>` prefetches in production builds (not local dev), which is one reason the live dashboard feels snappier than `npm run dev`.

## Actuals (finance)

Real billing amounts read from Stripe subscriptions, as opposed to the price-table estimate. Cached weekly in `Stripe_Amounts_Cache`; a student priced from actuals shows `source: stripe_actual` in the finance figures.

## Calibration (finance)

Comparing what Stripe actually collected in a month (`Stripe_Collected_Monthly`) against what the estimate said Stripe-managed students should bill. A growing gap means the model is drifting from reality — the "Estimate vs reality" panel on `/admin/finance`.

## Capture replay identity (incoming inbox)

An inbound row is identified by `source + chat_id + external_message_id`. A
repeated bridge post is therefore a no-op. Placeholder healing remains only as
legacy compatibility; the active confirmed-group bridge does not create or
recover starred-message placeholders.

## Eval fixture (incoming classifier)

The privacy-reviewed set of independent synthetic message cases (`tests/admin/fixtures/incoming-eval-set.json`) that `classifyIncomingMessage` is measured against. `npm run eval:incoming` prints classification, date and harmful-auto-archive results; the test suite pins minimum floors so rule changes cannot silently regress. It is a development regression set, not a production holdout. Any later holdout built from reviewed outcomes must be de-identified, access-controlled and kept out of git.

## Auto-capture (incoming inbox)

The bridge posts live text/caption notifications from dashboard-confirmed FC
lesson groups (`source: whatsapp_group_auto`). Starring is not a capture path.
School-side messages stamp open items as reply evidence instead of creating
rows; no-signal parent messages land pre-archived.

## Sheet census (data governance)

A per-tab row-count reading taken during `npm run backup:sheets`
(`lib/admin/sheet-census.mjs` → `census.json` beside the manifest). It reports
row totals/deltas and ranks watched event-heavy tabs. Its purpose is to make any
future store migration evidence-led. See
[storage boundaries](../architecture/data/storage-boundary.md).

## Group-only student (tutor dashboard)

A student whose registry `instrument` is a group ensemble (currently `Ukulele Orchestra`). `excludeGroupOnlyStudents()` (`lib/tutor-dashboard-helpers.mjs`) keeps them out of the tutor dashboard's individual student list — they're taught as a group, so their group lesson still appears on the schedule timeline (display-only) but they have no individual card.

## Song object / song catalogue (student paths)

A song as a reusable structured object in `lib/config/songs-catalogue.mjs` — title, artist, instruments, level, contentType, tags, tutor/student notes, and a nested `soundslice.scorehash` as the only Soundslice reference. The catalogue is **canonical and hand-curated** (not generated; edit it directly, unlike the five registry-derived config files). It ships in the client bundle, so it must never contain student names — a test enforces this. Soundslice URLs are derived exclusively in `lib/songs/catalogue-helpers.mjs`. See [student paths](../architecture/system/student-paths.md).

## Scorehash (Soundslice)

Soundslice's stable ID for one slice (one piece of playable notation), e.g. `Yvmfc` → `soundslice.com/slices/Yvmfc/`. The catalogue references slices only by scorehash; a slice is student-viewable only when its secret URL is enabled (`status=3`), which `enable_secret_links.py` (Soundslice toolshed) sets, verifies, and logs at curation time.

## Rockschool Original (and the two meanings of `artist: 'RSL'`)

A piece **written for** the RSL/Rockschool syllabus rather than covered from a commercial recording (e.g. bass *Noisy Neighbour*, electric *Cashville*). It has no other artist, so `artist: 'RSL'` is its **true artist**.

This collides with the catalogue's other use of the same string: `artist: 'RSL'` is *also* the **needs-curation marker**, meaning "we could not find a trustworthy artist and refused to guess". **One string, two meanings** — you cannot tell them apart by looking, so `songs-catalogue.mjs` names the verified originals in comments. The settling source is the official RSL Awards syllabus page for the grade (`rslawards.com/products/…`), which **groups cover tracks separately from Rockschool Originals**. Piano's markers predate this distinction and are unverified — see `docs/reference/song-catalogue-coverage.md`.

## Song series

A body of repertoire with its own progression vocabulary (`SONG_SERIES` in `songs-catalogue.mjs`). RSL runs in **grades** (Debut→Grade 6); John Thompson's piano course runs in **books** (Book 1→Book 2). Each becomes a tab in the tutor Song panel. **Levels are only comparable inside a series** — Book 2 is not "above" Grade 6 — which validation and level-inference both enforce. `series` defaults to `rsl`, so adding one costs nothing to existing entries. A new exam board (Trinity) or method book would be a new series.

## INSTRUMENTS_WITHOUT_REPERTOIRE

The explicit, reviewed list (in `tests/admin/songs-catalogue.test.mjs`) of instruments a student may hold that deliberately have **no songs** — currently Voice, Singing, Ukulele Orchestra. Every entry is a person opening the Song panel to an empty shelf, so the list must be a conscious decision. A test fails if a student holds an instrument that is neither seeded in `SONG_INSTRUMENTS` nor named here. It exists because the empty-shelf bug shipped three times in one day (bass, the 38 blank-instrument students, then electric guitar) with nothing anywhere saying so.

## Song outcome

The tutor's optional one-tap answer ("How was it for them?" — *cruised it / about right / a battle*, plus an optional note) when a song assignment reaches `done` or gets parked, appended to the `Song_Outcomes` tab. Opinions with a timestamp, never workflow state — `Song_Assignments.status` stays the only current truth. Sibling tab `Song_Status_Log` records every status transition automatically ("free data before asked data"). Both exist to be distilled later into catalogue `tutorNote`s and path ordering, not to be dashboarded.

## Song request

A tutor's one-tap "Request "X"" on a Song Browser search miss, appended as a `status='new'` row to the `Song_Requests` tab. The catalogue's intake queue — resolved during curation by the `add-song` skill (or a sheet edit), deliberately not via any admin page.
