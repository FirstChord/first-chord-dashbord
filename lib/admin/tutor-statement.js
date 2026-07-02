// Server-side loader for a tutor pay statement. Shared by the admin statement
// view and the public signed-link view. Reads the frozen reviewed Payroll_Runs
// row for the total, and recomputes that window's payable lessons for the
// per-lesson breakdown. Read-only — no writes, no money movement.
import { getPayrollRunRows, getTutorPayRows } from '@/lib/admin/sheets';
import { searchAttendanceForPayroll } from '@/lib/admin/mms';
import { parseTutorPay } from '@/lib/admin/cost-helpers.mjs';
import { buildPayrollPreview, normalisePayrollRunRow } from '@/lib/admin/payroll-helpers.mjs';
import { buildTutorStatement } from '@/lib/admin/tutor-statement-helpers.mjs';

function addOneDay(dateStr) {
  const parsed = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

// Returns { statement } for a reviewed/paid row, or { notFound } / { notReady }.
export async function loadTutorStatement({ payrollId } = {}) {
  const id = `${payrollId || ''}`.trim();
  if (!id) return { notFound: true };

  const savedRuns = await getPayrollRunRows();
  const savedRaw = savedRuns.find((row) => `${row.payroll_id ?? ''}`.trim() === id);
  if (!savedRaw) return { notFound: true };

  const savedRow = normalisePayrollRunRow(savedRaw);
  // A statement only exists once the figure is locked (reviewed) — a draft row
  // has no agreed amount to invoice.
  if (savedRow.status !== 'reviewed' && savedRow.status !== 'paid') {
    return { notReady: true, savedRow };
  }

  const tutorPay = parseTutorPay(await getTutorPayRows());

  // Reproduce the frozen window: payDate just past period end so the 35-day
  // look-back cap can't clip it; the override pins the exact dates so the
  // resolved payroll_id matches the saved row.
  const payDate = addOneDay(savedRow.periodEnd);
  const overrides = { [savedRow.tutorShortName]: { start: savedRow.periodStart, end: savedRow.periodEnd } };

  let attendanceRows = [];
  try {
    attendanceRows = await searchAttendanceForPayroll({
      startDate: savedRow.periodStart,
      endDate: savedRow.periodEnd,
      teacherIds: savedRow.teacherId ? [savedRow.teacherId] : [],
      limit: 1000,
    });
  } catch {
    // Lines are best-effort; the frozen total still stands from the saved row.
    attendanceRows = [];
  }

  const preview = buildPayrollPreview({ attendanceRows, tutorPay, savedRuns, overrides, payDate });
  const previewRow = preview.rows.find((row) => row.payrollId === id)
    || preview.rows.find((row) => row.tutorShortName === savedRow.tutorShortName)
    || {};

  return { statement: buildTutorStatement({ savedRow, previewRow }), savedRow };
}
