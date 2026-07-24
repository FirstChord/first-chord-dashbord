import { getServerSession } from 'next-auth';
import { authOptions, isAllowedAdminEmail } from '@/lib/admin/auth';
import {
  canTutorDashboardAccessTutor,
  getTutorDashboardAccessForEmail,
  isTutorDashboardAuthEnforced,
} from '@/lib/tutor-auth-helpers.mjs';

export async function getTutorDashboardAccess({ env = process.env } = {}) {
  const enforced = isTutorDashboardAuthEnforced(env);
  if (!enforced) {
    return {
      enforced: false,
      authorized: true,
      email: '',
      fullAccess: true,
      tutorKeys: [],
      source: 'legacy_public',
    };
  }

  const session = await getServerSession(authOptions);
  const email = `${session?.user?.email || ''}`.trim().toLowerCase();
  const access = getTutorDashboardAccessForEmail(email, {
    isAdmin: isAllowedAdminEmail(email),
    env,
  });

  return {
    ...access,
    enforced: true,
  };
}

export async function requireTutorDashboardAccess({
  requestedTutor = '',
  env = process.env,
} = {}) {
  const access = await getTutorDashboardAccess({ env });

  if (!access.authorized) {
    return {
      ok: false,
      status: 401,
      code: 'tutor_login_required',
      access,
    };
  }

  if (requestedTutor && !canTutorDashboardAccessTutor(access, requestedTutor)) {
    return {
      ok: false,
      status: 403,
      code: 'tutor_access_denied',
      access,
    };
  }

  return {
    ok: true,
    status: 200,
    code: '',
    access,
  };
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
