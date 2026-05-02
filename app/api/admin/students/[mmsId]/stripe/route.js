import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getAdminStudentByMmsId } from '@/lib/admin/students';
import { getLiveStripeSnapshot } from '@/lib/admin/stripe';

export async function GET(_request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const student = await getAdminStudentByMmsId(params.mmsId);

  if (!student) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const result = await getLiveStripeSnapshot(student);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message || 'Stripe snapshot failed' }, { status: 500 });
  }
}
