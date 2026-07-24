const ENFORCED_MODES = new Set(['pilot', 'required']);

function clean(value = '') {
  return `${value || ''}`.trim();
}

function normaliseEmail(value = '') {
  return clean(value).toLowerCase();
}

function normaliseTutorKey(value = '') {
  return clean(value).toLowerCase();
}

export function normaliseTutorDashboardAuthMode(value = '') {
  const mode = clean(value).toLowerCase();
  return ['off', 'pilot', 'required'].includes(mode) ? mode : 'off';
}

export function isTutorDashboardAuthEnforced(env = process.env) {
  return ENFORCED_MODES.has(normaliseTutorDashboardAuthMode(env.TUTOR_DASHBOARD_AUTH_MODE));
}

export function parseTutorDashboardFullAccessEmails(value = '') {
  return clean(value)
    .split(',')
    .map(normaliseEmail)
    .filter(Boolean);
}

export function parseTutorDashboardEmailMap(value = '') {
  const input = clean(value);
  if (!input) return {};

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch {
    parsed = Object.fromEntries(
      input
        .split(',')
        .map((entry) => {
          const separator = entry.indexOf('=');
          if (separator < 1) return null;
          return [entry.slice(0, separator), entry.slice(separator + 1)];
        })
        .filter(Boolean),
    );
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return {};

  return Object.fromEntries(
    Object.entries(parsed)
      .map(([email, tutorKeys]) => {
        const normalisedEmail = normaliseEmail(email);
        const keys = (Array.isArray(tutorKeys) ? tutorKeys : `${tutorKeys || ''}`.split('|'))
          .map(clean)
          .filter(Boolean);
        return normalisedEmail && keys.length > 0 ? [normalisedEmail, [...new Set(keys)]] : null;
      })
      .filter(Boolean),
  );
}

export function getTutorDashboardAccessForEmail(email = '', {
  isAdmin = false,
  env = process.env,
} = {}) {
  const normalisedEmail = normaliseEmail(email);
  if (!normalisedEmail) {
    return {
      authorized: false,
      email: '',
      fullAccess: false,
      tutorKeys: [],
      source: 'missing_email',
    };
  }

  if (isAdmin) {
    return {
      authorized: true,
      email: normalisedEmail,
      fullAccess: true,
      tutorKeys: [],
      source: 'admin',
    };
  }

  const fullAccessEmails = parseTutorDashboardFullAccessEmails(
    env.TUTOR_DASHBOARD_FULL_ACCESS_EMAILS,
  );
  if (fullAccessEmails.includes(normalisedEmail)) {
    return {
      authorized: true,
      email: normalisedEmail,
      fullAccess: true,
      tutorKeys: [],
      source: 'full_access_allowlist',
    };
  }

  const tutorKeys = parseTutorDashboardEmailMap(
    env.TUTOR_DASHBOARD_EMAIL_MAP,
  )[normalisedEmail] || [];

  return {
    authorized: tutorKeys.length > 0,
    email: normalisedEmail,
    fullAccess: false,
    tutorKeys,
    source: tutorKeys.length > 0 ? 'tutor_email_map' : 'not_allowed',
  };
}

export function canTutorDashboardAccessTutor(access = {}, tutorKey = '') {
  if (!access.authorized) return false;
  if (access.fullAccess) return true;
  const requested = normaliseTutorKey(tutorKey);
  return Boolean(requested) && (access.tutorKeys || []).some(
    (allowed) => normaliseTutorKey(allowed) === requested,
  );
}

export function filterTutorOptionsForAccess(tutorOptions = [], access = {}) {
  if (!access.authorized) return [];
  if (access.fullAccess) return tutorOptions;
  return tutorOptions.filter((option) => canTutorDashboardAccessTutor(access, option.shortName));
}
