import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchWithProviderTimeout,
  resolveProviderTimeoutMs,
} from '../../lib/admin/provider-fetch.mjs';

// A real in-flight fetch holds an open socket, so the event loop stays referenced
// until the request settles. AbortSignal.timeout() is deliberately unref'd, so a
// stand-in holding nothing lets the loop drain before the timeout can ever fire:
// the request never settles and the runner cancels the test instead of running it.
// This double keeps one referenced handle for as long as a real pending request
// would, and turns a missing abort into a named failure rather than a hang.
const STALLED_FETCH_GIVE_UP_MS = 5_000;

function stalledFetch(rejectionFor) {
  return async (_input, { signal }) => new Promise((_resolve, reject) => {
    const pending = setTimeout(
      () => reject(new Error('stalled fetch was never aborted')),
      STALLED_FETCH_GIVE_UP_MS,
    );
    signal.addEventListener('abort', () => {
      clearTimeout(pending);
      reject(rejectionFor(signal));
    }, { once: true });
  });
}

test('resolveProviderTimeoutMs rejects invalid values and caps excessive waits', () => {
  assert.equal(resolveProviderTimeoutMs(''), 30_000);
  assert.equal(resolveProviderTimeoutMs('-1', 5_000), 5_000);
  assert.equal(resolveProviderTimeoutMs('4500'), 4_500);
  assert.equal(resolveProviderTimeoutMs('999999'), 120_000);
});

test('fetchWithProviderTimeout preserves request options and supplies an abort signal', async () => {
  const response = await fetchWithProviderTimeout('https://example.test/data', {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  }, {
    provider: 'Example',
    fetchImpl: async (input, init) => {
      assert.equal(input, 'https://example.test/data');
      assert.equal(init.headers.accept, 'application/json');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.signal.aborted, false);
      return new Response('{}');
    },
  });

  assert.equal(response.ok, true);
});

test('fetchWithProviderTimeout turns a stalled request into a provider-specific error', async () => {
  await assert.rejects(
    fetchWithProviderTimeout('https://example.test/stall', {}, {
      provider: 'Stripe',
      timeoutMs: 5,
      fetchImpl: stalledFetch((signal) => signal.reason),
    }),
    /Stripe did not respond within 5ms\./u,
  );
});

test('fetchWithProviderTimeout preserves a caller abort rather than calling it a timeout', async () => {
  const controller = new AbortController();
  const request = fetchWithProviderTimeout('https://example.test/cancel', {
    signal: controller.signal,
  }, {
    provider: 'GitHub',
    timeoutMs: 1_000,
    fetchImpl: stalledFetch(() => new Error('caller stopped')),
  });
  controller.abort();

  await assert.rejects(request, /caller stopped/u);
});
