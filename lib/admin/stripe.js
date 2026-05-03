import { buildLiveStripeIssues, buildStripeSnapshot } from './stripe-snapshot-helpers.mjs';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function getStripeApiKey() {
  return process.env.STRIPE_API_KEY || '';
}

function getStripeHeaders() {
  const apiKey = getStripeApiKey();
  if (!apiKey) {
    throw new Error('Stripe API key is not configured');
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

async function getStripeJson(path, params = null) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const response = await fetch(`${STRIPE_API_BASE}${path}${query}`, {
    method: 'GET',
    headers: getStripeHeaders(),
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Stripe API error ${response.status}: ${errorBody}`);
  }

  return response.json();
}

async function getCustomerById(customerId) {
  if (!customerId) return null;
  return getStripeJson(`/customers/${customerId}`);
}

async function getCustomerByEmail(email) {
  if (!email) return null;
  const result = await getStripeJson('/customers', { email });
  return result?.data?.[0] || null;
}

async function getSubscriptionById(subscriptionId) {
  if (!subscriptionId) return null;
  return getStripeJson(`/subscriptions/${subscriptionId}`, {
    'expand[]': 'latest_invoice',
  });
}

async function getCustomerSubscriptions(customerId) {
  if (!customerId) return [];
  const result = await getStripeJson('/subscriptions', {
    customer: customerId,
    status: 'all',
    limit: '10',
    'expand[]': 'data.latest_invoice',
  });
  return result?.data || [];
}

function pickPrimarySubscription(subscriptions = []) {
  if (!subscriptions.length) return null;

  const sorted = [...subscriptions].sort((a, b) => {
    const score = (subscription) => {
      const status = `${subscription?.status || ''}`.trim().toLowerCase();
      const quantity = Number(subscription?.items?.data?.[0]?.quantity || 1);
      if (status === 'active' && quantity > 0) return 0;
      if (status === 'trialing' && quantity > 0) return 1;
      if (status === 'past_due' || status === 'unpaid') return 2;
      if (quantity === 0 || subscription?.pause_collection) return 3;
      if (status === 'canceled') return 5;
      return 4;
    };

    const byScore = score(a) - score(b);
    if (byScore !== 0) return byScore;

    return Number(b?.created || 0) - Number(a?.created || 0);
  });

  return sorted[0] || null;
}

export async function getLiveStripeSnapshot(student) {
  if (!student) {
    throw new Error('Student is required');
  }

  if (student.paymentMode !== 'stripe') {
    return {
      snapshot: null,
      issues: [],
      skippedReason: 'Student is not Stripe-managed',
    };
  }

  let customer = await getCustomerById(student.stripeCustomerId);
  if (!customer) {
    customer = await getCustomerByEmail(student.email);
  }

  let subscription = await getSubscriptionById(student.stripeSubscriptionId);
  if (!subscription && customer?.id) {
    const subscriptions = await getCustomerSubscriptions(customer.id);
    subscription = pickPrimarySubscription(subscriptions);
  }

  const invoice = subscription?.latest_invoice || null;
  const snapshot = buildStripeSnapshot({ customer, subscription, invoice });
  const issues = buildLiveStripeIssues({ student, snapshot });

  return {
    snapshot,
    issues,
    skippedReason: '',
  };
}
