import { getServerSession } from 'next-auth';
import { authOptions, isAllowedAdminEmail } from '@/lib/admin/auth';
import {
  resolveTutorDashboardAccess,
  resolveTutorDashboardGuard,
  tutorAuthErrorBody,
} from '@/lib/tutor-auth-contract.mjs';

// Thin adapter: supplies the real session + admin lookup to the decision logic
// in tutor-auth-contract.mjs, which is where the tests run it.
function realDependencies(env) {
  return {
    env,
    getSession: () => getServerSession(authOptions),
    isAdminEmail: isAllowedAdminEmail,
  };
}

export async function getTutorDashboardAccess({ env = process.env } = {}) {
  return resolveTutorDashboardAccess(realDependencies(env));
}

export async function requireTutorDashboardAccess({
  requestedTutor = '',
  env = process.env,
} = {}) {
  return resolveTutorDashboardGuard({
    requestedTutor,
    ...realDependencies(env),
  });
}

export { tutorAuthErrorBody };
