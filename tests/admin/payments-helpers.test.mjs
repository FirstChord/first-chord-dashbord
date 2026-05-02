import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePaymentMode, normalisePaymentMode } from '../../lib/admin/payments-helpers.mjs';

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
