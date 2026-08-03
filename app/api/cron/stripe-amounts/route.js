import { getOperationalAdminStudents } from '@/lib/admin/students';
import { replaceStripeAmountsCacheRows, upsertStripeCollectedMonthlyRow } from '@/lib/admin/sheets';
import { fetchAllActiveSubscriptions, fetchPaidInvoicesForMonth } from '@/lib/admin/stripe-batch';
import { buildStripeAmountsCacheRows, previousMonthKey, summariseCollectedInvoices } from '@/lib/admin/stripe-amounts-helpers.mjs';
import { createStripeAmountsPostHandler } from '@/lib/admin/stripe-amounts-endpoint.mjs';

// Stripe actuals refresh, called by GitHub Actions on the first of each month and
// Mondays before the finance snapshot. Read-only against Stripe; the only writes
// are the two cache tabs. Shares FINANCE_SNAPSHOT_SECRET — same trust domain,
// same caller (the finance cron pipeline).

export const POST = createStripeAmountsPostHandler({
  getStudents: getOperationalAdminStudents,
  fetchSubscriptions: fetchAllActiveSubscriptions,
  buildCacheRows: buildStripeAmountsCacheRows,
  replaceCacheRows: replaceStripeAmountsCacheRows,
  previousMonth: previousMonthKey,
  fetchPaidInvoices: fetchPaidInvoicesForMonth,
  summariseInvoices: summariseCollectedInvoices,
  upsertCollectedMonth: upsertStripeCollectedMonthlyRow,
});
