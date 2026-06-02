import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getMmsStudentScheduleContext } from '@/lib/admin/mms';
import { derivePauseCoverageContext } from '@/lib/admin/pause-helpers.mjs';
import { derivePaymentValueContext } from '@/lib/admin/payment-value-helpers.mjs';
import { getAdminStudentByMmsId } from '@/lib/admin/students';
import { upsertScheduleContextRow } from '@/lib/admin/sheets';

export async function POST(_request, { params }) {
  const session = await getServerSession(authOptions);
  const { mmsId } = await params;

  if (!session?.user?.isAdmin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const student = await getAdminStudentByMmsId(mmsId);

  if (!student) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const scheduleContext = await getMmsStudentScheduleContext({ mmsId });
    await upsertScheduleContextRow(scheduleContext);
    return Response.json({
      scheduleContext,
      paymentValueContext: derivePaymentValueContext({
        ...student,
        scheduleContext,
      }),
      pauseCoverageContext: derivePauseCoverageContext({
        pauseSummary: student.pauseSummary,
        scheduleContext,
      }),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Schedule refresh failed' }, { status: 500 });
  }
}
