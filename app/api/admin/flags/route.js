import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getReviewFlagsRows } from '@/lib/admin/sheets';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const flags = await getReviewFlagsRows();
  return Response.json({ flags });
}
