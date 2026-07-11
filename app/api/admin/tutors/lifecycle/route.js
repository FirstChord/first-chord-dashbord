import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getTutorOffboardingContext, saveTutorLifecycle } from '@/lib/admin/tutor-lifecycle.mjs';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const teacherId = new URL(request.url).searchParams.get('teacherId') || '';
  const context = await getTutorOffboardingContext({ teacherId });
  if (!context) return Response.json({ error: 'Tutor not found' }, { status: 404 });
  return Response.json(context);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid lifecycle request' }, { status: 400 });
  }

  try {
    const tutor = await saveTutorLifecycle({
      ...payload,
      actorEmail: session.user.email || '',
    });
    return Response.json({ success: true, tutor });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not save tutor lifecycle' }, { status: 400 });
  }
}
