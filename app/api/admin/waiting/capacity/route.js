import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getWaitingStudentsWithCapacity } from '@/lib/admin/waiting-capacity';

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await getWaitingStudentsWithCapacity({ forceRefreshSlots: true, throwOnSlotError: true });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to refresh waiting capacity' }, { status: 500 });
  }
}
