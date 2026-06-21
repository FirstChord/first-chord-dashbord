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

- The Sheets read cache (`SHEETS_READ_TTL_MS` in `lib/admin/sheets.js`) is 60s. Dashboard writes call `invalidateSheetReadCache` for the affected tab, so the admin's own edits appear immediately; only passive cross-source drift can lag up to the TTL.

## Server component

A page rendered on the server (fetching its data there) before sending HTML to the browser. Most admin pages are server components — hence the data wait on navigation and the value of the loading skeleton.

## Prefetch

The browser loading a linked route before the user clicks (on hover/in-viewport), making the click feel instant. Next.js `<Link>` prefetches in production builds (not local dev), which is one reason the live dashboard feels snappier than `npm run dev`.
