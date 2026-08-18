/** @fileoverview NextAuth handler mounting the shared admin auth options on GET and POST. */
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/admin/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
