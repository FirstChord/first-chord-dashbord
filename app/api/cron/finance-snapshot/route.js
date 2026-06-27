import { getOperationalAdminStudents } from '@/lib/admin/students';
import {
  getScheduleContextRows,
  getTutorPayRows,
  getExpenseRows,
  getExpenseLogRows,
  getWaitingListStateRows,
  getStudentsArchiveRows,
  appendFinanceSnapshotRow,
} from '@/lib/admin/sheets';
import { enrichScheduleContextsWithSharedSlots } from '@/lib/admin/schedule-context-helpers.mjs';
import { parseTutorPay } from '@/lib/admin/cost-helpers.mjs';
import { countDatesInRange, onboardedDatesFromWaitingState, leftDatesFromArchive } from '@/lib/admin/roster-movement.mjs';
import { buildFinanceOverview, buildFinanceSnapshotRow } from '@/lib/admin/finance-helpers.mjs';

// Append-only finance run-rate snapshot, called by a GitHub Action cron (weekly +
// monthly). Secret-authenticated (mirrors the schedule-refresh pattern) since there is
// no admin session. Read-only over the data already loaded; the only write is the
// append to Finance_Snapshot. Builds the seasonal time series (e.g. summer drop-off).

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
  const expectedSecret = clean(process.env.FINANCE_SNAPSHOT_SECRET);
  if (!expectedSecret) {
    return Response.json({ error: 'FINANCE_SNAPSHOT_SECRET is not configured' }, { status: 503 });
  }
  const providedSecret = request.headers.get('x-firstchord-finance-secret') || '';
  if (!timingSafeEqualString(providedSecret, expectedSecret)) {
    return Response.json({ error: 'Invalid or missing finance snapshot secret' }, { status: 401 });
  }

  const url = new URL(request.url);
  const periodType = clean(url.searchParams.get('period')).toLowerCase() === 'monthly' ? 'monthly' : 'weekly';

  try {
    const [students, scheduleRows, tutorPayRows, expenseRows, expenseLogRows, waitingStateRows, archiveRows] = await Promise.all([
      getOperationalAdminStudents(),
      getScheduleContextRows(),
      getTutorPayRows(),
      getExpenseRows(),
      getExpenseLogRows(),
      getWaitingListStateRows(),
      getStudentsArchiveRows(),
    ]);
    const scheduleByMmsId = enrichScheduleContextsWithSharedSlots(scheduleRows);
    const enriched = students.map((student) => ({
      ...student,
      scheduleContext: scheduleByMmsId.get(student.mmsId) || student.scheduleContext || null,
    }));
    const tutorPay = parseTutorPay(tutorPayRows);
    const overview = buildFinanceOverview(enriched, { tutorPay, expenseRows, expenseLogRows });

    // Gross roster flows during this period (weekly = trailing 7 days, monthly = trailing month).
    const now = new Date();
    const fromISO = new Date(now.getTime() - (periodType === 'monthly' ? 31 : 7) * 24 * 60 * 60 * 1000).toISOString();
    const roster = {
      onboarded: countDatesInRange(onboardedDatesFromWaitingState(waitingStateRows), { fromISO, toISO: now.toISOString() }),
      left: countDatesInRange(leftDatesFromArchive(archiveRows), { fromISO, toISO: now.toISOString() }),
    };
    const row = buildFinanceSnapshotRow(overview, { periodType, roster });
    await appendFinanceSnapshotRow(row);

    return Response.json({
      success: true,
      periodType,
      snapshotId: row.snapshot_id,
      activeCount: row.active_count,
      revenueMonthly: row.active_monthly_revenue,
      marginMonthly: row.margin_monthly,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Finance snapshot failed' }, { status: 500 });
  }
}
