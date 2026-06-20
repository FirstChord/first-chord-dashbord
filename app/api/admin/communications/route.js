import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getCommunicationLog, logCommunication } from '@/lib/admin/communications';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return Response.json({ success: true, log: await getCommunicationLog() });
  } catch (error) {
    return Response.json({ error: error.message || 'Communication log load failed' }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const result = await logCommunication({
      category: body?.category,
      channel: body?.channel,
      mmsId: body?.mmsId,
      studentName: body?.studentName,
      body: body?.body,
      source: body?.source,
      actorEmail: session.user.email || '',
    });
    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message || 'Communication log write failed' }, { status: 500 });
  }
}
