import Image from 'next/image';
import Link from 'next/link';
import { PawPrint } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { AdminSignOutButton } from '@/components/admin/AdminAuthButton';

const navItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/flags', label: 'Issues' },
  { href: '/admin/workflows', label: 'Workflows' },
  { href: '/admin/planning', label: 'Planning' },
  { href: '/admin/insights', label: 'Signals' },
];

function NavLink({ href, label }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-blue-200/70 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-white hover:text-slate-900"
    >
      {label}
    </Link>
  );
}

export default async function AdminLayout({ children }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-gradient-to-t from-green-100 to-blue-100 text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Image
          src="/cloud.png"
          alt=""
          width={192}
          height={128}
          className="absolute top-24 right-6 opacity-80 -rotate-12"
        />
      </div>
      <header className="standalone-hide sticky top-0 z-20 border-b border-blue-100/40 bg-blue-100/90 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#2F6B3D]/70">First Chord</p>
            <h1 className="fc-display flex items-center gap-2 text-2xl text-slate-900">
              Admin Dashboard
              <PawPrint className="h-5 w-5 shrink-0 fill-slate-900 text-slate-900" aria-label="Vince’s sign-off" />
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {session?.user?.email ? (
              <span className="rounded-full bg-white/80 px-3 py-1 text-sm text-slate-600 shadow-sm">{session.user.email}</span>
            ) : null}
            <AdminSignOutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 pb-5">
          <div className="flex flex-wrap items-center gap-3">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </div>
          <form action="/admin/students" className="flex min-w-0 items-center gap-2">
            <input
              type="search"
              name="q"
              placeholder="Find student"
              className="h-9 w-44 rounded-full border border-blue-200/70 bg-white/80 px-4 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white md:w-56"
            />
            <button
              type="submit"
              className="h-9 rounded-full border border-blue-200/70 bg-white/80 px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-white hover:text-slate-900"
            >
              Search
            </button>
          </form>
        </nav>
      </header>
      {/* No z-index here: a positive z-index makes <main> a stacking context that
          traps full-screen modal overlays (z-50) below the sticky header (z-20).
          `relative` (z-auto) keeps content above the decorative cloud via DOM order
          while letting overlays rise above the header. */}
      <main className="relative mx-auto max-w-7xl px-6 py-8">{children}</main>
      {/* Installed-PWA escape hatch: the header nav is hidden in standalone
          mode, so following a link (e.g. inbox → planning) would otherwise
          strand you with no way back */}
      <nav className="standalone-only fixed bottom-4 left-1/2 z-30 -translate-x-1/2 items-center gap-1 rounded-full border border-[#2F6B3D]/25 bg-white/90 px-2 py-1 shadow-lg backdrop-blur">
        <Link href="/admin/incoming-messages" className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-green-50 hover:text-[#2F6B3D]">Inbox</Link>
        <Link href="/admin/planning" className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-green-50 hover:text-[#2F6B3D]">Planning</Link>
        <Link href="/admin" className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-green-50 hover:text-[#2F6B3D]">Overview</Link>
      </nav>
    </div>
  );
}
