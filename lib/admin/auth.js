import GoogleProvider from 'next-auth/providers/google';

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

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  pages: {
    signIn: '/admin/login',
  },
  callbacks: {
    async signIn({ user }) {
      return isAllowedAdminEmail(user?.email);
    },
    async session({ session }) {
      if (session?.user?.email) {
        session.user.isAdmin = isAllowedAdminEmail(session.user.email);
      }
      return session;
    },
    async jwt({ token }) {
      if (token?.email) {
        token.isAdmin = isAllowedAdminEmail(token.email);
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
