import ScopeBadge from '@/components/admin/ui/ScopeBadge';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/admin/auth';
import { getPauseHistoryRows, getPayrollRunRows, getStudentsSheetRows, getTutorPayRows, getTutorWiseRows, upsertPayrollRunRow } from '@/lib/admin/sheets';
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
import { parseTutorWise, buildWiseBatch, selectPayableReviewedRuns } from '@/lib/admin/wise-helpers.mjs';
import { getPayrollWorkflowState, hasMaterialTutorStatementChange } from '@/lib/admin/payroll-workflow-helpers.mjs';
import { findPauseHistoryCoverageForLesson } from '@/lib/admin/pause-helpers.mjs';
import AdjustWindowForm from './adjust-window-form';
import WisePayoutPanel from './wise-payout-panel';
import PayrollSaveButtons from './save-buttons';
import TutorSelector from './tutor-selector';
import AttendanceDecision from './attendance-decision';

export const dynamic = 'force-dynamic';

async function savePayrollRunAction(formData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new Error('Not authorised');
  }

  const now = new Date().toISOString();
  // Individual cards can lock/review a figure, but never originate a payment.
  // Only the audited batch action marks reviewed rows paid.
  const status = `${formData.get('existing_status') || ''}`.trim() === 'paid' ? 'paid' : 'reviewed';
  const existingCreatedAt = `${formData.get('created_at') || ''}`.trim();
  const expectedAmount = Number.parseFloat(`${formData.get('expected_amount') || '0'}`) || 0;
  const adjustmentAmount = Number.parseFloat(`${formData.get('adjustment_amount') || '0'}`) || 0;
  const finalAmount = Math.round((expectedAmount + adjustmentAmount) * 100) / 100;
  const payrollId = `${formData.get('payroll_id') || ''}`.trim();
  const paymentRoute = `${formData.get('payment_route') || 'normal'}`.trim() === 'confirmation' ? 'confirmation' : 'normal';
  const nextStatement = {
    period_start: `${formData.get('period_start') || ''}`.trim(),
    period_end: `${formData.get('period_end') || ''}`.trim(),
    lesson_count: `${formData.get('lesson_count') || '0'}`.trim(),
    teaching_minutes: `${formData.get('teaching_minutes') || '0'}`.trim(),
    expected_amount: expectedAmount,
    adjustment_amount: adjustmentAmount,
    final_amount: finalAmount,
    payment_route: paymentRoute,
  };
  const existingRuns = await getPayrollRunRows();
  const existingRun = existingRuns.find((row) => `${row.payroll_id ?? row.payrollId ?? ''}`.trim() === payrollId) || null;
  const statementChanged = status === 'reviewed'
    && existingRun
    && hasMaterialTutorStatementChange(existingRun, nextStatement);
  const reviewedAt = statementChanged || !`${formData.get('reviewed_at') || ''}`.trim()
    ? now
    : `${formData.get('reviewed_at') || now}`.trim();
  await upsertPayrollRunRow({
    payroll_id: payrollId,
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
    payment_route: paymentRoute,
    statement_sent_at: statementChanged ? '' : `${formData.get('statement_sent_at') || ''}`.trim(),
    statement_sent_by: statementChanged ? '' : `${formData.get('statement_sent_by') || ''}`.trim(),
    notes: `${formData.get('notes') || ''}`.trim(),
    reviewed_at: status === 'reviewed' ? reviewedAt : `${formData.get('reviewed_at') || now}`.trim(),
    reviewed_by: status === 'reviewed' ? session.user.email || '' : `${formData.get('reviewed_by') || session.user.email || ''}`.trim(),
    paid_at: status === 'paid' ? `${formData.get('paid_at') || now}`.trim() : '',
    paid_by: status === 'paid' ? `${formData.get('paid_by') || session.user.email || ''}`.trim() : '',
    tutor_response: statementChanged ? '' : `${formData.get('tutor_response') || ''}`.trim(),
    tutor_responded_at: statementChanged ? '' : `${formData.get('tutor_responded_at') || ''}`.trim(),
    tutor_note: statementChanged ? '' : `${formData.get('tutor_note') || ''}`.trim(),
    source: 'mms_attendance_preview',
    created_at: existingCreatedAt || now,
    updated_at: now,
  });

  revalidatePath('/admin/finance/payroll');
}

// Flip exactly the reviewed rows that were in the Wise batch to paid, in one go.
// Operates on the persisted Payroll_Runs rows by id; only reviewed rows flip,
// so a draft/already-paid row can't be caught up by accident.
async function markBatchPaidAction(formData) {
  'use server';

  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    throw new Error('Not authorised');
  }

  const ids = `${formData.get('payrollIds') || ''}`
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) return;

  const now = new Date().toISOString();
  const existing = await getPayrollRunRows();
  const byId = new Map(existing.map((row) => [`${row.payroll_id ?? ''}`.trim(), row]));

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    if (`${row.status ?? ''}`.trim() !== 'reviewed') continue;
    await upsertPayrollRunRow({
      ...row,
      status: 'paid',
      paid_at: now,
      paid_by: session.user.email || '',
      updated_at: now,
    });
  }

  revalidatePath('/admin/finance/payroll');
}

function minutesLabel(minutes) {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m ? ` ${m}m` : ''}`;
}

function pickSheetValue(row, keys) {
  for (const key of keys) {
    const value = `${row?.[key] || ''}`.trim();
    if (value) return value;
  }
  return '';
}

function addPauseEvidenceToPayrollRows(rows = [], studentRows = [], pauseRows = []) {
  const studentsById = new Map(studentRows.map((student) => {
    const mmsId = pickSheetValue(student, ['mms_id', 'MMS ID', 'MMS Id', 'Student ID']);
    return [mmsId, {
      studentName: [pickSheetValue(student, ['Student forename']), pickSheetValue(student, ['Student Surname'])].filter(Boolean).join(' '),
      email: pickSheetValue(student, ['Email']),
      stripeSubscriptionId: pickSheetValue(student, ['stripe_subscription_id']),
    }];
  }).filter(([mmsId]) => mmsId));

  return rows.map((row) => ({
    ...row,
    reviewSlots: (row.reviewSlots || []).map((slot) => ({
      ...slot,
      students: (slot.students || []).map((student) => {
        const context = studentsById.get(student.studentId) || {};
        return {
          ...student,
          pauseEvidence: findPauseHistoryCoverageForLesson({
            studentEmail: context.email || '',
            studentName: context.studentName || student.studentName || '',
            stripeSubscriptionId: context.stripeSubscriptionId || '',
            lessonDate: slot.lessonDate,
            pauseRows,
          }),
        };
      }),
    })),
  }));
}

function mmsStudentUrl(studentId) {
  // #AttendanceNotes opens the student's attendance log directly — where the
  // unrecorded lesson gets marked.
  return `https://app.mymusicstaff.com/Teacher/v2/en/students/details?id=${encodeURIComponent(studentId)}#AttendanceNotes`;
}

// Deep links into MMS so an unrecorded lesson can be fixed at source (MMS owns
// attendance) without the dashboard ever writing it.
function FixInMms({ slot }) {
  const students = (slot.students || []).filter((student) => student.studentId);
  if (!students.length) return null;
  const labelEach = students.length > 1;
  return (
    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {students.map((student) => (
        <a
          key={student.studentId}
          href={mmsStudentUrl(student.studentId)}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 underline decoration-dotted underline-offset-2 hover:text-blue-900"
        >
          Fix {labelEach ? `${student.studentName || 'student'} ` : ''}in MMS ↗
        </a>
      ))}
    </span>
  );
}

function SlotLine({ slot, withFix = false, withDecision = false }) {
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
      {withFix ? <FixInMms slot={slot} /> : null}
      {withDecision ? slot.students
        .filter((student) => `${student.status || ''}`.trim().toLowerCase() === 'unrecorded')
        .map((student) => (
          <AttendanceDecision
            key={student.attendanceId || student.studentId}
            studentId={student.studentId}
            studentName={student.studentName}
            eventId={slot.eventId}
            attendanceId={student.attendanceId}
            pauseEvidence={student.pauseEvidence || null}
          />
        )) : null}
    </li>
  );
}

function SlotListBody({ slots = [], empty = 'None', withFix = false, withDecision = false }) {
  const first = slots.slice(0, 6);
  const rest = slots.slice(6);
  if (!slots.length) {
    return <p className="mt-2 text-xs text-slate-400">{empty}</p>;
  }
  return (
    <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
      {first.map((slot) => (
        <SlotLine key={`${slot.eventId || slot.startAt}-${slot.studentCount}-${slot.state}`} slot={slot} withFix={withFix} withDecision={withDecision} />
      ))}
      {rest.length ? (
        <li>
          <details className="group">
            <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-2 text-slate-500 hover:bg-slate-200">
              + {rest.length} more <span className="group-open:hidden">(show)</span><span className="hidden group-open:inline">(hide)</span>
            </summary>
            <ul className="mt-1.5 space-y-1.5">
              {rest.map((slot) => (
                <SlotLine key={`${slot.eventId || slot.startAt}-${slot.studentCount}-${slot.state}`} slot={slot} withFix={withFix} withDecision={withDecision} />
              ))}
            </ul>
          </details>
        </li>
      ) : null}
    </ul>
  );
}

function SlotList({ title, slots = [], empty = 'None', note = '', withFix = false, withDecision = false }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      {note ? <p className="mt-1 text-[0.7rem] leading-4 text-slate-400">{note}</p> : null}
      <SlotListBody slots={slots} empty={empty} withFix={withFix} withDecision={withDecision} />
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
  const calculatedFinal = row.recalculatedFinalAmount
    ?? Math.round((row.expectedAmount + row.adjustmentAmount) * 100) / 100;
  const owed = row.owedAmount ?? (row.status === 'paid' ? 0 : (row.finalAmount || calculatedFinal));
  const basisLabel = { since_paid: 'since last paid', first_run: 'default window', override: 'custom window' }[row.windowBasis] || row.windowBasis || '';
  const reviewPast = (row.reviewSlots || []).filter((slot) => slot.timing === 'past');
  const reviewUpcoming = (row.reviewSlots || []).filter((slot) => slot.timing === 'upcoming');
  const workflow = getPayrollWorkflowState(row);
  const workflowClass = {
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    attention: 'border-blue-200 bg-blue-50 text-blue-800',
    waiting: 'border-slate-200 bg-slate-100 text-slate-700',
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    complete: 'border-slate-200 bg-slate-50 text-slate-500',
  }[workflow.tone] || 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <article className="rounded-[1.4rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{row.tutor}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${workflowClass}`}>
              {workflow.label}
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
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-slate-900">{formatMoney(owed)}</p>
          {row.status === 'paid' ? (
            <p className="text-xs text-emerald-700">paid {formatMoney(row.finalAmount)}{row.paidAt ? ` · ${formatPayrollDate(row.paidAt)}` : ''}</p>
          ) : (
            <p className="text-xs text-slate-500">{row.lessonCount} payable · {minutesLabel(row.teachingMinutes)}</p>
          )}
          {row.status === 'reviewed' || row.status === 'paid' ? (
            <Link
              href={`/admin/finance/payroll/statement?pid=${encodeURIComponent(row.payrollId)}`}
              className={`mt-2 inline-flex rounded-xl px-3 py-2 text-sm font-semibold transition ${workflow.key === 'send' ? 'bg-slate-950 text-white hover:bg-slate-800' : 'text-blue-700 hover:bg-blue-50'}`}
            >
              {workflow.key === 'send' ? 'Send statement' : 'View statement'} →
            </Link>
          ) : null}
        </div>
      </div>

      <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${workflowClass}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">Next</p>
          <p className="mt-0.5 text-sm font-semibold">{workflow.nextAction}</p>
        </div>
        <span className="text-xs font-medium">
          {row.paymentRoute === 'confirmation' ? 'Tutor confirmation' : 'Pay normally'}
        </span>
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
      {reviewPast.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {reviewPast.length} taught lesson{reviewPast.length === 1 ? '' : 's'} not yet marked in MMS — record {reviewPast.length === 1 ? 'it' : 'them'} before trusting this figure.
          {reviewUpcoming.length ? ` (${reviewUpcoming.length} more upcoming — those resolve themselves.)` : ''}
        </div>
      ) : null}
      {row.attendanceChanged ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <p className="font-semibold">MMS attendance changed after this amount was reviewed.</p>
          <p className="mt-1">
            Reviewed amount: {formatMoney(row.finalAmount)} · refreshed calculation: {formatMoney(calculatedFinal)}.
            Check the lesson detail, then save the corrected amount before paying or resending the statement.
          </p>
        </div>
      ) : null}
      {row.tutorResponse === 'confirmed' ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Confirmed ✓ by tutor{row.tutorRespondedAt ? ` · ${formatPayrollDate(row.tutorRespondedAt)}` : ''}.
        </div>
      ) : row.tutorResponse === 'disputed' ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <strong>Tutor flagged this statement</strong>{row.tutorNote ? `: “${row.tutorNote}”` : '.'} Held out of the Wise batch until you resolve it.
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {/* Lead with the genuine open loop: taught but not yet recorded in MMS. */}
        {reviewPast.length ? (
          <SlotList title="Needs recording" slots={reviewPast} withDecision />
        ) : null}

        <details className="group rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-700">
            Lesson detail
            <span className="text-xs font-medium text-slate-400 group-open:hidden">Show</span>
            <span className="hidden text-xs font-medium text-slate-400 group-open:inline">Hide</span>
          </summary>
          <div className="mt-4 space-y-3">
            {reviewUpcoming.length ? (
              <CollapsibleSlotList title="Upcoming — not yet taught" slots={reviewUpcoming} />
            ) : null}
            <CollapsibleSlotList title="Payable from MMS attendance" slots={row.payableSlots} empty="No payable lessons found for this period." />
            {row.excludedSlots?.length ? (
              <CollapsibleSlotList title="Not counted — absent / cancelled" slots={row.excludedSlots} empty="None." />
            ) : null}
          </div>
        </details>
      </div>

      <form action={savePayrollRunAction} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
          ['existing_status', row.status],
          ['statement_sent_at', row.statementSentAt],
          ['statement_sent_by', row.statementSentBy],
          ['tutor_response', row.tutorResponse],
          ['tutor_responded_at', row.tutorRespondedAt],
          ['tutor_note', row.tutorNote],
          ['reviewed_at', row.reviewedAt],
          ['reviewed_by', row.reviewedBy],
          ['paid_at', row.paidAt],
          ['paid_by', row.paidBy],
          ['created_at', row.createdAt],
        ].map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value ?? ''} />
        ))}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="block sm:min-w-64">
            <span className="text-xs font-semibold text-slate-600">Payment route</span>
            <select name="payment_route" defaultValue={row.paymentRoute || 'normal'} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="normal">Pay normally · confirmation optional</option>
              <option value="confirmation">Tutor confirmation required</option>
            </select>
          </label>
          <PayrollSaveButtons
            status={row.status}
            attendanceChanged={row.attendanceChanged}
            blocked={row.status === 'draft' && Boolean(reviewPast.length || row.overlapsPaid)}
          />
        </div>
        <details className="group mt-3 border-t border-slate-200 pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-slate-500">
            <span>Adjustments, invoice tracking and period</span>
            <span
              aria-hidden="true"
              className="text-base leading-none text-slate-400 transition-transform duration-200 group-open:rotate-180"
            >
             ⌄
            </span>
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Tutor invoice</span>
              <select name="invoice_status" defaultValue={row.invoiceStatus || ''} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">Not recorded</option>
                <option value="received">Received</option>
                <option value="missing">Expected</option>
                <option value="not_needed">Not required</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Adjustment</span>
              <input name="adjustment_amount" type="number" step="0.01" defaultValue={row.adjustmentAmount || 0} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Notes</span>
              <input name="notes" defaultValue={row.notes || ''} placeholder="Optional note" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </label>
            <div className="md:col-span-2">
              <AdjustWindowForm payDate={payDate} tutor={row.tutorShortName} start={row.periodStart} end={row.periodEnd} />
            </div>
          </div>
        </details>
      </form>
    </article>
  );
}

// Preserve the pay date and any window override across a refresh round-trip;
// `refresh` itself is deliberately dropped.
function buildPayrollQuery(params = {}) {
  const query = new URLSearchParams();
  for (const key of ['payDate', 'tutor', 'start', 'end']) {
    const value = `${params[key] || ''}`.trim();
    if (value) query.set(key, value);
  }
  return query.toString();
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

  const [tutorPayRows, savedRuns, tutorWiseRows, studentRows, pauseRows] = await Promise.all([
    getTutorPayRows(),
    getPayrollRunRows(),
    getTutorWiseRows(),
    getStudentsSheetRows(),
    getPauseHistoryRows(),
  ]);

  // Attendance is cached with stale-while-revalidate, so saves and window tweaks
  // never block on MMS. `?refresh=1` is the deliberate "I just recorded a lesson
  // in MMS" escape hatch — it bypasses the cache and waits for fresh rows.
  const forceRefresh = `${params.refresh || ''}` === '1';

  let attendanceRows = [];
  let loadError = '';
  try {
    attendanceRows = await searchAttendanceForPayroll({
      startDate: fetchStart,
      endDate: fetchEnd,
      teacherIds,
      limit: 1000,
      forceRefresh,
    });
  } catch (error) {
    loadError = error.message || 'Could not load MMS attendance for payroll.';
  }

  // Drop `refresh` from the URL once it has done its job, otherwise every later
  // save re-renders this page with refresh=1 still set and refetches MMS every
  // time — exactly the cost the cache exists to avoid. Must sit outside the try:
  // redirect() signals by throwing, and the catch above would swallow it.
  if (forceRefresh && !loadError) {
    const cleanQuery = buildPayrollQuery(params);
    redirect(`/admin/finance/payroll?${[cleanQuery, 'refreshed=1'].filter(Boolean).join('&')}`);
  }

  const preview = buildPayrollPreview({
    attendanceRows,
    tutorPay: parseTutorPay(tutorPayRows),
    savedRuns,
    overrides,
    payDate,
  });
  // Salaried tutors (Finn/Tom/Fennella) are paid a fixed wage, not per-lesson via
  // this Wise reconciliation — keep them off the payroll page entirely. Totals and
  // the Wise batch already exclude salary, so this is display-only.
  const activeRows = addPauseEvidenceToPayrollRows(preview.rows, studentRows, pauseRows)
    .filter((row) => row.payModel !== 'salary');
  // A refreshed correction must go back through the existing human save step.
  // Hold every saved row for that tutor out of this rendered Wise batch so an
  // older duplicate window cannot become the fallback payment by accident.
  const attendanceChangedRows = activeRows.filter((row) => row.attendanceChanged);
  const heldTutorKeys = new Set(attendanceChangedRows.map((row) => `${row.tutorShortName || row.tutor}`.trim().toLowerCase()));
  const heldPayrollIds = savedRuns
    .filter((row) => heldTutorKeys.has(`${row.tutor_short_name ?? row.tutorShortName ?? row.tutor ?? row.Tutor ?? ''}`.trim().toLowerCase()))
    .map((row) => `${row.payroll_id ?? row.payrollId ?? ''}`.trim())
    .filter(Boolean);
  const heldPayrollIdSet = new Set(heldPayrollIds);
  // Wise batch comes straight from saved reviewed rows (window-independent), so
  // a tutor reviewed under an adjusted window still lands in the CSV.
  const { rows: payableRows, amountConflicts, disputed } = selectPayableReviewedRuns(
    savedRuns.filter((row) => !heldPayrollIdSet.has(`${row.payroll_id ?? row.payrollId ?? ''}`.trim())),
  );
  const wiseBatch = buildWiseBatch({ rows: payableRows, wiseByKey: parseTutorWise(tutorWiseRows) });
  const wiseCsvParams = new URLSearchParams({ payDate });
  if (heldPayrollIds.length) wiseCsvParams.set('excludePayrollIds', heldPayrollIds.join(','));
  // Tutor confirmation tally across reviewed (unpaid) rows — the "am I informed" surface.
  const reviewedRows = preview.rows.filter((row) => row.status === 'reviewed');
  const confirmationRows = reviewedRows.filter((row) => row.paymentRoute === 'confirmation');
  const confirmations = {
    confirmed: confirmationRows.filter((row) => row.tutorResponse === 'confirmed').length,
    disputed: confirmationRows.filter((row) => row.tutorResponse === 'disputed').length,
    awaiting: confirmationRows.filter((row) => !row.tutorResponse).length,
  };
  const workspaceRows = activeRows.map((row) => ({ ...row, workflow: getPayrollWorkflowState(row) }));
  const requestedTutor = `${params.tutor || ''}`.trim();
  const selectedRow = workspaceRows.find((row) => row.tutorShortName === requestedTutor)
    || workspaceRows.find((row) => !['paid', 'ready'].includes(row.workflow.key))
    || workspaceRows[0]
    || null;
  const selectedTutor = selectedRow?.tutorShortName || '';
  const selectorRows = workspaceRows.map(({ payrollId, tutor, tutorShortName, workflow }) => ({ payrollId, tutor, tutorShortName, workflow }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-b border-slate-200 pb-6">
        <Link href="/admin/finance" className="text-sm font-medium text-blue-700">← Finance</Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-3 text-[2rem] font-semibold tracking-[-0.035em] text-slate-950">
              Payroll
              <ScopeBadge>Nothing is paid automatically</ScopeBadge>
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {formatMoney(wiseBatch.totalAmount)} ready · {preview.totals.reviewLessonCount} lesson{preview.totals.reviewLessonCount === 1 ? '' : 's'} need review · {confirmations.awaiting} awaiting
            </p>
          </div>
          <form className="flex items-end gap-2">
            <label>
              <span className="text-xs font-semibold text-slate-500">Pay date</span>
              <input type="date" name="payDate" defaultValue={payDate} className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
            </label>
            <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Load</button>
          </form>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Changed attendance in MMS? Refresh before reviewing the amount.</p>
        <Link
          href={`/admin/finance/payroll?${[buildPayrollQuery(params), 'refresh=1'].filter(Boolean).join('&')}`}
          prefetch={false}
          className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-100"
          title="Use after recording attendance in MMS"
        >
          ↻ Refresh MMS &amp; recalculate
        </Link>
      </div>

      {`${params.refreshed || ''}` === '1' ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          MMS attendance refreshed. Draft totals are recalculated; any reviewed amount affected by a correction is marked below for you to check and save.
        </section>
      ) : null}

      {loadError ? (
        <section className="rounded-[1.6rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          MMS payroll attendance could not be loaded: {loadError}
        </section>
      ) : null}

      <section className="space-y-4">
        <TutorSelector rows={selectorRows} selectedTutor={selectedTutor} payDate={payDate} />
        {selectedRow ? (
          <PayrollTutorCard key={selectedRow.payrollId} row={selectedRow} payDate={payDate} />
        ) : (
          <div className="rounded-[1.6rem] border border-slate-200 bg-white/90 p-6 text-sm text-slate-500">
            No payroll rows found for this period.
          </div>
        )}
      </section>

      <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" open={Boolean(wiseBatch.includedCount)}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">
          Ready to pay · {wiseBatch.includedCount} tutor{wiseBatch.includedCount === 1 ? '' : 's'} · {formatMoney(wiseBatch.totalAmount)}
          <span className="text-xs text-slate-400 group-open:hidden">Show</span>
          <span className="hidden text-xs text-slate-400 group-open:inline">Hide</span>
        </summary>
        <div className="mt-4">
          <WisePayoutPanel
            includedCount={wiseBatch.includedCount}
            totalLabel={formatMoney(wiseBatch.totalAmount)}
            missingNames={wiseBatch.missing.map((entry) => entry.tutor).filter(Boolean)}
            payDate={payDate}
            downloadHref={`/admin/finance/payroll/wise-csv?${wiseCsvParams.toString()}`}
            payrollIds={wiseBatch.includedPayrollIds}
            amountConflicts={amountConflicts}
            disputed={disputed}
            mmsChanges={attendanceChangedRows.map((row) => ({
              tutor: row.tutor,
              reviewedAmount: row.finalAmount,
              recalculatedAmount: row.recalculatedFinalAmount,
            }))}
            confirmations={confirmations}
            markBatchPaidAction={markBatchPaidAction}
            embedded
          />
        </div>
      </details>
    </div>
  );
}
