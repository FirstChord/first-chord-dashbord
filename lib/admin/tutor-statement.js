// Server-side loader for a tutor pay statement. Shared by the admin statement
// view and the public signed-link view. Reads the frozen reviewed Payroll_Runs
// row for the total, and recomputes that window's payable lessons for the
// per-lesson breakdown. Read-only — no writes, no money movement.
import { getPayrollRunRows, getTutorPayRows, upsertPayrollRunRow } from '@/lib/admin/sheets';
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

// Records a tutor's response to their statement (Phase 2). Called from the
// public signed-link view — no login, the token proved which row. Writes back
// to the Payroll_Runs row; never touches payment state. Returns the response
// or a reason it was declined (row missing / already paid).
export async function recordTutorStatementResponse({ payrollId, response, note = '' }) {
  const id = `${payrollId || ''}`.trim();
  const cleanResponse = `${response || ''}`.trim().toLowerCase();
  if (!id) return { ok: false, reason: 'missing_id' };
  if (cleanResponse !== 'confirmed' && cleanResponse !== 'disputed') {
    return { ok: false, reason: 'bad_response' };
  }

  const savedRuns = await getPayrollRunRows();
  const raw = savedRuns.find((row) => `${row.payroll_id ?? ''}`.trim() === id);
  if (!raw) return { ok: false, reason: 'not_found' };
  // Once paid, the response is moot — don't let a link reopen a settled run.
  if (`${raw.status ?? ''}`.trim() === 'paid') return { ok: false, reason: 'already_paid' };

  await upsertPayrollRunRow({
    ...raw,
    tutor_response: cleanResponse,
    tutor_responded_at: new Date().toISOString(),
    tutor_note: cleanResponse === 'disputed' ? `${note || ''}`.trim() : '',
    updated_at: new Date().toISOString(),
  });

  return { ok: true, response: cleanResponse };
}

export async function recordTutorStatementSent({ payrollId, actorEmail = '' }) {
  const id = `${payrollId || ''}`.trim();
  if (!id) return { ok: false, reason: 'missing_id' };
  const savedRuns = await getPayrollRunRows();
  const raw = savedRuns.find((row) => `${row.payroll_id ?? ''}`.trim() === id);
  if (!raw) return { ok: false, reason: 'not_found' };
  if (`${raw.status ?? ''}`.trim() !== 'reviewed') return { ok: false, reason: 'not_reviewed' };
  const now = new Date().toISOString();
  await upsertPayrollRunRow({
    ...raw,
    statement_sent_at: now,
    statement_sent_by: `${actorEmail || ''}`.trim(),
    updated_at: now,
  });
  return { ok: true, sentAt: now };
}
