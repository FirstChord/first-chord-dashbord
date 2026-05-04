import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { AdminSignInButton } from '@/components/admin/AdminAuthButton';
import { authOptions, getAdminAuthConfigStatus } from '@/lib/admin/auth';

export default async function AdminLoginPage() {
  const session = await getServerSession(authOptions);
  const config = getAdminAuthConfigStatus();

  if (session?.user?.isAdmin) {
    redirect('/admin');
  }

  const isConfigured =
    config.hasGoogleClientId &&
    config.hasGoogleClientSecret &&
    config.hasNextAuthSecret &&
    config.allowedEmails.length > 0;

  return (
    <div className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-md rounded-[1.75rem] border border-blue-100 bg-white/90 p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">FirstChord Admin</p>
        <h1
          className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800"
          style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
        >
          Sign in
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          This area is restricted to Finn and Tom. Use an approved Google account to continue.
        </p>

        <div className="mt-8">
          <AdminSignInButton disabled={!isConfigured} />
        </div>

        {!isConfigured ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Admin auth is not fully configured yet. Add Google OAuth credentials, `NEXTAUTH_SECRET`, and
            `ADMIN_ALLOWED_EMAILS` before using this area.
          </div>
        ) : null}
      </div>
    </div>
  );
}
