const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const buckets = new Map();

function keyFor(studentMmsId, clientKey) {
  return `${studentMmsId}:${clientKey}`;
}

function prune(now) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function notesUnlockRateLimitState({ studentMmsId, clientKey, now = Date.now() }) {
  prune(now);
  const key = keyFor(studentMmsId, clientKey);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (bucket) buckets.delete(key);
    return { allowed: true, retryAfterSeconds: 0, remaining: MAX_FAILURES };
  }
  if (bucket.failures >= MAX_FAILURES) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: MAX_FAILURES - bucket.failures };
}

export function recordNotesUnlockFailure({ studentMmsId, clientKey, now = Date.now() }) {
  const key = keyFor(studentMmsId, clientKey);
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { failures: 0, resetAt: now + WINDOW_MS }
    : existing;
  bucket.failures += 1;
  buckets.set(key, bucket);
  return notesUnlockRateLimitState({ studentMmsId, clientKey, now });
}

export function clearNotesUnlockFailures({ studentMmsId, clientKey }) {
  buckets.delete(keyFor(studentMmsId, clientKey));
}

export function clientKeyFromRequest(request) {
  const forwarded = `${request.headers.get('x-forwarded-for') || ''}`.split(',')[0].trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown-client';
}
