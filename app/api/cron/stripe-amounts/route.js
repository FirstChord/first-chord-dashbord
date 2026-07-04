import { getOperationalAdminStudents } from '@/lib/admin/students';
import { replaceStripeAmountsCacheRows, upsertStripeCollectedMonthlyRow } from '@/lib/admin/sheets';
import { fetchAllActiveSubscriptions, fetchPaidInvoicesForMonth } from '@/lib/admin/stripe-batch';
import { buildStripeAmountsCacheRows, previousMonthKey, summariseCollectedInvoices } from '@/lib/admin/stripe-amounts-helpers.mjs';

// Weekly Stripe actuals refresh, called by a GitHub Action cron (Mondays, before
// the finance snapshot so the snapshot reads a fresh cache). Read-only against
// Stripe; the only writes are the two cache tabs. Shares FINANCE_SNAPSHOT_SECRET —
// same trust domain, same caller (the finance cron pipeline).

function clean(value = '') {
  return `${value || ''}`.trim();
}

function timingSafeEqualString(a = '', b = '') {
  const left = clean(a);
  const right = clean(b);
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function POST(request) {
  const expectedSecret = clean(process.env.FINANCE_SNAPSHOT_SECRET);
  if (!expectedSecret) {
    return Response.json({ error: 'FINANCE_SNAPSHOT_SECRET is not configured' }, { status: 503 });
  }
  const providedSecret = request.headers.get('x-firstchord-finance-secret') || '';
  if (!timingSafeEqualString(providedSecret, expectedSecret)) {
    return Response.json({ error: 'Invalid or missing finance snapshot secret' }, { status: 401 });
  }

  try {
    const now = new Date();
    const [students, subscriptions] = await Promise.all([
      getOperationalAdminStudents(),
      fetchAllActiveSubscriptions(),
    ]);

    const { rows, unmatchedStudents, unmatchedSubscriptions } = buildStripeAmountsCacheRows(subscriptions, students, { now });
    await replaceStripeAmountsCacheRows(rows);

    // Calibration: what Stripe actually collected in the last full month.
    const month = previousMonthKey(now);
    const invoices = await fetchPaidInvoicesForMonth(month);
    const collected = summariseCollectedInvoices(invoices, { month });
    await upsertStripeCollectedMonthlyRow({
      month: collected.month,
      collected_total: collected.collectedTotal,
      invoice_count: collected.invoiceCount,
      currency: 'gbp',
      refreshed_at: now.toISOString(),
    });

    return Response.json({
      success: true,
      cachedStudents: rows.length,
      unmatchedStudents,
      unmatchedSubscriptions,
      collectedMonth: collected.month,
      collectedTotal: collected.collectedTotal,
      invoiceCount: collected.invoiceCount,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Stripe amounts refresh failed' }, { status: 500 });
  }
}
