import { withAuth } from 'next-auth/middleware';
import { isAllowedAdminEmail } from '@/lib/admin/auth';

export default withAuth(
  function middleware() {},
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        if (pathname === '/admin/login') {
          return true;
        }

        if (pathname === '/api/admin/incoming-messages') {
          const configured = `${process.env.INCOMING_MESSAGE_INGEST_SECRET || ''}`.trim();
          const supplied = `${req.headers.get('x-firstchord-incoming-secret') || ''}`.trim();
          if (configured && supplied === configured) {
            return true;
          }
        }

        return Boolean(token?.email && isAllowedAdminEmail(token.email));
      },
    },
    pages: {
      signIn: '/admin/login',
    },
  }
);

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/finance', '/finance/:path*'],
};
