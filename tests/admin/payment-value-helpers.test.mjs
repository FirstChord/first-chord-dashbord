import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePaymentValueContext } from '../../lib/admin/payment-value-helpers.mjs';

test('derivePaymentValueContext prices one-to-one lessons from cached schedule duration', () => {
  const value = derivePaymentValueContext({
    instrument: 'Guitar',
    lessonLength: '45',
    scheduleContext: {
      status: 'found',
      durationMinutes: '30',
    },
  });

  assert.equal(value.lessonKind, 'one_to_one');
  assert.equal(value.baselineWeeklyValue, 25);
  assert.equal(value.baselineWeeklyLabel, '£25');
  assert.equal(value.baselineMonthlyLabel, '£108.33');
  assert.equal(value.confidence, 'high');
});

test('derivePaymentValueContext prices group lessons per student', () => {
  const value = derivePaymentValueContext({
    lessonType: 'sibling_group',
    scheduleContext: {
      status: 'found',
      durationMinutes: '45',
    },
  });

  assert.equal(value.lessonKind, 'group');
  assert.equal(value.baselineWeeklyLabel, '£20');
  assert.equal(value.baselineMonthlyLabel, '£86.67');
  assert.equal(value.confidence, 'high');
});

test('derivePaymentValueContext infers group pricing from shared MMS schedule slot', () => {
  const value = derivePaymentValueContext({
    instrument: 'Piano',
    lessonLength: '45',
    scheduleContext: {
      status: 'found',
      durationMinutes: '45',
      sharedStudentCount: 2,
      sharedStudentNames: ['Emily Grifa', 'Nina Gavlin'],
    },
  });

  assert.equal(value.lessonKind, 'group');
  assert.equal(value.baselineWeeklyLabel, '£20');
  assert.equal(value.baselineMonthlyLabel, '£86.67');
  assert.match(value.reasons.join(' '), /2 students sharing/);
});

test('derivePaymentValueContext prices Adult Ukulele Orchestra monthly', () => {
  const value = derivePaymentValueContext({
    instrument: 'Adult Ukulele Orchestra',
    scheduleContext: {
      status: 'found',
      durationMinutes: '60',
    },
  });

  assert.equal(value.lessonKind, 'orchestra');
  assert.equal(value.baselineMonthlyLabel, '£42.50');
  assert.equal(value.confidence, 'high');
});

test('derivePaymentValueContext warns when duration is not in the price table', () => {
  const value = derivePaymentValueContext({
    instrument: 'Piano',
    lessonLength: '35',
  });

  assert.equal(value.confidence, 'low');
  assert.equal(value.baselineWeeklyLabel, '');
  assert.match(value.warnings.join(' '), /price table/);
});
