import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { deleteRegistryEntry } from '@/lib/admin/registry';

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueType } = await request.json();

  if (issueType !== 'REGISTRY ONLY') {
    return Response.json({ error: 'Delete is only supported for REGISTRY ONLY issues right now.' }, { status: 400 });
  }

  try {
    const result = await deleteRegistryEntry(params.mmsId);
    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json({ error: error.message || 'Delete failed' }, { status: 500 });
  }
}
