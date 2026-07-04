// Paginated read-only Stripe pulls for the weekly amounts-cache refresh. This is
// the ONLY place that walks Stripe in bulk — pages of 100, a handful of requests
// for ~170 subscriptions — and it runs from the cron route, never from a page
// render (see PAYMENTS_RULES: cheap local checks on read, scheduled sync for the
// expensive truth). Requires the restricted key's read scopes: customers,
// subscriptions, invoices, prices.

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const PAGE_LIMIT = 100;
const MAX_PAGES = 30; // safety valve: 3,000 objects is far beyond current scale

function getStripeHeaders() {
  const apiKey = process.env.STRIPE_API_KEY || '';
  if (!apiKey) {
    throw new Error('Stripe API key is not configured');
  }
  return { Authorization: `Bearer ${apiKey}` };
}

async function listAll(path, params = {}) {
  const headers = getStripeHeaders();
  const results = [];
  let startingAfter = '';

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const search = new URLSearchParams({ ...params, limit: `${PAGE_LIMIT}` });
    if (startingAfter) search.set('starting_after', startingAfter);
    const response = await fetch(`${STRIPE_API_BASE}${path}?${search.toString()}`, {
      headers,
      cache: 'no-store',
    });
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Stripe API error ${response.status}: ${errorBody}`);
    }
    const json = await response.json();
    const data = json?.data || [];
    results.push(...data);
    if (!json?.has_more || !data.length) break;
    startingAfter = data[data.length - 1].id;
  }

  return results;
}

// Active subscriptions include paused ones (pause_collection set, status still
// 'active'), which is exactly the billing-amount population we want.
export async function fetchAllActiveSubscriptions() {
  return listAll('/subscriptions', { status: 'active' });
}

// Paid invoices created within a calendar month ('YYYY-MM').
export async function fetchPaidInvoicesForMonth(month) {
  const start = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid month: ${month}`);
  }
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return listAll('/invoices', {
    status: 'paid',
    'created[gte]': `${Math.floor(start.getTime() / 1000)}`,
    'created[lt]': `${Math.floor(end.getTime() / 1000)}`,
  });
}
