import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/admin/auth';
import { updatePayrollAttendanceStatus } from '@/lib/admin/mms';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const result = await updatePayrollAttendanceStatus({
      studentId: `${body.studentId || ''}`.trim(),
      eventId: `${body.eventId || ''}`.trim(),
      attendanceId: `${body.attendanceId || ''}`.trim(),
      attendanceStatus: `${body.attendanceStatus || ''}`.trim(),
    });
    revalidatePath('/admin/finance/payroll');
    return Response.json(result);
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Attendance update failed' }, { status: 400 });
  }
}
