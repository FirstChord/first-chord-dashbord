import test from 'node:test';
import assert from 'node:assert/strict';

import {
  derivePaymentExpectation,
  derivePaymentMode,
  normalisePaymentExpectation,
  normalisePaymentMode,
} from '../../lib/admin/payments-helpers.mjs';

test('normalisePaymentMode only allows the supported modes', () => {
  assert.equal(normalisePaymentMode('stripe'), 'stripe');
  assert.equal(normalisePaymentMode('Manual'), 'manual');
  assert.equal(normalisePaymentMode('unknown'), 'unknown');
  assert.equal(normalisePaymentMode('cash'), '');
});

test('derivePaymentMode respects an explicit sheet value first', () => {
  assert.equal(derivePaymentMode({ explicitMode: 'manual', fullName: 'Someone Else' }), 'manual');
  assert.equal(derivePaymentMode({ explicitMode: 'stripe', fullName: 'Katrina Caldwell' }), 'stripe');
});

test('derivePaymentMode falls back to known manual-payment exceptions', () => {
  assert.equal(derivePaymentMode({ explicitMode: '', fullName: 'Katrina Caldwell' }), 'manual');
  assert.equal(derivePaymentMode({ explicitMode: '', fullName: 'Angie Godard' }), 'manual');
  assert.equal(derivePaymentMode({ explicitMode: '', fullName: 'Owen Example' }), 'stripe');
});

test('normalisePaymentExpectation only allows the supported expectations', () => {
  assert.equal(normalisePaymentExpectation('setup_pending'), 'setup_pending');
  assert.equal(normalisePaymentExpectation('stripe_active_expected'), 'stripe_active_expected');
  assert.equal(normalisePaymentExpectation('stripe_paused_expected'), 'stripe_paused_expected');
  assert.equal(normalisePaymentExpectation('inactive_or_stopped'), 'inactive_or_stopped');
  assert.equal(normalisePaymentExpectation('manual_payment'), '');
});

test('derivePaymentExpectation respects an explicit sheet value first', () => {
  assert.equal(
    derivePaymentExpectation({
      explicitExpectation: 'stripe_paused_expected',
      paymentMode: 'stripe',
    }),
    'stripe_paused_expected',
  );
});

test('derivePaymentExpectation falls back from payment mode conservatively', () => {
  assert.equal(derivePaymentExpectation({ explicitExpectation: '', paymentMode: 'stripe' }), 'stripe_active_expected');
  assert.equal(derivePaymentExpectation({ explicitExpectation: '', paymentMode: 'unknown' }), 'setup_pending');
  assert.equal(derivePaymentExpectation({ explicitExpectation: '', paymentMode: 'manual' }), '');
});
