import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { AdminSignOutButton } from '@/components/admin/AdminAuthButton';

const navItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/students', label: 'Students' },
  { href: '/admin/waiting', label: 'Waiting' },
  { href: '/admin/onboard', label: 'Onboarding' },
  { href: '/admin/flags', label: 'Flags & Issues' },
];

export default async function AdminLayout({ children }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">FirstChord Admin</p>
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            {session?.user?.email ? (
              <span className="text-sm text-slate-600">{session.user.email}</span>
            ) : null}
            <AdminSignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-6 px-6 pb-4">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-slate-700 hover:text-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
