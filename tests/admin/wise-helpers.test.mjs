import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseTutorWise,
  buildWiseBatch,
  buildPaymentReference,
  toWiseCsv,
  WISE_CSV_HEADERS,
} from '../../lib/admin/wise-helpers.mjs';

function wiseRow(overrides = {}) {
  return {
    tutor: 'Kenny',
    recipient_id: '12345',
    name: 'Kenny Bates',
    recipient_email: 'kenny@example.com',
    recipient_detail: 'GB00 0000',
    source_currency: 'GBP',
    target_currency: 'GBP',
    amount_currency: 'GBP',
    receiver_type: 'PERSON',
    ...overrides,
  };
}

function payrollRow(overrides = {}) {
  return {
    tutor: 'Kenny Bates',
    tutorShortName: 'Kenny',
    status: 'reviewed',
    owedAmount: 280,
    periodEnd: '2026-07-01',
    ...overrides,
  };
}

test('parseTutorWise keys by normalised tutor and defaults currencies to GBP', () => {
  const map = parseTutorWise([wiseRow({ tutor: 'Kenny', source_currency: '', target_currency: '', amount_currency: '' })]);
  const recipient = map.get('kenny');
  assert.ok(recipient);
  assert.equal(recipient.recipientId, '12345');
  assert.equal(recipient.sourceCurrency, 'GBP');
  assert.equal(recipient.targetCurrency, 'GBP');
  assert.equal(recipient.amountCurrency, 'GBP');
});

test('buildWiseBatch includes only reviewed rows with positive owed amount', () => {
  const wiseByKey = parseTutorWise([wiseRow()]);
  const rows = [
    payrollRow({ status: 'reviewed', owedAmount: 280 }),
    payrollRow({ status: 'draft', owedAmount: 100 }),
    payrollRow({ status: 'paid', owedAmount: 0 }),
    payrollRow({ status: 'reviewed', owedAmount: 0 }),
  ];
  const result = buildWiseBatch({ rows, wiseByKey });
  assert.equal(result.includedCount, 1);
  assert.equal(result.totalAmount, 280);
  assert.equal(result.csvRows[0].amount, '280.00');
  assert.equal(result.csvRows[0].paymentReference, 'FC pay 2026-07-01');
  assert.equal(result.csvRows[0].recipientId, '12345');
  assert.equal(result.missing.length, 0);
});

test('buildWiseBatch surfaces reviewed rows with no Wise recipient instead of dropping them', () => {
  const wiseByKey = parseTutorWise([wiseRow({ tutor: 'Kenny' })]);
  const rows = [
    payrollRow({ tutor: 'Lucy Smith', tutorShortName: 'Lucy', owedAmount: 120 }),
  ];
  const result = buildWiseBatch({ rows, wiseByKey });
  assert.equal(result.includedCount, 0);
  assert.equal(result.missing.length, 1);
  assert.equal(result.missing[0].tutor, 'Lucy Smith');
});

test('buildWiseBatch matches by full tutor name when short name misses', () => {
  const wiseByKey = parseTutorWise([wiseRow({ tutor: 'Kenny Bates' })]);
  const rows = [payrollRow({ tutorShortName: '', tutor: 'Kenny Bates' })];
  const result = buildWiseBatch({ rows, wiseByKey });
  assert.equal(result.includedCount, 1);
});

test('buildWiseBatch skips a reviewed row whose recipient has no recipientId', () => {
  const wiseByKey = parseTutorWise([wiseRow({ recipient_id: '' })]);
  const result = buildWiseBatch({ rows: [payrollRow()], wiseByKey });
  assert.equal(result.includedCount, 0);
  assert.equal(result.missing.length, 1);
});

test('buildPaymentReference is short and falls back without a date', () => {
  assert.equal(buildPaymentReference({ periodEnd: '2026-07-01' }), 'FC pay 2026-07-01');
  assert.equal(buildPaymentReference({}), 'FC pay');
});

test('toWiseCsv emits the exact header order and escapes commas/quotes', () => {
  const csv = toWiseCsv([
    {
      recipientId: '1',
      name: 'Bates, Kenny',
      recipientEmail: 'k@example.com',
      recipientDetail: 'has "quote"',
      sourceCurrency: 'GBP',
      targetCurrency: 'GBP',
      amountCurrency: 'GBP',
      amount: '280.00',
      paymentReference: 'FC pay 2026-07-01',
      receiverType: 'PERSON',
    },
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], WISE_CSV_HEADERS.join(','));
  assert.ok(lines[1].includes('"Bates, Kenny"'));
  assert.ok(lines[1].includes('"has ""quote"""'));
});
