/** @fileoverview NextAuth Google configuration and the allowlist deciding which emails get admin or tutor dashboard access. */
import GoogleProvider from 'next-auth/providers/google';
import { getTutorDashboardAccessForEmail } from '@/lib/tutor-auth-helpers.mjs';

function getAllowedEmails() {
  return (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email) {
  if (!email) return false;
  return getAllowedEmails().includes(email.toLowerCase());
}

export function isAllowedGoogleSignInEmail(email) {
  const isAdmin = isAllowedAdminEmail(email);
  return isAdmin || getTutorDashboardAccessForEmail(email, { isAdmin }).authorized;
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          // Always show Google's account chooser — on phones Google otherwise
          // silently reuses the default signed-in account, which locks out
          // anyone whose admin email isn't their device default.
          prompt: 'select_account',
        },
      },
    }),
  ],
  pages: {
    signIn: '/admin/login',
  },
  callbacks: {
    async signIn({ user }) {
      return isAllowedGoogleSignInEmail(user?.email);
    },
    async session({ session }) {
      if (session?.user?.email) {
        const isAdmin = isAllowedAdminEmail(session.user.email);
        session.user.isAdmin = isAdmin;
        session.user.tutorDashboard = getTutorDashboardAccessForEmail(
          session.user.email,
          { isAdmin },
        );
      }
      return session;
    },
    async jwt({ token }) {
      if (token?.email) {
        const isAdmin = isAllowedAdminEmail(token.email);
        token.isAdmin = isAdmin;
        token.tutorDashboard = getTutorDashboardAccessForEmail(
          token.email,
          { isAdmin },
        );
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
};

export function getAdminAuthConfigStatus() {
  return {
    hasGoogleClientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    hasGoogleClientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
    allowedEmails: getAllowedEmails(),
  };
}
