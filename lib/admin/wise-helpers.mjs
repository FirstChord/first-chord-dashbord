// Builds a Wise batch-payment CSV from reviewed payroll rows joined to a
// Tutor_Wise recipient table. Pure + unit-tested.
//
// The dashboard only *generates* the file — a human uploads it to Wise and
// presses send. Payroll stays reconciliation, not execution. Recipient banking
// data lives in the Tutor_Wise Google Sheet, never in git.

// Exact Wise batch-payment column order (the file Wise expects on upload).
export const WISE_CSV_HEADERS = [
  'recipientId',
  'name',
  'recipientEmail',
  'recipientDetail',
  'sourceCurrency',
  'targetCurrency',
  'amountCurrency',
  'amount',
  'paymentReference',
  'receiverType',
];

function norm(value) {
  return `${value ?? ''}`.trim().toLowerCase();
}

function clean(value) {
  return `${value ?? ''}`.trim();
}

// Index each Tutor_Wise row by its tutor key for joining to payroll rows.
// Accepts snake_case (sheet) or camelCase. Currency fields default to GBP.
export function parseTutorWise(rows = []) {
  const byKey = new Map();
  for (const row of rows) {
    const key = norm(row.tutor);
    if (!key) continue;
    byKey.set(key, {
      tutor: clean(row.tutor),
      recipientId: clean(row.recipient_id ?? row.recipientId),
      name: clean(row.name),
      recipientEmail: clean(row.recipient_email ?? row.recipientEmail),
      recipientDetail: clean(row.recipient_detail ?? row.recipientDetail),
      sourceCurrency: clean(row.source_currency ?? row.sourceCurrency) || 'GBP',
      targetCurrency: clean(row.target_currency ?? row.targetCurrency) || 'GBP',
      amountCurrency: clean(row.amount_currency ?? row.amountCurrency) || 'GBP',
      receiverType: clean(row.receiver_type ?? row.receiverType),
    });
  }
  return byKey;
}

// Short on purpose — Wise payment references are length-limited per currency.
export function buildPaymentReference({ periodEnd = '' } = {}) {
  const end = clean(periodEnd);
  return end ? `FC pay ${end}` : 'FC pay';
}

function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

// rows = payroll preview rows; wiseByKey from parseTutorWise.
// Includes ONLY reviewed rows with a positive owed amount — an unchecked
// figure can never become a payment. Reviewed rows missing a Wise recipient
// are surfaced (not silently dropped) so they can be chased.
export function buildWiseBatch({ rows = [], wiseByKey = new Map() } = {}) {
  const csvRows = [];
  const missing = [];
  const includedPayrollIds = [];
  let totalAmount = 0;
  for (const row of rows) {
    if (norm(row.status) !== 'reviewed') continue;
    const owed = Number(row.owedAmount);
    if (!Number.isFinite(owed) || owed <= 0) continue;

    const recipient =
      wiseByKey.get(norm(row.tutorShortName)) ||
      wiseByKey.get(norm(row.tutor)) ||
      null;

    if (!recipient || !recipient.recipientId) {
      missing.push({ tutor: row.tutor || row.tutorShortName, owedAmount: owed });
      continue;
    }

    totalAmount += owed;
    if (row.payrollId) includedPayrollIds.push(row.payrollId);
    csvRows.push({
      recipientId: recipient.recipientId,
      name: recipient.name || row.tutor,
      recipientEmail: recipient.recipientEmail,
      recipientDetail: recipient.recipientDetail,
      sourceCurrency: recipient.sourceCurrency,
      targetCurrency: recipient.targetCurrency,
      amountCurrency: recipient.amountCurrency,
      amount: formatAmount(owed),
      paymentReference: buildPaymentReference({ periodEnd: row.periodEnd }),
      receiverType: recipient.receiverType,
    });
  }
  return {
    csvRows,
    missing,
    includedPayrollIds,
    includedCount: csvRows.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

function csvField(value) {
  const s = `${value ?? ''}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toWiseCsv(csvRows = []) {
  const lines = [WISE_CSV_HEADERS.join(',')];
  for (const row of csvRows) {
    lines.push(WISE_CSV_HEADERS.map((header) => csvField(row[header])).join(','));
  }
  return lines.join('\r\n');
}
