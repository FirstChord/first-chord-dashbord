import { buildSheetRange, ensureManagedSheet, getSheetValues, getSheetsClient, getSheetsEnv, invalidateSheetReadCache, mapRowsToObjects, STRIPE_AMOUNTS_CACHE_HEADERS, STRIPE_AMOUNTS_CACHE_SHEET, STRIPE_COLLECTED_MONTHLY_HEADERS, STRIPE_COLLECTED_MONTHLY_SHEET, upsertManagedSheetRow, withSheetsRetry } from './core.mjs';
import { columnNumberToLetter } from '../sheets-helpers.mjs';

// --- Stripe actuals cache (read-only revenue calibration) -----------------------
// Stripe_Amounts_Cache is a full-replace cache: every refresh rewrites the whole
// tab (clear + one update, two API calls) because the row set follows the roster,
// and per-row upserts for ~170 students would crawl. Stripe_Collected_Monthly is a
// small keyed-by-month calibration series.

export async function getStripeAmountsCacheRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) return [];
  await ensureManagedSheet({ sheets, spreadsheetId, sheetName: STRIPE_AMOUNTS_CACHE_SHEET, requiredHeaders: STRIPE_AMOUNTS_CACHE_HEADERS });
  const values = await getSheetValues(STRIPE_AMOUNTS_CACHE_SHEET);
  return mapRowsToObjects(values);
}

export async function replaceStripeAmountsCacheRows(rows = []) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }
  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: STRIPE_AMOUNTS_CACHE_SHEET,
    requiredHeaders: STRIPE_AMOUNTS_CACHE_HEADERS,
  });
  const endColumn = columnNumberToLetter(headers.length);

  await withSheetsRetry(() => sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: buildSheetRange(STRIPE_AMOUNTS_CACHE_SHEET, `A2:${endColumn}`),
  }));

  if (rows.length) {
    const values = rows.map((row) => headers.map((header) => row[header] ?? ''));
    await withSheetsRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId,
      range: buildSheetRange(STRIPE_AMOUNTS_CACHE_SHEET, `A2:${endColumn}${rows.length + 1}`),
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    }));
  }

  invalidateSheetReadCache(STRIPE_AMOUNTS_CACHE_SHEET);
  return { written: rows.length };
}

export async function getStripeCollectedMonthlyRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) return [];
  await ensureManagedSheet({ sheets, spreadsheetId, sheetName: STRIPE_COLLECTED_MONTHLY_SHEET, requiredHeaders: STRIPE_COLLECTED_MONTHLY_HEADERS });
  const values = await getSheetValues(STRIPE_COLLECTED_MONTHLY_SHEET);
  return mapRowsToObjects(values);
}

export async function upsertStripeCollectedMonthlyRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }
  const monthKey = `${row.month || ''}`.trim();
  if (!monthKey) {
    throw new Error('month is required');
  }
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: STRIPE_COLLECTED_MONTHLY_SHEET,
    requiredHeaders: STRIPE_COLLECTED_MONTHLY_HEADERS,
    valuesByHeader: {
      month: monthKey,
      collected_total: row.collected_total ?? row.collectedTotal ?? '',
      invoice_count: row.invoice_count ?? row.invoiceCount ?? '',
      currency: row.currency ?? 'gbp',
      refreshed_at: row.refreshed_at ?? row.refreshedAt ?? new Date().toISOString(),
    },
    matchesRow: (entry, headers) => `${entry[headers.indexOf('month')] || ''}`.trim() === monthKey,
  });
}
