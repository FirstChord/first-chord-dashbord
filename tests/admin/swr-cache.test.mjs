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
