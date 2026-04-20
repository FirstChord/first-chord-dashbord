import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getAdminStudents } from '@/lib/admin/students';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const students = await getAdminStudents();
  return Response.json({ students });
}
