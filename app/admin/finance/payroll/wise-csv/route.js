import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getTutorPayRows, getPayrollRunRows, getTutorWiseRows } from '@/lib/admin/sheets';
import { searchAttendanceForPayroll } from '@/lib/admin/mms';
import { parseTutorPay } from '@/lib/admin/cost-helpers.mjs';
import { buildPayrollPeriod, buildPayrollPreview, nextWednesday } from '@/lib/admin/payroll-helpers.mjs';
import { ADMIN_TUTORS } from '@/lib/admin/tutors-data';
import { parseTutorWise, buildWiseBatch, toWiseCsv } from '@/lib/admin/wise-helpers.mjs';

export const dynamic = 'force-dynamic';

// Generates the Wise batch-payment CSV for reviewed tutor pay rows. Auth-gated.
// The dashboard only produces the file — a human uploads + approves in Wise.
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return new Response('Not authorised', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const payDate = `${searchParams.get('payDate') || nextWednesday()}`.slice(0, 10);
  const teacherIds = Object.values(ADMIN_TUTORS).map((tutor) => tutor.teacherId).filter(Boolean);
  const fetchStart = new Date(new Date(`${payDate}T00:00:00Z`).getTime() - 35 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const fetchEnd = buildPayrollPeriod({ payDate, cadence: 'weekly' }).periodEnd;

  const [tutorPayRows, savedRuns, tutorWiseRows] = await Promise.all([
    getTutorPayRows(),
    getPayrollRunRows(),
    getTutorWiseRows(),
  ]);

  let attendanceRows = [];
  try {
    attendanceRows = await searchAttendanceForPayroll({
      startDate: fetchStart,
      endDate: fetchEnd,
      teacherIds,
      limit: 1000,
    });
  } catch (error) {
    return new Response(`Could not load MMS attendance: ${error.message || error}`, { status: 502 });
  }

  const preview = buildPayrollPreview({
    attendanceRows,
    tutorPay: parseTutorPay(tutorPayRows),
    savedRuns,
    overrides: {},
    payDate,
  });

  // Reviewed-row owed amounts come from the saved run, so window overrides
  // don't change them — building without overrides here is correct.
  const { csvRows } = buildWiseBatch({
    rows: preview.rows,
    wiseByKey: parseTutorWise(tutorWiseRows),
  });

  const csv = toWiseCsv(csvRows);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="wise-batch-${payDate}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
