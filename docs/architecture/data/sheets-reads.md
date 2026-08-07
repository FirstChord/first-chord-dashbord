---
status: canonical
audience: [human, agent]
last_verified: 2026-08-06
---
# Google Sheets read discipline

This document answers one question: how may code read from Google Sheets?
Where state should live is [Sheets and database boundary](./storage-boundary.md);
the per-lane schema is [State tabs](./state-tabs.md).

## The budget

Google allows **60 read requests per minute per user**. Every dashboard request
authenticates as the same service account, so that single number is the ceiling
for the entire app — all pages, all API routes, all crons, all instances,
together. It is not a per-page or per-module allowance.

Exceeding it returns HTTP 429. Because `/admin` is `force-dynamic`, the failure
does not land on whoever caused it: it lands on whichever page happens to render
next. This is why the symptom is always "random pages occasionally break" rather
than "the heavy page breaks".

## The rules

1. **Read through the cache.** All reads go through `getSheetValues` or
   `getSheetObjects` in `lib/admin/sheets/core.mjs`. Calling
   `sheets.spreadsheets.values.get` anywhere else skips the shared cache and
   spends quota on every single call.
2. **`force: true` is for writes only.** It exists for the read-modify-write step
   inside a write function, where acting on a stale copy would corrupt data. On a
   render or route path it means a guaranteed API request per visit.
3. **Reads tolerate stale; writes do not.** Ordinary reads set `staleOnError`, so
   a quota blip serves bounded-stale data instead of failing the page. Forced
   reads deliberately do not — a write must fail rather than act on old data.
4. **Count tabs before adding a loader.** A new loader reading N tabs on a
   `force-dynamic` page costs N requests on every visit, multiplied by every
   other loader on that page.
5. **Retry does not fix a quota error.** A per-minute window does not clear in a
   few seconds, and each retry spends more of the quota that is already gone.
   `withSheetsRetry` gives 429 a deliberately short ladder; the stale cache is
   what actually keeps the page up.

## Per-module tiers

| Module kind | Read style | Stale acceptable? |
|---|---|---|
| Server component / page loader | `getSheetValues` / `getSheetObjects` | Yes — bounded stale beats a failed render |
| API read route | `getSheetValues` / `getSheetObjects` | Yes |
| Write path (read-modify-write) | `getSheetValues(range, { force: true })` | **No** — must fail rather than act on stale |
| Cron / script | `force: true` is fine | N/A — off the human critical path |
| Shared context loader | Cached reads, and assume several callers per render | Yes |

The riskiest position on this table is a *shared context loader*, because its
cost is multiplied by every consumer. `lib/admin/student-context.js` reads five
tabs and is called from `students.js`, `issues.js` (twice) and
`pause-expectation-workflow.js` — so a single uncached tab there is four wasted
requests per dashboard render.

## Watching the budget

`lib/admin/sheets/core.mjs` counts real API reads (cache misses and retries —
both spend quota) in a rolling minute and logs a warning at 75% of the ceiling:

```
Sheets read budget: 45/60 reads in the last minute (most recent: Students).
Cache or batch a caller before this becomes a 429.
```

That warning is the early signal. If it appears in normal use, a caller needs
caching or batching — do not raise the threshold to silence it.
`getSheetsReadBudget()` exposes the same numbers programmatically.

## Enforcement

`npm run hygiene:check` warns (non-blocking, like everything there) when a change
adds a direct `spreadsheets.get`/`values.get` outside `core.mjs`, or a
`force: true` read on an `app/` or top-level `lib/admin/` path.

## Known limitation

The read cache is in-process. Each Railway instance warms its own, so a restart
or a scale-out starts cold and briefly reads at full cost.

**Raising the quota is not available as a lever.** The Google Cloud console
exposes `Read requests per minute per user` as editable, but its permitted range
is 0–60 — 60 *is* the maximum, not a default someone chose. The only direction
that field moves is down. (The separate per-project limit of 300/minute is not
the one being hit: one service account means the app is a single user.)

So cold-start cost can only be reduced by reading less. **Batching is now
built** (2026-08-07); boot-time cache warming still is not.

## Batched prefetch

`prefetchSheetValues(ranges)` fetches several tabs in one `batchGet` and leaves
them in the same cache `getSheetValues` reads from. It is a **cache-warmer, not
a new read API**: call it once at the top of anything touching several tabs, and
every reader underneath finds its data already there and issues no request. The
batching decision therefore lives at the call site, where all the tabs are
visible at once, rather than being threaded through each adapter.

Ranges already fresh are skipped, a single range is left to the normal path, and
a failed batch is not fatal — the readers behind it fetch as they always did.

Measured on the song-history route (three tabs), against the live sheet:

| | Requests before | after |
|---|---|---|
| Cold instance | 9 | 5 |
| Steady state (values cache expired, headers warm) | 3 | 1 |

The remaining cold-start cost is one header read per managed tab
(`ensureManagedSheet` reads `'Tab'!1:1` through its own cache, not this one), and
those amortise to zero for the life of the instance. Batching those too would
mean routing header reads through `getSheetValues`, which is load-bearing for
writes — not worth the risk for a one-off cost.

`getSpreadsheetMetadata` now shares its in-flight request. Four managed tabs
touched in parallel used to miss the completed-result cache four times and spend
four requests on one answer, on every cold start.

Current call sites: `loadStudentContextCollection` (the busiest path in the app),
`/api/song-history`, and `/admin/insights`.
