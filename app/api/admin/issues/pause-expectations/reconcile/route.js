import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import {
  getPauseExpectationReconciliationPreview,
  reconcilePauseExpectations,
} from '@/lib/admin/pause-expectation-workflow';
import {
  executePauseExpectationPreview,
  executePauseExpectationReconciliation,
} from '@/lib/admin/pause-expectation-route-contract.mjs';

export const dynamic = 'force-dynamic';

async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  return session?.user?.isAdmin ? session : null;
}

export async function GET() {
  const session = await requireAdminSession();
  const result = await executePauseExpectationPreview({
    session,
    getPreview: getPauseExpectationReconciliationPreview,
  });
  return Response.json(result.body, { status: result.status, headers: result.headers });
}

export async function POST(request) {
  const session = await requireAdminSession();
  let payload = {};
  if (session) {
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }
  }

  const result = await executePauseExpectationReconciliation({
    session,
    payload,
    reconcile: reconcilePauseExpectations,
  });
  return Response.json(result.body, { status: result.status, headers: result.headers });
}
