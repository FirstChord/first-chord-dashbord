import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getWaitingStudents } from '@/lib/admin/mms';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const students = await getWaitingStudents();
    return Response.json({ students });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to load waiting list' }, { status: 500 });
  }
}
