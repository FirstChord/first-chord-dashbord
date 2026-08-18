/** @fileoverview Single home for the stale-while-revalidate read-cache policy shared by the Sheets and MMS attendance caches. */
// One home for the read-cache policy that was duplicated between the Sheets
// read cache (lib/admin/sheets/core.mjs) and the MMS payroll attendance cache
// (lib/admin/mms.js): a TTL window where hits serve instantly, then a bounded
// stale-while-revalidate window where the cached value is served immediately
// and refreshed behind the request (a failed background refresh logs, never
// rejects into the caller), then a hard max age past which callers wait for a
// fresh fetch. Concurrent callers coalesce onto one in-flight fetch.
//
// Options:
//   ttlMs / staleWhileRevalidateMs — the two windows; hard max is their sum.
//   clone   — applied on every read and write so callers can't mutate the
//             cache (Sheets passes a deep clone; default is identity).
//   scopeOf — maps a cache key to an invalidation scope (Sheets: the tab name
//             parsed from the range). invalidateScope(scope) then drops that
//             scope's entries AND version-guards in-flight fetches so a fetch
//             started before the invalidation can't repopulate the cache with
//             pre-write data.
//   label   — names the cache in background-refresh warnings.
//
// read(key, fetcher, opts):
//   force        — ignore the cache and await a fresh fetch.
//   allowExpired — serve a past-hard-max value anyway (refreshing behind the
//                  request) rather than making the caller wait. For renders on
//                  a human's critical path where something slightly old beats a
//                  spinner; the caller owns saying so in the UI.
//   staleOnError — keep a past-hard-max value as a *fallback*: still fetch, but
//                  if the fetch fails, serve the expired copy instead of
//                  throwing. Unlike allowExpired this never serves stale while
//                  the source is healthy. For reads where a provider blip
//                  (quota, 5xx) would otherwise crash a render.
export function createSwrCache({
  ttlMs,
  staleWhileRevalidateMs = 0,
  clone = (value) => value,
  scopeOf = () => '',
  label = 'cache',
} = {}) {
  const hardMaxAgeMs = ttlMs + staleWhileRevalidateMs;
  const store = new Map();
  const inflight = new Map();
  const versions = new Map();

  // Past the hard max an entry is dropped and the caller has to fetch.
  // `keepExpired` opts out of that for callers who would rather show something
  // old than make a human wait on a slow API — see read()'s `allowExpired`.
  function peek(key, { keepExpired = false } = {}) {
    const entry = store.get(key);
    if (!entry) return null;
    const age = Date.now() - entry.cachedAt;
    const isExpired = age > hardMaxAgeMs;
    if (isExpired && !keepExpired) {
      store.delete(key);
      return null;
    }
    return { value: clone(entry.value), isFresh: age <= ttlMs, age, isExpired };
  }

  // Age metadata only — no clone, no eviction. For callers that want to tell a
  // human how old the data in front of them is without paying to copy it.
  function stat(key) {
    const entry = store.get(key);
    if (!entry) return null;
    const age = Date.now() - entry.cachedAt;
    return { age, isFresh: age <= ttlMs, isExpired: age > hardMaxAgeMs };
  }

  function set(key, value) {
    store.set(key, { cachedAt: Date.now(), value: clone(value) });
  }

  function remove(key) {
    store.delete(key);
  }

  function refresh(key, fetcher) {
    const existing = inflight.get(key);
    if (existing) return existing;

    const scope = scopeOf(key);
    const version = scope ? versions.get(scope) || 0 : null;
    const request = Promise.resolve()
      .then(fetcher)
      .then((value) => {
        if (version === null || (versions.get(scope) || 0) === version) {
          set(key, value);
        }
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, request);
    return request;
  }

  async function read(key, fetcher, { force = false, allowExpired = false, staleOnError = false } = {}) {
    if (force) {
      // A forced read means "the truth after my write". Serving a stale value
      // there would be worse than failing, so staleOnError deliberately does
      // not apply to this branch.
      store.delete(key);
      // An explicit refresh means "fetch after the latest write". Do not
      // coalesce it onto a request that may have started before that write.
      // Let the old request finish, discard its cached value, then start a new
      // fetch with the caller's current fetcher.
      const active = inflight.get(key);
      if (active) {
        try {
          await active;
        } catch {
          // The forced fetch below is the result the caller cares about.
        }
        store.delete(key);
      }
      return clone(await refresh(key, fetcher));
    }

    // Hold on to a past-hard-max entry when it could still be useful: either the
    // caller will serve it outright (allowExpired) or it is the fallback if the
    // fetch fails (staleOnError).
    const cached = peek(key, { keepExpired: allowExpired || staleOnError });
    if (cached?.isFresh) {
      return cached.value;
    }

    // Inside the stale-while-revalidate window, or past it with allowExpired:
    // serve what we have and refresh behind the request.
    if (cached && (allowExpired || !cached.isExpired)) {
      if (!inflight.has(key)) {
        refresh(key, fetcher).catch((error) => {
          console.warn(`${label} background refresh failed for ${key}:`, error?.message || error);
        });
      }
      return cached.value;
    }

    // Nothing servable without waiting. If the fetch fails and we are still
    // holding an expired copy, bounded-stale data beats a failed render.
    try {
      return clone(await refresh(key, fetcher));
    } catch (error) {
      if (staleOnError && cached) {
        console.warn(
          `${label} served an expired value for ${key} after a failed fetch (age ${cached.age}ms):`,
          error?.message || error,
        );
        return cached.value;
      }
      throw error;
    }
  }

  function invalidateScope(scope) {
    const target = `${scope || ''}`.trim();
    if (!target) return;

    versions.set(target, (versions.get(target) || 0) + 1);
    for (const key of store.keys()) {
      if (scopeOf(key) === target) store.delete(key);
    }
    // Dropped (not awaited) so the next read starts a fresh post-write fetch
    // instead of adopting a fetch that may predate the write.
    for (const key of inflight.keys()) {
      if (scopeOf(key) === target) inflight.delete(key);
    }
  }

  // Apply a known local edit to a scope's cached values instead of dropping
  // them. For a caller that has just written through to the source and knows
  // exactly what changed: invalidating is correct but expensive, because the
  // very next render then blocks on a full refetch of data we could already
  // describe. Patched entries are deliberately aged to *stale*, not fresh — the
  // next read serves them immediately and still refreshes from source behind the
  // request, so the patch is a head start on the truth, never a substitute for
  // it. Like invalidateScope, it version-guards in-flight fetches so a request
  // that predates the write cannot land on top of the patch.
  //
  // `updater(value, key)` returns the new value, or undefined to leave an entry
  // alone. Returns how many entries were patched, so a caller that matched
  // nothing can fall back to invalidating.
  function patchScopeStale(scope, updater) {
    const target = `${scope || ''}`.trim();
    if (!target || typeof updater !== 'function') return 0;

    let patched = 0;
    for (const [key, entry] of [...store.entries()]) {
      if (scopeOf(key) !== target) continue;
      const next = updater(clone(entry.value), key);
      if (next === undefined) continue;
      // One millisecond past the TTL: inside the stale-while-revalidate window,
      // so this reads as "serve now, refresh behind" rather than as fresh truth.
      store.set(key, { cachedAt: Date.now() - (ttlMs + 1), value: clone(next) });
      patched += 1;
    }

    if (patched) {
      versions.set(target, (versions.get(target) || 0) + 1);
      for (const key of [...inflight.keys()]) {
        if (scopeOf(key) === target) inflight.delete(key);
      }
    }
    return patched;
  }

  function clear() {
    store.clear();
    inflight.clear();
    versions.clear();
  }

  return { read, peek, stat, set, delete: remove, invalidateScope, patchScopeStale, clear };
}
