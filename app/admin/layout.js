import Image from 'next/image';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { AdminSignOutButton } from '@/components/admin/AdminAuthButton';

const dailyNavItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/students', label: 'Students' },
  { href: '/admin/waiting', label: 'Waiting' },
  { href: '/admin/flags', label: 'Issues' },
];

const planningNavItems = [
  { href: '/admin/capacity', label: 'Capacity' },
  { href: '/admin/showcase', label: 'Showcase' },
  { href: '/admin/holidays', label: 'Holidays' },
];

function NavLink({ href, label, compact = false }) {
  return (
    <Link
      href={href}
      className={`rounded-full border border-blue-200/70 bg-white/75 font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-white hover:text-slate-900 ${
        compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
      }`}
    >
      {label}
    </Link>
  );
}

export default async function AdminLayout({ children }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-t from-green-100 to-blue-100 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/cloud.png"
          alt=""
          width={192}
          height={128}
          className="absolute top-24 right-6 opacity-80 -rotate-12"
        />
      </div>
      <header className="sticky top-0 z-20 border-b border-blue-100/40 bg-blue-100/90 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">FirstChord Admin</p>
            <h1
              className="text-2xl font-bold uppercase tracking-wide text-slate-800"
              style={{ fontFamily: '"Cooper Hewitt", "Nimbus Sans L", "Arial", sans-serif' }}
            >
              Admin Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {session?.user?.email ? (
              <span className="rounded-full bg-white/80 px-3 py-1 text-sm text-slate-600 shadow-sm">{session.user.email}</span>
            ) : null}
            <AdminSignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 pb-5">
          {dailyNavItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
          <div className="flex flex-wrap items-center gap-2 border-l border-blue-200/80 pl-3">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Planning</span>
            {planningNavItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} compact />
            ))}
          </div>
        </nav>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
