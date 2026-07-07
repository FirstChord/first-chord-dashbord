# Glossary

Plain-English explanations of technical terms used in the admin dashboard. This is a general reference (not a dated change log) — add to it whenever new jargon appears. A mirror lives in the Obsidian "First Chord OS" vault (`09 Glossary`).

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

## Placeholder healing (incoming inbox)

A starred WhatsApp message captured without its text (older than the bridge cache) lands as a `needs_review` placeholder row. "Healing" replaces the placeholder with the real text — via a later bridge replay that recovered it, or the paste box on the inbox card — re-running classification/matching while keeping every human review decision.

## Eval fixture (incoming classifier)

The hand-labelled set of real anonymised parent messages (`tests/admin/fixtures/incoming-eval-set.json`) that `classifyIncomingMessage` is measured against. `npm run eval:incoming` prints accuracy + misses; the test suite pins minimum floors so rule changes can't silently regress on real traffic. Labels are the operationally correct category, not the old prototype's labels.

## Auto-capture (incoming inbox)

The bridge posts every live text message from a dashboard-confirmed FC lesson group automatically (`source: whatsapp_group_auto`) — starring is no longer required for capture. Confirming/ignoring a group in the inbox UI is also its capture switch. School-side messages (own account or `INCOMING_STAFF_PHONES`) stamp open items as "Replied in WhatsApp" instead of creating rows; no-signal messages land pre-archived.

## Sheet census (data governance)

A per-tab row-count reading taken during the fortnightly `npm run backup:sheets` run (`lib/admin/sheet-census.mjs` → `census.json` beside the manifest). It reports total rows, deltas since the last backup, and ranks the *watched* event-heavy tabs (`Incoming_Message_Inbox`, `Event_Log`, `Issue_Queue`, `Practice_Notes_Log`, `Payroll_Runs`, `WhatsApp_Group_Map`) by growth. Its purpose is to make the eventual Sheets→database migration an evidence-triggered decision: sustained growth on a watched tab is the signal to move that lane off Sheets. See `SHEETS_VS_DB_AUDIT.md`.
