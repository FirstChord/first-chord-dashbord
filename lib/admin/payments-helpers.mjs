const MANUAL_PAYMENT_STUDENTS = new Set(
  [
    'Katrina Caldwell',
    'Kenny',
    'Hayleigh',
    'Hudson',
    'Angie Godard',
  ].map((value) => value.trim().toLowerCase()),
);

export const PAYMENT_MODE_OPTIONS = ['stripe', 'manual', 'unknown'];
export const PAYMENT_EXPECTATION_OPTIONS = [
  'setup_pending',
  'stripe_active_expected',
  'stripe_paused_expected',
  'inactive_or_stopped',
];

export function normalisePaymentMode(value) {
  const mode = `${value || ''}`.trim().toLowerCase();

  if (mode === 'stripe' || mode === 'manual' || mode === 'unknown') {
    return mode;
  }

  return '';
}

export function derivePaymentMode({ explicitMode = '', fullName = '' } = {}) {
  const normalisedExplicit = normalisePaymentMode(explicitMode);
  if (normalisedExplicit) {
    return normalisedExplicit;
  }

  if (MANUAL_PAYMENT_STUDENTS.has(`${fullName || ''}`.trim().toLowerCase())) {
    return 'manual';
  }

  return 'stripe';
}

export function normalisePaymentExpectation(value) {
  const expectation = `${value || ''}`.trim().toLowerCase();

  if (PAYMENT_EXPECTATION_OPTIONS.includes(expectation)) {
    return expectation;
  }

  return '';
}

export function derivePaymentExpectation({ explicitExpectation = '', paymentMode = '' } = {}) {
  const normalisedExplicit = normalisePaymentExpectation(explicitExpectation);
  if (normalisedExplicit) {
    return normalisedExplicit;
  }

  const normalisedPaymentMode = normalisePaymentMode(paymentMode);

  if (normalisedPaymentMode === 'unknown') {
    return 'setup_pending';
  }

  if (normalisedPaymentMode === 'stripe') {
    return 'stripe_active_expected';
  }

  return '';
}
