'use client';

import { signIn, signOut } from 'next-auth/react';

export function AdminSignInButton({ disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => signIn('google', { callbackUrl: '/admin' })}
      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      Sign in with Google
    </button>
  );
}

export function AdminSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/admin/login' })}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
    >
      Sign out
    </button>
  );
}
