import test from 'node:test';
import assert from 'node:assert/strict';

import { createSwrCache } from '../../lib/admin/swr-cache.mjs';

// Holds the mocked clock across the whole async operation (cache writes land
// on a microtask after the fetcher resolves, so a sync mock would miss them).
async function withMockedNow(now, fn) {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    return await fn();
  } finally {
    Date.now = originalNow;
  }
}

function makeCache(overrides = {}) {
  return createSwrCache({ ttlMs: 60_000, staleWhileRevalidateMs: 300_000, ...overrides });
}

test('swr cache: fresh hit serves without fetching', async () => {
  const cache = makeCache();
  let fetches = 0;
  const fetcher = async () => { fetches += 1; return ['fetched']; };

  await withMockedNow(1_000, () => cache.read('k', fetcher));
  const value = await withMockedNow(30_000, () => cache.read('k', fetcher));

  assert.deepEqual(value, ['fetched']);
  assert.equal(fetches, 1);
});

test('swr cache: stale value serves immediately and refreshes in the background', async () => {
  const cache = makeCache();
  let fetches = 0;
  const fetcher = async () => { fetches += 1; return [`fetch-${fetches}`]; };

  await withMockedNow(1_000, () => cache.read('k', fetcher));
  await withMockedNow(120_000, async () => {
    const stale = await cache.read('k', fetcher);
    assert.deepEqual(stale, ['fetch-1']);
    // Let the background refresh land, then the cache holds the new value.
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fetches, 2);
    assert.deepEqual(cache.peek('k').value, ['fetch-2']);
  });
});

test('swr cache: a failed background refresh never rejects into the caller', async () => {
  const cache = makeCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls > 1) throw new Error('boom');
    return ['ok'];
  };

  await withMockedNow(1_000, () => cache.read('k', fetcher));
  const stale = await withMockedNow(120_000, () => cache.read('k', fetcher));
  assert.deepEqual(stale, ['ok']);
  await new Promise((resolve) => setImmediate(resolve));
});

test('swr cache: past the hard max age the caller waits for a fresh fetch', async () => {
  const cache = makeCache();
  let fetches = 0;
  const fetcher = async () => { fetches += 1; return [`fetch-${fetches}`]; };

  await withMockedNow(1_000, () => cache.read('k', fetcher));
  const value = await withMockedNow(500_000, () => cache.read('k', fetcher));

  assert.deepEqual(value, ['fetch-2']);
  assert.equal(fetches, 2);
});

test('swr cache: concurrent misses coalesce onto one fetch', async () => {
  const cache = makeCache();
  let fetches = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const fetcher = async () => { fetches += 1; await gate; return ['rows']; };

  const first = cache.read('k', fetcher);
  const second = cache.read('k', fetcher);
  release();
  assert.deepEqual(await first, ['rows']);
  assert.deepEqual(await second, ['rows']);
  assert.equal(fetches, 1);
});

test('swr cache: force bypasses a fresh cache and awaits the fetch', async () => {
  const cache = makeCache();
  let fetches = 0;
  const fetcher = async () => { fetches += 1; return [`fetch-${fetches}`]; };

  await withMockedNow(1_000, () => cache.read('k', fetcher));
  const value = await withMockedNow(2_000, () => cache.read('k', fetcher, { force: true }));

  assert.deepEqual(value, ['fetch-2']);
  assert.equal(fetches, 2);
});

test('swr cache: force never adopts an older in-flight request', async () => {
  const cache = makeCache();
  let fetches = 0;
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const fetcher = async () => {
    fetches += 1;
    if (fetches === 1) await firstGate;
    return [`fetch-${fetches}`];
  };

  const first = cache.read('k', fetcher);
  const forced = cache.read('k', fetcher, { force: true });
  releaseFirst();

  assert.deepEqual(await first, ['fetch-1']);
  assert.deepEqual(await forced, ['fetch-2']);
  assert.equal(fetches, 2);
  assert.deepEqual(cache.peek('k').value, ['fetch-2']);
});

test('swr cache: clone isolates callers from the stored value', async () => {
  const cache = makeCache({ clone: (rows) => rows.map((row) => [...row]) });
  const fetcher = async () => [['a']];

  const first = await withMockedNow(1_000, () => cache.read('k', fetcher));
  first[0][0] = 'mutated';
  const second = await withMockedNow(2_000, () => cache.read('k', fetcher));
  assert.deepEqual(second, [['a']]);
});

test('swr cache: invalidateScope drops entries and blocks a pre-write fetch from repopulating', async () => {
  const cache = makeCache({ scopeOf: (key) => key.split('::')[0] });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const slowFetcher = async () => { await gate; return ['pre-write']; };

  // A fetch starts, the scope is invalidated mid-flight (e.g. a write landed),
  // then the fetch resolves: its pre-write result must not enter the cache.
  const pending = cache.read('Students::A1', slowFetcher);
  cache.invalidateScope('Students');
  release();
  assert.deepEqual(await pending, ['pre-write']);
  assert.equal(cache.peek('Students::A1'), null);

  // Unrelated scopes are untouched.
  await cache.read('Planning::A1', async () => ['kept']);
  cache.invalidateScope('Students');
  assert.deepEqual(cache.peek('Planning::A1').value, ['kept']);
});

// allowExpired exists for renders on a human's critical path (the payroll save
// re-renders the whole page inside its own POST, and the button spinner lasts
// that long). Past the hard max the default is to make the caller wait; this
// opts out of the wait without opting out of the refresh.
test('swr cache: allowExpired serves a past-hard-max value and refreshes behind it', async () => {
  const cache = makeCache();
  let fetches = 0;
  const fetcher = async () => { fetches += 1; return [`fetch-${fetches}`]; };

  await withMockedNow(1_000, () => cache.read('k', fetcher));
  const hardMaxPassed = 1_000 + 60_000 + 300_000 + 1;

  const value = await withMockedNow(hardMaxPassed, () => cache.read('k', fetcher, { allowExpired: true }));
  assert.deepEqual(value, ['fetch-1'], 'the expired value is served rather than making the caller wait');
  assert.equal(fetches, 2, 'and a refresh was started behind the request');

  // The refresh still lands, so the next read is current.
  await new Promise((resolve) => setImmediate(resolve));
  const after = await withMockedNow(hardMaxPassed, () => cache.read('k', fetcher, { allowExpired: true }));
  assert.deepEqual(after, ['fetch-2']);
  assert.equal(fetches, 2, 'and did not fetch again');
});

test('swr cache: allowExpired still fetches when nothing is cached', async () => {
  const cache = makeCache();
  let fetches = 0;
  const fetcher = async () => { fetches += 1; return ['fetched']; };

  const value = await withMockedNow(1_000, () => cache.read('k', fetcher, { allowExpired: true }));
  assert.deepEqual(value, ['fetched'], 'nothing stale to serve means the caller must wait');
  assert.equal(fetches, 1);
});

test('swr cache: stat reports age without evicting an expired entry', async () => {
  const cache = makeCache();
  await withMockedNow(1_000, () => cache.read('k', async () => ['fetched']));

  const fresh = await withMockedNow(30_000, async () => cache.stat('k'));
  assert.equal(fresh.isFresh, true);
  assert.equal(fresh.isExpired, false);

  const expiredAt = 1_000 + 60_000 + 300_000 + 60_000;
  const expired = await withMockedNow(expiredAt, async () => cache.stat('k'));
  assert.equal(expired.isExpired, true);
  assert.equal(expired.age, expiredAt - 1_000);
  // stat must not evict — the page reads the value and its age in the same render.
  assert.equal(await withMockedNow(expiredAt, async () => cache.stat('k')) !== null, true);
  assert.equal(cache.stat('missing'), null);
});

// patchScopeStale exists so a caller that just wrote through to the source can
// fold the change in instead of dropping the cache and making the very next
// render pay a full refetch. The patch must be a head start on the truth, never
// a replacement for it — hence "stale", not "fresh".
test('swr cache: patchScopeStale folds in a known change and still refreshes behind the next read', async () => {
  const cache = makeCache({ scopeOf: (key) => key.split('::')[0] });
  let fetches = 0;
  const fetcher = async () => { fetches += 1; return [{ id: 'a', status: 'from-source' }]; };

  await withMockedNow(1_000, () => cache.read('Att::w1', fetcher));
  assert.equal(fetches, 1);

  const patched = await withMockedNow(2_000, () => cache.patchScopeStale('Att', (rows) => (
    rows.map((row) => (row.id === 'a' ? { ...row, status: 'patched' } : row))
  )));
  assert.equal(patched, 1);

  // Served immediately — no wait — but treated as stale, so a refresh starts.
  const served = await withMockedNow(2_000, () => cache.read('Att::w1', fetcher));
  assert.deepEqual(served, [{ id: 'a', status: 'patched' }], 'the local edit is visible at once');
  assert.equal(fetches, 2, 'and the source is still consulted behind the request');

  await new Promise((resolve) => setImmediate(resolve));
  const after = await withMockedNow(2_000, () => cache.read('Att::w1', fetcher));
  assert.deepEqual(after, [{ id: 'a', status: 'from-source' }], 'the source gets the last word');
});

test('swr cache: patchScopeStale reports 0 when nothing matched, so callers can fall back', async () => {
  const cache = makeCache({ scopeOf: (key) => key.split('::')[0] });
  await withMockedNow(1_000, () => cache.read('Att::w1', async () => [{ id: 'a' }]));

  const patched = cache.patchScopeStale('Att', () => undefined);
  assert.equal(patched, 0);
  // Untouched entries stay fresh.
  assert.equal((await withMockedNow(2_000, () => cache.stat("Att::w1"))).isFresh, true);
  assert.equal(cache.patchScopeStale('OtherScope', (rows) => rows), 0);
});

test('swr cache: a fetch that predates a patch cannot land on top of it', async () => {
  const cache = makeCache({ scopeOf: (key) => key.split('::')[0] });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const slowFetcher = async () => { await gate; return [{ id: 'a', status: 'pre-write' }]; };

  // The real sequence: the payroll page is open (cache seeded), a background
  // refresh is already in flight when the admin records a lesson in MMS, and the
  // patch lands while that older fetch is still out.
  const originalNow = Date.now;
  try {
    Date.now = () => 1_000;
    await cache.read('Att::w1', async () => [{ id: 'a', status: 'seed' }]);

    Date.now = () => 1_000 + 60_001;          // stale: serves now, refreshes behind
    const served = await cache.read('Att::w1', slowFetcher);
    assert.deepEqual(served, [{ id: 'a', status: 'seed' }]);

    cache.patchScopeStale('Att', (rows) => rows.map((row) => ({ ...row, status: 'patched' })));
    release();
    await gate;
    await new Promise((resolve) => setImmediate(resolve));

    const peeked = cache.peek('Att::w1', { keepExpired: true });
    assert.equal(peeked.value[0].status, 'patched', 'the in-flight pre-write result must not overwrite the patch');
  } finally {
    Date.now = originalNow;
  }
});
