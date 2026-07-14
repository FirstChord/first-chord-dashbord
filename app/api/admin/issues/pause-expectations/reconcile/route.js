import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import {
  getPauseExpectationReconciliationPreview,
  reconcilePauseExpectations,
} from '@/lib/admin/issues';

export const dynamic = 'force-dynamic';

async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  return session?.user?.isAdmin ? session : null;
}

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return Response.json(await getPauseExpectationReconciliationPreview(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Pause expectation preview failed' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await requireAdminSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  if (payload.confirm !== true) {
    return Response.json(
      { error: 'Explicit confirmation is required before changing payment expectations' },
      { status: 400 },
    );
  }

  try {
    const result = await reconcilePauseExpectations({
      actorEmail: session.user.email || '',
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message || 'Pause expectation reconciliation failed' }, { status: 500 });
  }
}
