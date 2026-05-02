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
