import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getPayrollRunRows, getTutorWiseRows } from '@/lib/admin/sheets';
import { nextWednesday } from '@/lib/admin/payroll-helpers.mjs';
import { parseTutorWise, buildWiseBatch, selectPayableReviewedRuns, toWiseCsv } from '@/lib/admin/wise-helpers.mjs';

export const dynamic = 'force-dynamic';

// Generates the Wise batch-payment CSV for reviewed tutor pay rows. Auth-gated.
// The dashboard only produces the file — a human uploads + approves in Wise.
//
// Built straight from the saved reviewed Payroll_Runs rows (not a re-resolved
// preview), so the CSV reflects exactly what's been reviewed regardless of the
// window each row was reviewed under, and re-downloading after reviewing more
// always includes them. payDate is kept only for the download filename.
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return new Response('Not authorised', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const payDate = `${searchParams.get('payDate') || nextWednesday()}`.slice(0, 10);

  const [savedRuns, tutorWiseRows] = await Promise.all([
    getPayrollRunRows(),
    getTutorWiseRows(),
  ]);

  const { rows } = selectPayableReviewedRuns(savedRuns);
  const { csvRows } = buildWiseBatch({
    rows,
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
