import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { recordTutorStatementSent } from '@/lib/admin/tutor-statement';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const result = await recordTutorStatementSent({
    payrollId: body.payrollId,
    actorEmail: session.user.email || '',
  });
  if (!result.ok) {
    return Response.json({ ok: false, error: 'Could not mark this statement sent.' }, { status: 400 });
  }
  return Response.json(result);
}
