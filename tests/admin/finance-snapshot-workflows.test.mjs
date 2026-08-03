import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const financeWorkflow = await readFile(new URL('../../.github/workflows/finance-snapshot.yml', import.meta.url), 'utf8');
const stripeWorkflow = await readFile(new URL('../../.github/workflows/stripe-amounts.yml', import.meta.url), 'utf8');

test('finance monthly schedule retries during the first week and routes those calls as monthly', () => {
  assert.match(financeWorkflow, /cron: "30 6 1-7 \* \*"/u);
  assert.match(financeWorkflow, /github\.event\.schedule == '30 6 1-7 \* \*'/u);
  assert.match(financeWorkflow, /period=\$\{PERIOD\}/u);
});

test('Stripe collections refresh on the first as well as Mondays', () => {
  assert.match(stripeWorkflow, /cron: "15 5 1 \* \*"/u);
  assert.match(stripeWorkflow, /cron: "30 5 \* \* 1"/u);
  assert.match(stripeWorkflow, /api\/cron\/stripe-amounts/u);
});
