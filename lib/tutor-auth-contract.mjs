// The tutor-dashboard guard, with its two impure dependencies (the NextAuth
// session and the admin-email check) injected rather than imported.
//
// lib/tutor-auth.js is the thin adapter that supplies the real ones. It exists
// separately because importing it pulls next-auth in at module scope, which is
// what previously made this logic unreachable from `node --test` — so the only
// coverage the routes had was a regex looking for the guard's name in their
// source. The decision logic lives here so it can actually be run.
import {
  canTutorDashboardAccessTutor,
  getTutorDashboardAccessForEmail,
  isTutorDashboardAuthEnforced,
} from './tutor-auth-helpers.mjs';

// Auth mode off => the pre-pilot public dashboard. Deliberately full access,
// and deliberately without touching the session.
const LEGACY_PUBLIC_ACCESS = {
  enforced: false,
  authorized: true,
  email: '',
  fullAccess: true,
  tutorKeys: [],
  source: 'legacy_public',
};

export async function resolveTutorDashboardAccess({
  env = process.env,
  getSession,
  isAdminEmail = () => false,
} = {}) {
  if (!isTutorDashboardAuthEnforced(env)) {
    return { ...LEGACY_PUBLIC_ACCESS };
  }

  const session = await getSession();
  const email = `${session?.user?.email || ''}`.trim().toLowerCase();
  const access = getTutorDashboardAccessForEmail(email, {
    isAdmin: isAdminEmail(email),
    env,
  });

  return { ...access, enforced: true };
}

export async function resolveTutorDashboardGuard({
  requestedTutor = '',
  env = process.env,
  getSession,
  isAdminEmail = () => false,
} = {}) {
  const access = await resolveTutorDashboardAccess({ env, getSession, isAdminEmail });

  if (!access.authorized) {
    return { ok: false, status: 401, code: 'tutor_login_required', access };
  }

  if (requestedTutor && !canTutorDashboardAccessTutor(access, requestedTutor)) {
    return { ok: false, status: 403, code: 'tutor_access_denied', access };
  }

  return { ok: true, status: 200, code: '', access };
}

export function tutorAuthErrorBody(result = {}) {
  return {
    success: false,
    code: result.code || 'tutor_login_required',
    message: result.status === 403
      ? 'This account cannot access that tutor dashboard'
      : 'Sign in with an approved First Chord Google account',
  };
}
