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

So cold-start cost can only be reduced by reading less: batching several tabs
into one `batchGet`, or warming the cache on boot before traffic arrives.
Neither is built. Caching remains the only lever for steady-state load, and
there is no headroom to buy.
