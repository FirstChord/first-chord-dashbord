import { google } from 'googleapis';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { columnNumberToLetter } from '../sheets-helpers.mjs';

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const LOCAL_TOKEN_PATH = path.join(homedir(), 'token_musiclessons.json');
const managedSheetHeadersCache = new Map();
const sheetReadCache = new Map();
const sheetReadInflight = new Map();
const sheetReadInvalidationVersions = new Map();
// Repeat navigations within this window reuse cached sheet reads. After that,
// normal page reads may serve bounded-stale values immediately while a refresh
// happens in the background. Dashboard writes invalidate their tab cache, so the
// stale window mainly protects against external writers and quiet-idle visits.
const SHEETS_READ_TTL_MS = 60_000;
const SHEETS_READ_STALE_WHILE_REVALIDATE_MS = 5 * 60_000;
const SHEETS_READ_HARD_MAX_AGE_MS = SHEETS_READ_TTL_MS + SHEETS_READ_STALE_WHILE_REVALIDATE_MS;
export const ISSUE_QUEUE_SHEET = 'Issue_Queue';
export const EVENT_LOG_SHEET = 'Event_Log';
export const SHOWCASE_TASK_STATE_SHEET = 'Showcase_Task_State';
export const HOLIDAY_WORKFLOW_STATE_SHEET = 'Holiday_Workflow_State';
export const WAITING_LIST_STATE_SHEET = 'Waiting_List_State';
export const SCHEDULE_CONTEXT_SHEET = 'Schedule_Context';
export const PARENT_UNDERSTANDING_STATE_SHEET = 'Parent_Understanding_State';
export const TUTOR_ABSENCE_STATE_SHEET = 'Tutor_Absence_State';
export const PLANNING_ITEMS_SHEET = 'Planning_Items';
export const PLANNING_PROGRESS_LOG_SHEET = 'Planning_Progress_Log';
export const PRACTICE_NOTES_LOG_SHEET = 'Practice_Notes_Log';
export const COMMUNICATION_LOG_SHEET = 'Communication_Log';
export const INCOMING_MESSAGE_INBOX_SHEET = 'Incoming_Message_Inbox';
export const WHATSAPP_GROUP_MAP_SHEET = 'WhatsApp_Group_Map';
export const STUDENTS_ARCHIVE_SHEET = 'Students_Archive';
export const TUTOR_PAY_SHEET = 'Tutor_Pay';
export const EXPENSES_SHEET = 'Expenses';
export const EXPENSE_LOG_SHEET = 'Expense_Log';
export const FINANCE_SNAPSHOT_SHEET = 'Finance_Snapshot';
export const PAYROLL_RUNS_SHEET = 'Payroll_Runs';
export const TUTOR_WISE_SHEET = 'Tutor_Wise';
export const TUTOR_PAY_HEADERS = ['tutor', 'pay_model', 'hourly_rate', 'monthly_salary', 'invoice_cadence', 'active_for_payroll', 'notes'];
// Wise batch-payment recipient details, keyed to each tutor. Sensitive — lives
// here (operational store), never in git. recipient_id is the opaque Wise id.
export const TUTOR_WISE_HEADERS = ['tutor', 'recipient_id', 'name', 'recipient_email', 'recipient_detail', 'source_currency', 'target_currency', 'amount_currency', 'receiver_type', 'notes'];
export const EXPENSES_HEADERS = ['name', 'amount', 'period', 'category', 'notes'];
export const EXPENSE_LOG_HEADERS = [
  'expense_id',
  'date',
  'amount',
  'category',
  'description',
  'paid_by',
  'reimbursable',
  'linked_area',
  'notes',
  'created_at',
  'created_by',
];
export const FINANCE_SNAPSHOT_HEADERS = [
  'snapshot_id',
  'snapshot_at',
  'period_type',
  'active_count',
  'paused_count',
  'setup_pending_count',
  'onboarded_count',
  'left_count',
  'active_unpriced_count',
  'active_weekly_revenue',
  'active_monthly_revenue',
  'paused_weekly_revenue',
  'vat_rate',
  'vat_liability_monthly',
  'net_revenue_monthly',
  'revenue_one_to_one_weekly',
  'revenue_group_weekly',
  'revenue_orchestra_weekly',
  'revenue_stripe_weekly',
  'revenue_manual_weekly',
  'unpriced_cost_slots',
  'variable_tutor_monthly',
  'salaried_monthly',
  'fixed_monthly',
  'actual_spend_month_to_date',
  'cash_view_cost_month_to_date',
  'total_cost_monthly',
  'margin_monthly',
  'cash_view_margin_month_to_date',
  'margin_pct',
  'source',
  'notes',
];
// Cached Stripe subscription amounts per student (the "slice B" actuals feed).
// Full-replace cache refreshed by /api/cron/stripe-amounts — a stale tab degrades
// the finance estimate honestly (source flips back to 'estimate'), never blocks it.
export const STRIPE_AMOUNTS_CACHE_SHEET = 'Stripe_Amounts_Cache';
export const STRIPE_AMOUNTS_CACHE_HEADERS = [
  'mms_id',
  'student_name',
  'stripe_customer_id',
  'stripe_subscription_id',
  'subscription_status',
  'paused',
  'interval',
  'weekly_amount',
  'monthly_amount',
  'currency',
  'discount_pct',
  'checked_at',
];
// One row per calendar month: what Stripe actually collected (paid invoices), for
// calibrating the estimate against reality. Keyed upsert by month.
export const STRIPE_COLLECTED_MONTHLY_SHEET = 'Stripe_Collected_Monthly';
export const STRIPE_COLLECTED_MONTHLY_HEADERS = [
  'month',
  'collected_total',
  'invoice_count',
  'currency',
  'refreshed_at',
];
export const PAYROLL_RUNS_HEADERS = [
  'payroll_id',
  'pay_date',
  'period_start',
  'period_end',
  'tutor',
  'tutor_short_name',
  'teacher_id',
  'invoice_cadence',
  'pay_model',
  'lesson_count',
  'review_lesson_count',
  'teaching_minutes',
  'expected_amount',
  'adjustment_amount',
  'final_amount',
  'status',
  'invoice_status',
  'notes',
  'reviewed_at',
  'reviewed_by',
  'paid_at',
  'paid_by',
  'source',
  'created_at',
  'updated_at',
  'tutor_response',
  'tutor_responded_at',
  'tutor_note',
];
export const ISSUE_QUEUE_HEADERS = [
  'issue_id',
  'source',
  'issue_type',
  'mms_id',
  'context_key',
  'student_name',
  'severity',
  'status',
  'owner',
  'created_at',
  'updated_at',
  'resolved_at',
  'ignored_at',
  'acknowledged_at',
  'last_seen_at',
  'source_present',
  'summary',
  'detail',
  'recommended_action',
  'systems_affected',
  'resolution_note',
];
export const EVENT_LOG_HEADERS = [
  'event_id',
  'occurred_at',
  'actor_email',
  'entity_type',
  'entity_id',
  'event_type',
  'mms_id',
  'student_name',
  'issue_id',
  'payload_json',
];
export const SHOWCASE_TASK_STATE_HEADERS = [
  'workflow_key',
  'season',
  'year',
  'group_id',
  'task_id',
  'task_label',
  'completed',
  'completed_at',
  'updated_at',
];
export const HOLIDAY_WORKFLOW_STATE_HEADERS = [
  'workflow_key',
  'season',
  'year',
  'group_id',
  'task_id',
  'task_label',
  'completed',
  'completed_at',
  'updated_at',
];
export const WAITING_LIST_STATE_HEADERS = [
  'mms_id',
  'status',
  'note',
  'parent_name',
  'parent_email',
  'date_started',
  'updated_at',
];
export const SCHEDULE_CONTEXT_HEADERS = [
  'mms_id',
  'student_name',
  'status',
  'next_lesson_at',
  'usual_weekday',
  'usual_time',
  'duration_minutes',
  'teacher_id',
  'teacher_name',
  'event_category',
  'series_id',
  'source',
  'confidence',
  'warnings',
  'checked_at',
];
export const PARENT_UNDERSTANDING_STATE_HEADERS = [
  'record_id',
  'student_mms_id',
  'student_name',
  'parent_name',
  'workflow_status',
  'loop_status',
  'call_attempt_count',
  'last_contacted_at',
  'understanding_score',
  'understanding_label',
  'risk_signals',
  'whatsapp_understanding',
  'best_contact_time',
  'community_group_status',
  'feedback_summary',
  'tutor_relevance',
  'admin_follow_up_note',
  'summary',
  'details_json',
  'updated_at',
  'updated_by',
];
export const TUTOR_ABSENCE_STATE_HEADERS = [
  'absence_id',
  'tutor_short_name',
  'tutor_name',
  'absence_date',
  'status',
  'decision',
  'cover_tutor_short_name',
  'cover_tutor_name',
  'affected_lessons_json',
  'message_state_json',
  'note',
  'created_at',
  'updated_at',
  'resolved_at',
  'updated_by',
];
export const PLANNING_ITEMS_HEADERS = [
  'planning_id',
  'title',
  'notes',
  'item_type',
  'owner',
  'status',
  'area',
  'linked_workflow_id',
  'linked_student_id',
  'linked_tutor_id',
  'parent_planning_id',
  'outcome',
  'next_action',
  'target_date',
  'created_at',
  'updated_at',
  'created_by',
  'last_updated_by',
  'plan_mode',
];
export const PLANNING_PROGRESS_LOG_HEADERS = [
  'progress_id',
  'planning_id',
  'progress_note',
  'progress_type',
  'created_at',
  'created_by',
];
export const PRACTICE_NOTES_LOG_HEADERS = [
  'note_id',
  'delivery_key',
  'student_mms_id',
  'student_name',
  'tutor_name',
  'lesson_date',
  'what_we_did',
  'progress_challenges',
  'practice_goals',
  'raw_note_text',
  'copied_to_clipboard',
  'attendance_step_opened',
  'mms_event_id',
  'mms_attendance_id',
  'mms_attendance_status',
  'mms_attendance_saved',
  'target_selection_reason',
  'target_selection_label',
  'recipient_profile_id',
  'recipient_name',
  'recipient_email',
  'email_channel',
  'email_send_status',
  'email_sent_at',
  'gmail_message_id',
  'gmail_thread_id',
  'email_error',
  'manual_follow_up_needed',
  'operation_status',
  'completed_at',
  'source',
  'created_at',
  'user_agent',
];
export const COMMUNICATION_LOG_HEADERS = [
  'message_id',
  'logged_at',
  'category',
  'channel',
  'mms_id',
  'student_name',
  'body',
  'source',
  'actor_email',
];
export const INCOMING_MESSAGE_INBOX_HEADERS = [
  'incoming_id',
  'source',
  'external_message_id',
  'captured_at',
  'message_at',
  'chat_id',
  'chat_name',
  'sender_name',
  'sender_phone',
  'message_text',
  'captured_by',
  'suspected_category',
  'matched_mms_id',
  'matched_student_name',
  'match_confidence',
  'match_reasons',
  'status',
  'review_note',
  'reviewed_by',
  'reviewed_at',
  'created_planning_id',
  'raw_json',
];
export const WHATSAPP_GROUP_MAP_HEADERS = [
  'chat_id',
  'chat_name',
  'first_seen_at',
  'last_seen_at',
  'last_incoming_id',
  'last_message_at',
  'last_sender_name',
  'last_sender_phone',
  'matched_mms_id',
  'matched_fc_id',
  'matched_student_name',
  'additional_mms_ids',
  'parent_name',
  'parent_phone',
  'tutor_name',
  'instrument',
  'match_confidence',
  'match_reasons',
  'status',
  'confirmed_by',
  'confirmed_at',
  'notes',
  'raw_json',
];

export function buildStudentsArchiveHeaders(studentHeaders = []) {
  return [
    'archived_at',
    'archived_by',
    'archive_note',
    'date_left',
    ...studentHeaders,
  ];
}

export function buildManagedStateSheetDefinitions(studentHeaders = []) {
  return [
    { sheetName: ISSUE_QUEUE_SHEET, requiredHeaders: ISSUE_QUEUE_HEADERS },
    { sheetName: EVENT_LOG_SHEET, requiredHeaders: EVENT_LOG_HEADERS },
    { sheetName: WAITING_LIST_STATE_SHEET, requiredHeaders: WAITING_LIST_STATE_HEADERS },
    { sheetName: SHOWCASE_TASK_STATE_SHEET, requiredHeaders: SHOWCASE_TASK_STATE_HEADERS },
    { sheetName: HOLIDAY_WORKFLOW_STATE_SHEET, requiredHeaders: HOLIDAY_WORKFLOW_STATE_HEADERS },
    { sheetName: SCHEDULE_CONTEXT_SHEET, requiredHeaders: SCHEDULE_CONTEXT_HEADERS },
    { sheetName: PARENT_UNDERSTANDING_STATE_SHEET, requiredHeaders: PARENT_UNDERSTANDING_STATE_HEADERS },
    { sheetName: TUTOR_ABSENCE_STATE_SHEET, requiredHeaders: TUTOR_ABSENCE_STATE_HEADERS },
    { sheetName: PLANNING_ITEMS_SHEET, requiredHeaders: PLANNING_ITEMS_HEADERS },
    { sheetName: PLANNING_PROGRESS_LOG_SHEET, requiredHeaders: PLANNING_PROGRESS_LOG_HEADERS },
    { sheetName: PRACTICE_NOTES_LOG_SHEET, requiredHeaders: PRACTICE_NOTES_LOG_HEADERS },
    { sheetName: COMMUNICATION_LOG_SHEET, requiredHeaders: COMMUNICATION_LOG_HEADERS },
    { sheetName: INCOMING_MESSAGE_INBOX_SHEET, requiredHeaders: INCOMING_MESSAGE_INBOX_HEADERS },
    { sheetName: WHATSAPP_GROUP_MAP_SHEET, requiredHeaders: WHATSAPP_GROUP_MAP_HEADERS },
    { sheetName: STUDENTS_ARCHIVE_SHEET, requiredHeaders: buildStudentsArchiveHeaders(studentHeaders) },
    { sheetName: TUTOR_PAY_SHEET, requiredHeaders: TUTOR_PAY_HEADERS },
    { sheetName: TUTOR_WISE_SHEET, requiredHeaders: TUTOR_WISE_HEADERS },
    { sheetName: EXPENSES_SHEET, requiredHeaders: EXPENSES_HEADERS },
    { sheetName: EXPENSE_LOG_SHEET, requiredHeaders: EXPENSE_LOG_HEADERS },
    { sheetName: FINANCE_SNAPSHOT_SHEET, requiredHeaders: FINANCE_SNAPSHOT_HEADERS },
    { sheetName: PAYROLL_RUNS_SHEET, requiredHeaders: PAYROLL_RUNS_HEADERS },
    { sheetName: STRIPE_AMOUNTS_CACHE_SHEET, requiredHeaders: STRIPE_AMOUNTS_CACHE_HEADERS },
    { sheetName: STRIPE_COLLECTED_MONTHLY_SHEET, requiredHeaders: STRIPE_COLLECTED_MONTHLY_HEADERS },
  ];
}

export function getSheetsEnv() {
  return {
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
    refreshToken: process.env.SHEETS_REFRESH_TOKEN || '',
    clientId: process.env.SHEETS_CLIENT_ID || '',
    clientSecret: process.env.SHEETS_CLIENT_SECRET || '',
  };
}

function cloneSheetValues(values = []) {
  return values.map((row) => [...row]);
}

function parseSheetNameFromRange(range = '') {
  const [sheetPart] = `${range || ''}`.split('!');
  return sheetPart.replace(/^'/u, '').replace(/'$/u, '').replace(/''/g, "'").trim();
}

function buildReadCacheKey({ spreadsheetId, range }) {
  return `${spreadsheetId}::${range}`;
}

// Google Sheets occasionally returns transient errors (503 service unavailable,
// 429 rate limit, 5xx). Retry those with backoff so a momentary blip self-heals
// instead of failing a page load or the schedule-refresh cron.
const TRANSIENT_SHEETS_STATUSES = new Set([429, 500, 502, 503, 504]);

export async function withSheetsRetry(operation, { attempts = 4, baseDelayMs = 600 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const status = error?.code || error?.response?.status || error?.status;
      if (!TRANSIENT_SHEETS_STATUSES.has(Number(status)) || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (2 ** attempt)));
    }
  }
  throw lastError;
}

export function getCachedSheetValues({ spreadsheetId, range }) {
  const key = buildReadCacheKey({ spreadsheetId, range });
  const cached = sheetReadCache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    return null;
  }

  return cloneSheetValues(cached.values);
}

export function getStaleCachedSheetValues({ spreadsheetId, range }) {
  const key = buildReadCacheKey({ spreadsheetId, range });
  const cached = sheetReadCache.get(key);

  if (!cached) {
    return null;
  }

  const cachedAt = cached.cachedAt || (cached.expiresAt - SHEETS_READ_TTL_MS);
  const age = Date.now() - cachedAt;

  if (age > SHEETS_READ_HARD_MAX_AGE_MS) {
    sheetReadCache.delete(key);
    return null;
  }

  return {
    values: cloneSheetValues(cached.values),
    isFresh: cached.expiresAt >= Date.now(),
    age,
  };
}

export function setCachedSheetValues({ spreadsheetId, range, values }) {
  const cachedAt = Date.now();
  const key = buildReadCacheKey({ spreadsheetId, range });
  sheetReadCache.set(key, {
    cachedAt,
    expiresAt: cachedAt + SHEETS_READ_TTL_MS,
    values: cloneSheetValues(values),
  });
}

export function clearSheetReadCacheForTests() {
  sheetReadCache.clear();
  sheetReadInflight.clear();
  sheetReadInvalidationVersions.clear();
}

export function invalidateSheetReadCache(sheetName) {
  const targetSheet = `${sheetName || ''}`.trim();
  if (!targetSheet) {
    return;
  }

  sheetReadInvalidationVersions.set(
    targetSheet,
    (sheetReadInvalidationVersions.get(targetSheet) || 0) + 1,
  );

  for (const [key] of sheetReadCache.entries()) {
    const [, range = ''] = key.split('::');
    if (parseSheetNameFromRange(range) === targetSheet) {
      sheetReadCache.delete(key);
    }
  }

  for (const [key] of sheetReadInflight.entries()) {
    const [, range = ''] = key.split('::');
    if (parseSheetNameFromRange(range) === targetSheet) {
      sheetReadInflight.delete(key);
    }
  }
}

export async function getLocalTokenCredentials() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  try {
    const raw = await readFile(LOCAL_TOKEN_PATH, 'utf8');
    const token = JSON.parse(raw);

    if (!token.refresh_token || !token.client_id || !token.client_secret) {
      return null;
    }

    return {
      refreshToken: token.refresh_token,
      clientId: token.client_id,
      clientSecret: token.client_secret,
    };
  } catch {
    return null;
  }
}

export function mapRowsToObjects(rows) {
  if (!rows?.length) return [];

  const [headers, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => `${cell || ''}`.trim() !== ''))
    .map((row) => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index] ?? '';
      });
      return entry;
    });
}

export function mapRowsToObjectsWithRowNumbers(rows) {
  if (!rows?.length) return [];

  const [headers, ...dataRows] = rows;
  return dataRows
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((cell) => `${cell || ''}`.trim() !== ''))
    .map(({ row, rowNumber }) => {
      const entry = { __rowNumber: rowNumber };
      headers.forEach((header, index) => {
        entry[header] = row[index] ?? '';
      });
      return entry;
    });
}

export function buildSheetRange(sheetName, range = '') {
  const escaped = /[\s']/u.test(sheetName)
    ? `'${sheetName.replace(/'/g, "''")}'`
    : sheetName;
  return range ? `${escaped}!${range}` : escaped;
}

export async function getSheetsClient() {
  if (globalThis.__firstChordSheetsClientPromise) {
    return globalThis.__firstChordSheetsClientPromise;
  }

  globalThis.__firstChordSheetsClientPromise = (async () => {
  const { spreadsheetId, refreshToken, clientId, clientSecret } = getSheetsEnv();
  const localToken = await getLocalTokenCredentials();
  const authConfig = localToken || {
    refreshToken,
    clientId,
    clientSecret,
  };

  if (!spreadsheetId || !authConfig.refreshToken || !authConfig.clientId || !authConfig.clientSecret) {
    return null;
  }

  const auth = new google.auth.OAuth2(authConfig.clientId, authConfig.clientSecret);
  auth.setCredentials({ refresh_token: authConfig.refreshToken });

  return google.sheets({ version: 'v4', auth });
  })();

  return globalThis.__firstChordSheetsClientPromise;
}

export async function ensureSheetHeaders({ sheets, spreadsheetId, sheetName, headers, missingHeaders }) {
  if (!missingHeaders.length) {
    return headers;
  }

  const nextHeaders = [...headers, ...missingHeaders];
  const endColumn = columnNumberToLetter(nextHeaders.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:${endColumn}1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [nextHeaders],
    },
  });

  return nextHeaders;
}

const SPREADSHEET_METADATA_TTL_MS = 60 * 1000;
const spreadsheetMetadataCache = new Map(); // spreadsheetId -> { at, sheets }

// Spreadsheet (tab list) metadata is read by ensureManagedSheet for every managed tab.
// Cache it briefly so a page that touches several managed tabs shares ONE metadata read,
// and retry on transient 429/5xx instead of crashing (read-quota resilience).
export async function getSpreadsheetMetadata({ sheets, spreadsheetId, forceRefresh = false }) {
  const cached = spreadsheetMetadataCache.get(spreadsheetId);
  if (!forceRefresh && cached && Date.now() - cached.at < SPREADSHEET_METADATA_TTL_MS) {
    return cached.sheets;
  }
  const response = await withSheetsRetry(() => sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
    fields: 'sheets.properties.title,sheets.properties.sheetId',
  }));
  const sheetList = response.data.sheets || [];
  spreadsheetMetadataCache.set(spreadsheetId, { at: Date.now(), sheets: sheetList });
  return sheetList;
}

export async function ensureManagedSheet({ sheets, spreadsheetId, sheetName, requiredHeaders }) {
  const cacheKey = `${spreadsheetId}:${sheetName}`;
  const cachedHeaders = managedSheetHeadersCache.get(cacheKey);
  if (cachedHeaders?.length) {
    const missingHeaders = requiredHeaders.filter((header) => !cachedHeaders.includes(header));
    if (!missingHeaders.length) {
      return cachedHeaders;
    }
  }

  let spreadsheetSheets = await getSpreadsheetMetadata({ sheets, spreadsheetId });
  let existingSheet = spreadsheetSheets.find((entry) => entry.properties?.title === sheetName);

  // A cached "not found" could be stale — confirm with a fresh fetch before creating, so
  // the metadata cache can never cause a duplicate addSheet.
  if (!existingSheet) {
    spreadsheetSheets = await getSpreadsheetMetadata({ sheets, spreadsheetId, forceRefresh: true });
    existingSheet = spreadsheetSheets.find((entry) => entry.properties?.title === sheetName);
  }

  if (!existingSheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });
    spreadsheetMetadataCache.delete(spreadsheetId);

    const endColumn = columnNumberToLetter(requiredHeaders.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: buildSheetRange(sheetName, `A1:${endColumn}1`),
      valueInputOption: 'RAW',
      requestBody: {
        values: [requiredHeaders],
      },
    });

    managedSheetHeadersCache.set(cacheKey, requiredHeaders);
    return requiredHeaders;
  }

  const response = await withSheetsRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: buildSheetRange(sheetName, '1:1'),
  }));

  const headers = response.data.values?.[0] || [];
  if (!headers.length) {
    const endColumn = columnNumberToLetter(requiredHeaders.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: buildSheetRange(sheetName, `A1:${endColumn}1`),
      valueInputOption: 'RAW',
      requestBody: {
        values: [requiredHeaders],
      },
    });

    managedSheetHeadersCache.set(cacheKey, requiredHeaders);
    return requiredHeaders;
  }

  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  const nextHeaders = await ensureSheetHeaders({
    sheets,
    spreadsheetId,
    sheetName,
    headers,
    missingHeaders,
  });
  managedSheetHeadersCache.set(cacheKey, nextHeaders);
  return nextHeaders;
}

export async function upsertManagedSheetRow({
  sheets,
  spreadsheetId,
  sheetName,
  requiredHeaders,
  valuesByHeader,
  matchesRow,
}) {
  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName,
    requiredHeaders,
  });

  const values = await getSheetValues(sheetName);
  const [, ...rows] = values;
  const targetRowIndex = rows.findIndex((entry) => matchesRow(entry, headers));
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');
  const endColumn = columnNumberToLetter(headers.length);

  if (targetRowIndex === -1) {
    await withSheetsRetry(() => sheets.spreadsheets.values.append({
      spreadsheetId,
      range: buildSheetRange(sheetName, 'A:A'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [nextRow],
      },
    }));
    invalidateSheetReadCache(sheetName);
    return;
  }

  const rowNumber = targetRowIndex + 2;
  await withSheetsRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range: buildSheetRange(sheetName, `A${rowNumber}:${endColumn}${rowNumber}`),
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [nextRow],
    },
  }));
  invalidateSheetReadCache(sheetName);
}

export async function getSheetObjects(range) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  const response = await withSheetsRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  }));

  return mapRowsToObjects(response.data.values || []);
}

export async function getSheetValues(range) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  const key = buildReadCacheKey({ spreadsheetId, range });
  const inFlight = sheetReadInflight.get(key);
  const cached = getStaleCachedSheetValues({ spreadsheetId, range });

  if (cached?.isFresh) {
    return cached.values;
  }

  if (cached) {
    if (!inFlight) {
      refreshSheetValues({ sheets, spreadsheetId, range, key }).catch((error) => {
        console.warn(`Sheets background refresh failed for ${range}:`, error?.message || error);
      });
    }
    return cached.values;
  }

  if (inFlight) {
    return cloneSheetValues(await inFlight);
  }

  return cloneSheetValues(await refreshSheetValues({ sheets, spreadsheetId, range, key }));
}

async function refreshSheetValues({ sheets, spreadsheetId, range, key }) {
  const sheetName = parseSheetNameFromRange(range);
  const invalidationVersion = sheetReadInvalidationVersions.get(sheetName) || 0;
  const request = withSheetsRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  }))
    .then((response) => {
      const values = response.data.values || [];
      if ((sheetReadInvalidationVersions.get(sheetName) || 0) === invalidationVersion) {
        setCachedSheetValues({ spreadsheetId, range, values });
      }
      return cloneSheetValues(values);
    })
    .finally(() => {
      sheetReadInflight.delete(key);
    });

  sheetReadInflight.set(key, request);
  return request;
}

export async function ensureDashboardStateTabs() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const studentsValues = await getSheetValues('Students');
  const studentHeaders = studentsValues[0] || [];
  if (!studentHeaders.length) {
    throw new Error('Students sheet is empty or unavailable');
  }

  const results = [];
  for (const definition of buildManagedStateSheetDefinitions(studentHeaders)) {
    const headers = await ensureManagedSheet({
      sheets,
      spreadsheetId,
      sheetName: definition.sheetName,
      requiredHeaders: definition.requiredHeaders,
    });
    results.push({
      sheetName: definition.sheetName,
      headerCount: headers.length,
    });
  }

  return results;
}
