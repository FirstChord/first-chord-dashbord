/** @fileoverview Shared timeout boundary for outbound provider HTTP requests. */

export const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;
const MAX_PROVIDER_TIMEOUT_MS = 120_000;

export function resolveProviderTimeoutMs(value, fallback = DEFAULT_PROVIDER_TIMEOUT_MS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.round(parsed), MAX_PROVIDER_TIMEOUT_MS);
}

function formatTimeout(timeoutMs) {
  return timeoutMs % 1000 === 0 ? `${timeoutMs / 1000}s` : `${timeoutMs}ms`;
}

export async function fetchWithProviderTimeout(input, init = {}, {
  provider = 'External service',
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required');
  const resolvedTimeoutMs = resolveProviderTimeoutMs(timeoutMs);
  const timeoutSignal = AbortSignal.timeout(resolvedTimeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  try {
    return await fetchImpl(input, { ...init, signal });
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new Error(`${provider} did not respond within ${formatTimeout(resolvedTimeoutMs)}.`, { cause: error });
    }
    throw error;
  }
}
