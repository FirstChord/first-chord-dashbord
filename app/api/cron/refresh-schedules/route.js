import { getMmsStudentScheduleContext } from '@/lib/admin/mms';
import { getScheduleContextRows, upsertScheduleContextRow } from '@/lib/admin/sheets';
import { getOperationalAdminStudents } from '@/lib/admin/students';
import { buildScheduledRefreshTargets } from '@/lib/admin/capacity-helpers.mjs';

// Scheduled (cadence-based) refresh of student schedule caches, called by a
// GitHub Action cron every ~2 weeks. Secret-authenticated (mirrors the Practice
// Chat shared-secret pattern) since there is no admin session. Processes a
// bounded batch per call, sequentially, and reports how many are left so the
// caller can loop until the cohort is current — keeping cohort-wide MMS calls
// rare and explicit per the vendor-truth guardrail.
const MAX_PER_RUN = 80;
const DELAY_MS = 150;
const OLDER_THAN_DAYS = 10;

function clean(value = '') {
  return `${value || ''}`.trim();
}

function timingSafeEqualString(a = '', b = '') {
  const left = clean(a);
  const right = clean(b);
  if (!left || !right || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function POST(request) {
  const expectedSecret = clean(process.env.SCHEDULE_REFRESH_SECRET);
  if (!expectedSecret) {
    return Response.json({ error: 'SCHEDULE_REFRESH_SECRET is not configured' }, { status: 503 });
  }
  const providedSecret = request.headers.get('x-firstchord-schedule-secret') || '';
  if (!timingSafeEqualString(providedSecret, expectedSecret)) {
    return Response.json({ error: 'Invalid or missing schedule refresh secret' }, { status: 401 });
  }

  try {
    const [scheduleRows, operationalStudents] = await Promise.all([
      getScheduleContextRows(),
      getOperationalAdminStudents(),
    ]);
    const operationalMmsIds = operationalStudents.map((student) => student.mmsId).filter(Boolean);
    const targets = buildScheduledRefreshTargets(scheduleRows, operationalMmsIds, { olderThanDays: OLDER_THAN_DAYS });

    const batch = targets.slice(0, MAX_PER_RUN);
    const refreshed = [];
    const failed = [];
    for (const mmsId of batch) {
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
      processed: batch.length,
      refreshed: refreshed.length,
      failed,
      remaining: Math.max(0, targets.length - batch.length),
      olderThanDays: OLDER_THAN_DAYS,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Scheduled schedule refresh failed' }, { status: 500 });
  }
}
