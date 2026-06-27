import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getPayrollRunRows, getTutorPayRows, upsertPayrollRunRow } from '@/lib/admin/sheets';
import { searchAttendanceForPayroll } from '@/lib/admin/mms';
import { parseTutorPay } from '@/lib/admin/cost-helpers.mjs';
import {
  buildPayrollPeriod,
  buildPayrollPreview,
  formatPayrollDate,
  nextWednesday,
} from '@/lib/admin/payroll-helpers.mjs';
import { ADMIN_TUTORS } from '@/lib/admin/tutors-data';
import { formatMoney } from '@/lib/admin/finance-helpers.mjs';

export const dynamic = 'force-dynamic';

async function savePayrollRunAction(formData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new Error('Not authorised');
  }

  const now = new Date().toISOString();
  const status = `${formData.get('status') || 'reviewed'}`.trim() === 'paid' ? 'paid' : 'reviewed';
  const existingCreatedAt = `${formData.get('created_at') || ''}`.trim();
  const expectedAmount = Number.parseFloat(`${formData.get('expected_amount') || '0'}`) || 0;
  const adjustmentAmount = Number.parseFloat(`${formData.get('adjustment_amount') || '0'}`) || 0;
  const finalAmount = Math.round((expectedAmount + adjustmentAmount) * 100) / 100;
  await upsertPayrollRunRow({
    payroll_id: `${formData.get('payroll_id') || ''}`.trim(),
    pay_date: `${formData.get('pay_date') || ''}`.trim(),
    period_start: `${formData.get('period_start') || ''}`.trim(),
    period_end: `${formData.get('period_end') || ''}`.trim(),
    tutor: `${formData.get('tutor') || ''}`.trim(),
    tutor_short_name: `${formData.get('tutor_short_name') || ''}`.trim(),
    teacher_id: `${formData.get('teacher_id') || ''}`.trim(),
    invoice_cadence: `${formData.get('invoice_cadence') || ''}`.trim(),
    pay_model: `${formData.get('pay_model') || ''}`.trim(),
    lesson_count: `${formData.get('lesson_count') || '0'}`.trim(),
    review_lesson_count: `${formData.get('review_lesson_count') || '0'}`.trim(),
    teaching_minutes: `${formData.get('teaching_minutes') || '0'}`.trim(),
    expected_amount: expectedAmount,
    adjustment_amount: adjustmentAmount,
    final_amount: finalAmount,
    status,
    invoice_status: `${formData.get('invoice_status') || ''}`.trim(),
    notes: `${formData.get('notes') || ''}`.trim(),
    reviewed_at: status === 'reviewed' ? now : `${formData.get('reviewed_at') || now}`.trim(),
    reviewed_by: status === 'reviewed' ? session.user.email || '' : `${formData.get('reviewed_by') || session.user.email || ''}`.trim(),
    paid_at: status === 'paid' ? now : `${formData.get('paid_at') || ''}`.trim(),
    paid_by: status === 'paid' ? session.user.email || '' : `${formData.get('paid_by') || ''}`.trim(),
    source: 'mms_attendance_preview',
    created_at: existingCreatedAt || now,
    updated_at: now,
  });

  revalidatePath('/admin/finance/payroll');
}

function minutesLabel(minutes) {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m ? ` ${m}m` : ''}`;
}

function statusClass(status) {
  if (status === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'reviewed') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function SlotList({ title, slots = [], empty = 'None' }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {slots.length ? (
        <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
          {slots.slice(0, 6).map((slot) => (
            <li key={`${slot.eventId || slot.startAt}-${slot.state}`} className="rounded-xl bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">{formatPayrollDate(slot.startAt, { withTime: true })}</span>
              {' · '}
              {slot.durationMinutes || '?'} mins
              {slot.studentCount > 1 ? ` · group of ${slot.studentCount}` : ''}
              {slot.isCover ? ' · cover' : ''}
              {' · '}
              {slot.students.map((student) => student.studentName).filter(Boolean).join(', ') || 'Student unknown'}
              {slot.amount !== null ? ` · ${formatMoney(slot.amount)}` : ' · unpriced'}
            </li>
          ))}
          {slots.length > 6 ? <li className="text-slate-400">+ {slots.length - 6} more</li> : null}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-400">{empty}</p>
      )}
    </div>
  );
}

function PayrollTutorCard({ row }) {
  const calculatedFinal = Math.round((row.expectedAmount + row.adjustmentAmount) * 100) / 100;
  const owed = row.owedAmount ?? (row.status === 'paid' ? 0 : (row.finalAmount || calculatedFinal));
  return (
    <article className="rounded-[1.4rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{row.tutor}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
              {row.status}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
              {row.invoiceCadence}
            </span>
            {row.payModel === 'salary' ? (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs text-violet-700">salary</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatPayrollDate(row.periodStart)} - {formatPayrollDate(row.periodEnd)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-slate-900">{formatMoney(owed)}</p>
          {row.status === 'paid' ? (
            <p className="text-xs text-emerald-700">paid {formatMoney(row.finalAmount)}{row.paidAt ? ` · ${formatPayrollDate(row.paidAt)}` : ''}</p>
          ) : (
            <p className="text-xs text-slate-500">{row.lessonCount} payable · {minutesLabel(row.teachingMinutes)}</p>
          )}
        </div>
      </div>

      {row.reviewLessonCount ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {row.reviewLessonCount} lesson{row.reviewLessonCount === 1 ? '' : 's'} need attendance review before this figure should be trusted.
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SlotList title="Payable from MMS attendance" slots={row.payableSlots} empty="No payable lessons found for this period." />
        <SlotList title="Needs review" slots={row.reviewSlots} empty="No unrecorded/unclear lessons." />
      </div>

      <form action={savePayrollRunAction} className="mt-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]">
        {[
          ['payroll_id', row.payrollId],
          ['pay_date', row.payDate],
          ['period_start', row.periodStart],
          ['period_end', row.periodEnd],
          ['tutor', row.tutor],
          ['tutor_short_name', row.tutorShortName],
          ['teacher_id', row.teacherId],
          ['invoice_cadence', row.invoiceCadence],
          ['pay_model', row.payModel],
          ['lesson_count', row.lessonCount],
          ['review_lesson_count', row.reviewLessonCount],
          ['teaching_minutes', row.teachingMinutes],
          ['expected_amount', row.expectedAmount],
          ['reviewed_at', row.reviewedAt],
          ['reviewed_by', row.reviewedBy],
          ['paid_at', row.paidAt],
          ['paid_by', row.paidBy],
          ['created_at', row.createdAt],
        ].map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value ?? ''} />
        ))}
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Invoice</span>
          <select name="invoice_status" defaultValue={row.invoiceStatus || ''} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">Not checked</option>
            <option value="received">Received</option>
            <option value="missing">Missing</option>
            <option value="not_needed">Not needed</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Adjustment</span>
          <input name="adjustment_amount" type="number" step="0.01" defaultValue={row.adjustmentAmount || 0} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        </label>
        <label className="block md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Notes</span>
          <input name="notes" defaultValue={row.notes || ''} placeholder="Invoice note, manual correction, checked against MMS..." className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
        </label>
        <div className="flex items-end gap-2">
          <button name="status" value="reviewed" className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
            Mark reviewed
          </button>
          <button name="status" value="paid" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            Mark paid
          </button>
        </div>
      </form>
    </article>
  );
}

export default async function AdminPayrollPage({ searchParams }) {
  const params = (await searchParams) || {};
  const payDate = `${params.payDate || nextWednesday()}`.slice(0, 10);
  const teacherIds = Object.values(ADMIN_TUTORS).map((tutor) => tutor.teacherId).filter(Boolean);
  // Fetch the widest supported window (3 weeks) so three-weekly tutors are covered.
  const fetchStart = buildPayrollPeriod({ payDate, cadence: 'three-weekly' }).periodStart;
  const fetchEnd = buildPayrollPeriod({ payDate, cadence: 'weekly' }).periodEnd;

  const [tutorPayRows, savedRuns] = await Promise.all([
    getTutorPayRows(),
    getPayrollRunRows(),
  ]);

  let attendanceRows = [];
  let loadError = '';
  try {
    attendanceRows = await searchAttendanceForPayroll({
      startDate: fetchStart,
      endDate: fetchEnd,
      teacherIds,
      limit: 1000,
    });
  } catch (error) {
    loadError = error.message || 'Could not load MMS attendance for payroll.';
  }

  const preview = buildPayrollPreview({
    attendanceRows,
    tutorPay: parseTutorPay(tutorPayRows),
    savedRuns,
    payDate,
  });
  const activeRows = preview.rows.filter((row) => row.payModel !== 'salary' || row.lessonCount || row.reviewLessonCount || row.status !== 'draft');

  return (
    <div className="space-y-8">
      <header>
        <Link href="/admin/finance" className="text-sm font-medium text-blue-700">← Finance</Link>
        <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-500">Internal · approval first</p>
        <h2 className="mt-2 text-3xl font-bold uppercase tracking-wide text-slate-800">Payroll review</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          A Wednesday reconciliation surface for tutor pay. It reads MMS attendance, estimates expected pay from
          `Tutor_Pay`, then lets Tom/Finn mark rows reviewed or paid. Use MMS side-by-side until the figures are trusted.
        </p>
      </header>

      <section className="rounded-[1.6rem] border border-blue-100 bg-white/90 p-5 shadow-sm">
        <form className="flex flex-wrap items-end gap-3">
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pay date</span>
            <input type="date" name="payDate" defaultValue={payDate} className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          </label>
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Load payroll</button>
          <p className="text-sm text-slate-500">
            Weekly tutors: {formatPayrollDate(buildPayrollPeriod({ payDate, cadence: 'weekly' }).periodStart)} - {formatPayrollDate(buildPayrollPeriod({ payDate, cadence: 'weekly' }).periodEnd)}.
            {' '}Each tutor&apos;s window comes from their `Tutor_Pay` cadence (weekly / biweekly / three-weekly, up to 21 days back: {formatPayrollDate(fetchStart)}).
          </p>
        </form>
      </section>

      {loadError ? (
        <section className="rounded-[1.6rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          MMS payroll attendance could not be loaded: {loadError}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
          <p className="text-sm text-slate-500">Outstanding to pay</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(preview.totals.outstandingAmount)}</p>
          <p className="mt-1 text-xs text-slate-500">{formatMoney(preview.totals.expectedAmount)} expected before paid</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
          <p className="text-sm text-slate-500">Payable lessons</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{preview.totals.lessonCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">Needs review</p>
          <p className="mt-1 text-2xl font-semibold text-amber-950">{preview.totals.reviewLessonCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
          <p className="text-sm text-slate-500">Reviewed / paid</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{preview.totals.reviewedCount} / {preview.totals.paidCount}</p>
        </div>
      </section>

      <section className="space-y-4">
        {activeRows.length ? activeRows.map((row) => (
          <PayrollTutorCard key={row.payrollId} row={row} />
        )) : (
          <div className="rounded-[1.6rem] border border-slate-200 bg-white/90 p-6 text-sm text-slate-500">
            No payroll rows found for this period.
          </div>
        )}
      </section>
    </div>
  );
}
