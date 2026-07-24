'use client';

import { signIn, signOut } from 'next-auth/react';

export function TutorSignInButton({ disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
      className="inline-flex w-full items-center justify-center rounded-xl bg-[#2F6B3D] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245230] disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      Sign in with Google
    </button>
  );
}

export function TutorSignOutButton({ className = '' }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/tutor/login' })}
      className={className}
    >
      Sign out
    </button>
  );
}
