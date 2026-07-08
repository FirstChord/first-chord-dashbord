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

  function peek(key) {
    const entry = store.get(key);
    if (!entry) return null;
    const age = Date.now() - entry.cachedAt;
    if (age > hardMaxAgeMs) {
      store.delete(key);
      return null;
    }
    return { value: clone(entry.value), isFresh: age <= ttlMs, age };
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

  async function read(key, fetcher, { force = false } = {}) {
    if (force) {
      store.delete(key);
      return clone(await refresh(key, fetcher));
    }

    const cached = peek(key);
    if (cached?.isFresh) {
      return cached.value;
    }

    if (cached) {
      if (!inflight.has(key)) {
        refresh(key, fetcher).catch((error) => {
          console.warn(`${label} background refresh failed for ${key}:`, error?.message || error);
        });
      }
      return cached.value;
    }

    return clone(await refresh(key, fetcher));
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

  function clear() {
    store.clear();
    inflight.clear();
    versions.clear();
  }

  return { read, peek, set, delete: remove, invalidateScope, clear };
}
