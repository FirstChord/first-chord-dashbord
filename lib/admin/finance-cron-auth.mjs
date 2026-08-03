/** @fileoverview Shared secret boundary for the two scheduled finance endpoints. */

function clean(value = '') {
  return `${value || ''}`.trim();
}

function timingSafeEqualString(leftValue = '', rightValue = '') {
  const left = clean(leftValue);
  const right = clean(rightValue);
  if (!left || !right || left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function authenticateFinanceCronRequest(request, {
  getSecret = () => process.env.FINANCE_SNAPSHOT_SECRET,
} = {}) {
  const expectedSecret = clean(getSecret());
  if (!expectedSecret) {
    return Response.json(
      { error: 'FINANCE_SNAPSHOT_SECRET is not configured' },
      { status: 503 },
    );
  }

  const providedSecret = request?.headers?.get('x-firstchord-finance-secret') || '';
  if (!timingSafeEqualString(providedSecret, expectedSecret)) {
    return Response.json(
      { error: 'Invalid or missing finance snapshot secret' },
      { status: 401 },
    );
  }

  return null;
}
