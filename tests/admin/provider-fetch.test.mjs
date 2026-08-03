import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchWithProviderTimeout,
  resolveProviderTimeoutMs,
} from '../../lib/admin/provider-fetch.mjs';

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
  const neverResponds = async (_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

  await assert.rejects(
    fetchWithProviderTimeout('https://example.test/stall', {}, {
      provider: 'Stripe',
      timeoutMs: 5,
      fetchImpl: neverResponds,
    }),
    /Stripe did not respond within 5ms\./u,
  );
});

test('fetchWithProviderTimeout preserves a caller abort rather than calling it a timeout', async () => {
  const controller = new AbortController();
  const neverResponds = async (_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('caller stopped')), { once: true });
  });
  const request = fetchWithProviderTimeout('https://example.test/cancel', {
    signal: controller.signal,
  }, {
    provider: 'GitHub',
    timeoutMs: 1_000,
    fetchImpl: neverResponds,
  });
  controller.abort();

  await assert.rejects(request, /caller stopped/u);
});
