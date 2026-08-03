/** @fileoverview Executable HTTP boundary for the scheduled Stripe cache job. */

import { authenticateFinanceCronRequest } from './finance-cron-auth.mjs';

function requireFunction(name, value) {
  if (typeof value !== 'function') throw new TypeError(`${name} is required`);
  return value;
}

export function createStripeAmountsPostHandler({
  getSecret,
  now = () => new Date(),
  getStudents,
  fetchSubscriptions,
  buildCacheRows,
  replaceCacheRows,
  previousMonth,
  fetchPaidInvoices,
  summariseInvoices,
  upsertCollectedMonth,
} = {}) {
  requireFunction('now', now);
  requireFunction('getStudents', getStudents);
  requireFunction('fetchSubscriptions', fetchSubscriptions);
  requireFunction('buildCacheRows', buildCacheRows);
  requireFunction('replaceCacheRows', replaceCacheRows);
  requireFunction('previousMonth', previousMonth);
  requireFunction('fetchPaidInvoices', fetchPaidInvoices);
  requireFunction('summariseInvoices', summariseInvoices);
  requireFunction('upsertCollectedMonth', upsertCollectedMonth);

  return async function stripeAmountsPost(request) {
    const authError = authenticateFinanceCronRequest(request, { getSecret });
    if (authError) return authError;

    try {
      const at = now();
      const month = previousMonth(at);
      const [students, subscriptions, invoices] = await Promise.all([
        getStudents(),
        fetchSubscriptions(),
        fetchPaidInvoices(month),
      ]);

      const {
        rows,
        unmatchedStudents,
        unmatchedSubscriptions,
      } = buildCacheRows(subscriptions, students, { now: at });
      const collected = summariseInvoices(invoices, { month });

      // Complete every provider read before mutating either cache. A Stripe read
      // failure therefore leaves both Sheets lanes at their previous refresh.
      await replaceCacheRows(rows);
      await upsertCollectedMonth({
        month: collected.month,
        collected_total: collected.collectedTotal,
        invoice_count: collected.invoiceCount,
        currency: 'gbp',
        refreshed_at: at.toISOString(),
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
      return Response.json(
        { error: error?.message || 'Stripe amounts refresh failed' },
        { status: 500 },
      );
    }
  };
}
