import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { saveCoverBankRecord } from '@/lib/admin/cover-bank';

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const tutorKey = `${body?.tutorKey || ''}`.trim();
  const tutorName = `${body?.tutorName || ''}`.trim();

  if (!tutorKey && !tutorName) {
    return Response.json({ error: 'tutorKey or tutorName is required' }, { status: 400 });
  }

  try {
    const state = await saveCoverBankRecord({
      tutorKey,
      tutorName,
      tutorType: body?.tutorType || '',
      phone: body?.phone || '',
      instruments: body?.instruments || [],
      callStatus: body?.callStatus || '',
      willing: body?.willing || '',
      notice: body?.notice || '',
      availableDays: body?.availableDays || [],
      notes: body?.notes || '',
      lastContactedAt: body?.lastContactedAt || '',
      updatedBy: session.user.email || '',
    });

    return Response.json({ success: true, state });
  } catch (error) {
    return Response.json({ error: error.message || 'Cover bank record save failed' }, { status: 500 });
  }
}
