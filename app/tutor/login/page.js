import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { TutorSignInButton } from '@/components/tutor-dashboard/TutorAuthButton';
import {
  authOptions,
  getAdminAuthConfigStatus,
  isAllowedAdminEmail,
} from '@/lib/admin/auth';
import { getTutorDashboardAccessForEmail } from '@/lib/tutor-auth-helpers.mjs';

export const dynamic = 'force-dynamic';

export default async function TutorLoginPage() {
  const session = await getServerSession(authOptions);
  const email = `${session?.user?.email || ''}`.trim().toLowerCase();
  const access = getTutorDashboardAccessForEmail(email, {
    isAdmin: isAllowedAdminEmail(email),
  });
  const config = getAdminAuthConfigStatus();

  if (access.authorized) {
    redirect('/dashboard');
  }

  const isConfigured =
    config.hasGoogleClientId
    && config.hasGoogleClientSecret
    && config.hasNextAuthSecret;

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 via-white to-blue-50 px-6 py-16">
      <div className="mx-auto max-w-md rounded-[1.75rem] border border-green-100 bg-white/95 p-8 shadow-[0_18px_60px_rgba(15,23,42,0.10)]">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#2F6B3D]">
          First Chord Tutor Dashboard
        </p>
        <h1 className="mt-2 fc-display text-3xl text-slate-900">Welcome back</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign in with the approved First Chord Google account. Google shares
          your basic account identity only—this does not give the dashboard
          access to your Gmail.
        </p>

        <div className="mt-8">
          <TutorSignInButton disabled={!isConfigured} />
        </div>

        {!isConfigured ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Tutor sign-in is not configured on this service yet. Use the
            canonical First Chord dashboard link or ask Finn for help.
          </div>
        ) : null}
      </div>
    </main>
  );
}
