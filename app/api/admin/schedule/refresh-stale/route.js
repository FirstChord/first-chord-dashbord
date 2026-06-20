import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getMmsStudentScheduleContext } from '@/lib/admin/mms';
import { upsertScheduleContextRow } from '@/lib/admin/sheets';

// Explicit, admin-triggered bulk refresh of stale/missing schedule caches. Only
// the IDs the admin asked for, sequential and capped, to stay gentle on MMS — no
// automatic cohort-wide polling (per the vendor-truth guardrail).
const MAX_PER_RUN = 60;
const DELAY_MS = 150;

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.mmsIds) ? [...new Set(body.mmsIds.filter(Boolean))] : [];
  if (!ids.length) {
    return Response.json({ error: 'No student IDs provided' }, { status: 400 });
  }

  const targets = ids.slice(0, MAX_PER_RUN);
  const refreshed = [];
  const failed = [];

  for (const mmsId of targets) {
    try {
      const scheduleContext = await getMmsStudentScheduleContext({ mmsId });
      await upsertScheduleContextRow(scheduleContext);
      refreshed.push(mmsId);
    } catch (error) {
      failed.push({ mmsId, error: error.message || 'Schedule refresh failed' });
    }
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  return Response.json({
    success: true,
    refreshed: refreshed.length,
    failed,
    capped: ids.length > MAX_PER_RUN,
    requested: ids.length,
  });
}
