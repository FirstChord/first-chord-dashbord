import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { scanLiveStripeIssues } from '@/lib/admin/issues';

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await scanLiveStripeIssues();
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message || 'Stripe scan failed' }, { status: 500 });
  }
}
