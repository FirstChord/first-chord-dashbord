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
import AdjustWindowForm from './adjust-window-form';

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

function SlotLine({ slot }) {
  return (
    <li className="rounded-xl bg-slate-50 px-3 py-2">
      <span className="font-medium text-slate-800">{formatPayrollDate(slot.startAt, { withTime: true })}</span>
      {' · '}
      {slot.durationMinutes || '?'} mins
      {slot.studentCount > 1 ? ` · group of ${slot.studentCount}` : ''}
      {slot.isCover ? ' · cover' : ''}
      {(slot.state !== 'payable' || slot.isPaidAbsence) && slot.statusLabel ? ` · ${slot.statusLabel}` : ''}
      {' · '}
      {slot.students.map((student) => student.studentName).filter(Boolean).join(', ') || 'Student unknown'}
      {slot.amount !== null ? ` · ${formatMoney(slot.amount)}` : ' · unpriced'}
    </li>
  );
}

function SlotListBody({ slots = [], empty = 'None' }) {
  const first = slots.slice(0, 6);
  const rest = slots.slice(6);
  if (!slots.length) {
    return <p className="mt-2 text-xs text-slate-400">{empty}</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
      {first.map((slot) => (
        <SlotLine key={`${slot.eventId || slot.startAt}-${slot.studentCount}-${slot.state}`} slot={slot} />
      ))}
      {rest.length ? (
        <li>
          <details className="group">
            <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-2 text-slate-500 hover:bg-slate-200">
              + {rest.length} more <span className="group-open:hidden">(show)</span><span className="hidden group-open:inline">(hide)</span>
            </summary>
            <ul className="mt-1.5 space-y-1.5">
              {rest.map((slot) => (
                <SlotLine key={`${slot.eventId || slot.startAt}-${slot.studentCount}-${slot.state}`} slot={slot} />
              ))}
            </ul>
          </details>
        </li>
      ) : null}
    </ul>
  );
}

function SlotList({ title, slots = [], empty = 'None', note = '' }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {note ? <p className="mt-1 text-[0.7rem] leading-4 text-slate-400">{note}</p> : null}
      <SlotListBody slots={slots} empty={empty} />
    </div>
  );
}

// Quiet, collapsed-by-default version for lists the dashboard is confident about
// (payable from MMS, absent/cancelled) — the card should lead with what needs review.
function CollapsibleSlotList({ title, slots = [], empty = 'None', note = '' }) {
  return (
    <details className="group rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {title}{slots.length ? ` (${slots.length})` : ''}
        </span>
        <span className="text-[0.7rem] uppercase tracking-wide text-slate-400">
          <span className="group-open:hidden">show</span>
          <span className="hidden group-open:inline">hide</span>
        </span>
      </summary>
      {note ? <p className="mt-2 text-[0.7rem] leading-4 text-slate-400">{note}</p> : null}
      <SlotListBody slots={slots} empty={empty} />
    </details>
  );
}

function PayrollTutorCard({ row, payDate }) {
  const calculatedFinal = Math.round((row.expectedAmount + row.adjustmentAmount) * 100) / 100;
  const owed = row.owedAmount ?? (row.status === 'paid' ? 0 : (row.finalAmount || calculatedFinal));
  const basisLabel = { since_paid: 'since last paid', first_run: 'default window', override: 'custom window' }[row.windowBasis] || row.windowBasis || '';
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
            {formatPayrollDate(row.periodStart)} - {formatPayrollDate(row.periodEnd)} · {row.windowDays} days{basisLabel ? ` · ${basisLabel}` : ''}{row.windowEndCustom ? ' · custom end' : ''}
          </p>
          <AdjustWindowForm payDate={payDate} tutor={row.tutorShortName} start={row.periodStart} end={row.periodEnd} />
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

      {row.overlapsPaid ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          ⚠ This window overlaps an already-paid period ({formatPayrollDate(row.overlapsPaid.periodStart)} - {formatPayrollDate(row.overlapsPaid.periodEnd)}). Risk of double-paying — move the window start forward.
        </div>
      ) : null}
      {row.windowEmpty ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Already paid through {formatPayrollDate(row.lastPaidThrough)} — nothing outstanding for this pay date.
        </div>
      ) : null}
      {row.windowCapped ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Window capped at 35 days back. If this invoice covers more, set a custom window start.
        </div>
      ) : null}
      {row.reviewLessonCount ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {row.reviewLessonCount} lesson{row.reviewLessonCount === 1 ? '' : 's'} need attendance review before this figure should be trusted.
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {/* Lead with the open loop — the only thing that needs a human. */}
        <SlotList title="Needs review" slots={row.reviewSlots} empty="Nothing to review — every lesson in this window is recorded." />

        {/* Confident lists collapsed by default to keep the card calm. */}
        <CollapsibleSlotList
          title="Payable from MMS attendance"
          slots={row.payableSlots}
          empty="No payable lessons found for this period."
        />
        {row.excludedSlots?.length ? (
          <CollapsibleSlotList
            title="Not counted — absent / cancelled"
            slots={row.excludedSlots}
            note="Marked absent or cancelled in MMS, so currently £0. Practice-video / paid-absence lessons sit here — the £ shown is what they would pay if payable."
            empty="None."
          />
        ) : null}
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
  // Fetch the full max look-back (since-last-paid catch-up can reach back up to 5 weeks).
  const fetchStart = new Date(new Date(`${payDate}T00:00:00Z`).getTime() - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fetchEnd = buildPayrollPeriod({ payDate, cadence: 'weekly' }).periodEnd;
  // Per-tutor window override: ?tutor=<shortName>&start=<YYYY-MM-DD>&end=<YYYY-MM-DD>
  // (one tutor at a time). end lets an invoice that closes earlier in the week stop short.
  const overrides = params.tutor && (params.start || params.end)
    ? { [`${params.tutor}`]: { start: `${params.start || ''}`.slice(0, 10), end: `${params.end || ''}`.slice(0, 10) } }
    : {};

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
    overrides,
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
          <PayrollTutorCard key={row.payrollId} row={row} payDate={payDate} />
        )) : (
          <div className="rounded-[1.6rem] border border-slate-200 bg-white/90 p-6 text-sm text-slate-500">
            No payroll rows found for this period.
          </div>
        )}
      </section>
    </div>
  );
}
