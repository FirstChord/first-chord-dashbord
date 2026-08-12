'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV_ITEMS, getCurrentAdminNavHref } from '@/lib/admin/admin-navigation.mjs';

export default function AdminPrimaryNavigation() {
  const pathname = usePathname();
  const currentHref = getCurrentAdminNavHref(pathname);

  return (
    <ul className="flex min-w-0 items-center gap-2 overflow-x-auto">
      {ADMIN_NAV_ITEMS.map((item) => {
        const isCurrent = item.href === currentHref;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent ? 'page' : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center border-b-[3px] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6B3D]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-100 ${
                isCurrent
                  ? 'border-[#2F6B3D] text-[#2F6B3D]'
                  : 'border-transparent text-slate-700 hover:border-slate-300 hover:text-slate-950'
              }`}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
