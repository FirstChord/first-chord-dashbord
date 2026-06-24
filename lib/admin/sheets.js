import { google } from 'googleapis';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { buildPracticeNoteLogSheetRow, normalisePracticeNoteLogRow } from './practice-notes-helpers.mjs';
import { columnNumberToLetter, findTutorInsertRow } from './sheets-helpers.mjs';

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const LOCAL_TOKEN_PATH = path.join(homedir(), 'token_musiclessons.json');
const managedSheetHeadersCache = new Map();
const sheetReadCache = new Map();
// Repeat navigations within this window reuse cached sheet reads (snappier page
// moves). Dashboard writes call invalidateSheetReadCache for the affected tab, so
// the admin's own edits still appear immediately — only passive cross-source drift
// can lag up to this long.
const SHEETS_READ_TTL_MS = 60_000;
const ISSUE_QUEUE_SHEET = 'Issue_Queue';
const EVENT_LOG_SHEET = 'Event_Log';
const SHOWCASE_TASK_STATE_SHEET = 'Showcase_Task_State';
const HOLIDAY_WORKFLOW_STATE_SHEET = 'Holiday_Workflow_State';
const WAITING_LIST_STATE_SHEET = 'Waiting_List_State';
const SCHEDULE_CONTEXT_SHEET = 'Schedule_Context';
const PARENT_UNDERSTANDING_STATE_SHEET = 'Parent_Understanding_State';
const TUTOR_ABSENCE_STATE_SHEET = 'Tutor_Absence_State';
const PLANNING_ITEMS_SHEET = 'Planning_Items';
const PLANNING_PROGRESS_LOG_SHEET = 'Planning_Progress_Log';
const PRACTICE_NOTES_LOG_SHEET = 'Practice_Notes_Log';
const COMMUNICATION_LOG_SHEET = 'Communication_Log';
const STUDENTS_ARCHIVE_SHEET = 'Students_Archive';
const TUTOR_PAY_SHEET = 'Tutor_Pay';
const EXPENSES_SHEET = 'Expenses';
const EXPENSE_LOG_SHEET = 'Expense_Log';
const FINANCE_SNAPSHOT_SHEET = 'Finance_Snapshot';
const TUTOR_PAY_HEADERS = ['tutor', 'pay_model', 'hourly_rate', 'monthly_salary', 'notes'];
const EXPENSES_HEADERS = ['name', 'amount', 'period', 'category', 'notes'];
const EXPENSE_LOG_HEADERS = [
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
const FINANCE_SNAPSHOT_HEADERS = [
  'snapshot_id',
  'snapshot_at',
  'period_type',
  'active_count',
  'paused_count',
  'setup_pending_count',
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
const ISSUE_QUEUE_HEADERS = [
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
const EVENT_LOG_HEADERS = [
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
const SHOWCASE_TASK_STATE_HEADERS = [
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
const HOLIDAY_WORKFLOW_STATE_HEADERS = [
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
const WAITING_LIST_STATE_HEADERS = [
  'mms_id',
  'status',
  'note',
  'parent_name',
  'parent_email',
  'date_started',
  'updated_at',
];
const SCHEDULE_CONTEXT_HEADERS = [
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
const PARENT_UNDERSTANDING_STATE_HEADERS = [
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
const TUTOR_ABSENCE_STATE_HEADERS = [
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
const PLANNING_ITEMS_HEADERS = [
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
];
const PLANNING_PROGRESS_LOG_HEADERS = [
  'progress_id',
  'planning_id',
  'progress_note',
  'progress_type',
  'created_at',
  'created_by',
];
const PRACTICE_NOTES_LOG_HEADERS = [
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
const COMMUNICATION_LOG_HEADERS = [
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

function buildStudentsArchiveHeaders(studentHeaders = []) {
  return [
    'archived_at',
    'archived_by',
    'archive_note',
    ...studentHeaders,
  ];
}

function buildManagedStateSheetDefinitions(studentHeaders = []) {
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
    { sheetName: STUDENTS_ARCHIVE_SHEET, requiredHeaders: buildStudentsArchiveHeaders(studentHeaders) },
    { sheetName: TUTOR_PAY_SHEET, requiredHeaders: TUTOR_PAY_HEADERS },
    { sheetName: EXPENSES_SHEET, requiredHeaders: EXPENSES_HEADERS },
    { sheetName: EXPENSE_LOG_SHEET, requiredHeaders: EXPENSE_LOG_HEADERS },
    { sheetName: FINANCE_SNAPSHOT_SHEET, requiredHeaders: FINANCE_SNAPSHOT_HEADERS },
  ];
}

function getSheetsEnv() {
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

async function withSheetsRetry(operation, { attempts = 4, baseDelayMs = 600 } = {}) {
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

function getCachedSheetValues({ spreadsheetId, range }) {
  const key = buildReadCacheKey({ spreadsheetId, range });
  const cached = sheetReadCache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    sheetReadCache.delete(key);
    return null;
  }

  return cloneSheetValues(cached.values);
}

function setCachedSheetValues({ spreadsheetId, range, values }) {
  const key = buildReadCacheKey({ spreadsheetId, range });
  sheetReadCache.set(key, {
    expiresAt: Date.now() + SHEETS_READ_TTL_MS,
    values: cloneSheetValues(values),
  });
}

function invalidateSheetReadCache(sheetName) {
  const targetSheet = `${sheetName || ''}`.trim();
  if (!targetSheet) {
    return;
  }

  for (const [key] of sheetReadCache.entries()) {
    const [, range = ''] = key.split('::');
    if (parseSheetNameFromRange(range) === targetSheet) {
      sheetReadCache.delete(key);
    }
  }
}

async function getLocalTokenCredentials() {
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

function mapRowsToObjects(rows) {
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

function mapRowsToObjectsWithRowNumbers(rows) {
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

function buildSheetRange(sheetName, range = '') {
  const escaped = /[\s']/u.test(sheetName)
    ? `'${sheetName.replace(/'/g, "''")}'`
    : sheetName;
  return range ? `${escaped}!${range}` : escaped;
}

async function getSheetsClient() {
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

async function ensureSheetHeaders({ sheets, spreadsheetId, sheetName, headers, missingHeaders }) {
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

async function getSpreadsheetMetadata({ sheets, spreadsheetId }) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  return response.data.sheets || [];
}

async function ensureManagedSheet({ sheets, spreadsheetId, sheetName, requiredHeaders }) {
  const cacheKey = `${spreadsheetId}:${sheetName}`;
  const cachedHeaders = managedSheetHeadersCache.get(cacheKey);
  if (cachedHeaders?.length) {
    const missingHeaders = requiredHeaders.filter((header) => !cachedHeaders.includes(header));
    if (!missingHeaders.length) {
      return cachedHeaders;
    }
  }

  const spreadsheetSheets = await getSpreadsheetMetadata({ sheets, spreadsheetId });
  const existingSheet = spreadsheetSheets.find((entry) => entry.properties?.title === sheetName);

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

async function upsertManagedSheetRow({
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

  const cached = getCachedSheetValues({ spreadsheetId, range });
  if (cached) {
    return cached;
  }

  const response = await withSheetsRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  }));

  const values = response.data.values || [];
  setCachedSheetValues({ spreadsheetId, range, values });
  return cloneSheetValues(values);
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

export async function getStudentsSheetRows() {
  return getSheetObjects('Students');
}

export async function getReviewFlagsRows() {
  return getSheetObjects('Review_Flags');
}

export async function getPauseHistoryRows() {
  return getSheetObjects("'Pause History'");
}

export async function getIssueQueueRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: ISSUE_QUEUE_SHEET,
    requiredHeaders: ISSUE_QUEUE_HEADERS,
  });

  // Cache the raw read (TTL) so repeat reads within the window — e.g. the overview
  // and the flags page — don't each re-fetch and burn the per-minute read quota.
  // Issue writes go through upsertManagedSheetRow/upsertIssueQueueRows, both of which
  // invalidate this sheet's cache, so a resolve/update is reflected immediately.
  const range = buildSheetRange(ISSUE_QUEUE_SHEET);
  let values = getCachedSheetValues({ spreadsheetId, range });
  if (!values) {
    const response = await withSheetsRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    }));
    values = response.data.values || [];
    setCachedSheetValues({ spreadsheetId, range, values });
  }

  const rows = mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    issueId: row.issue_id || '',
    source: row.source || '',
    issueType: row.issue_type || '',
    mmsId: row.mms_id || '',
    contextKey: row.context_key || '',
    studentName: row.student_name || '',
    severity: row.severity || '',
    status: row.status || '',
    owner: row.owner || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    resolvedAt: row.resolved_at || '',
    ignoredAt: row.ignored_at || '',
    acknowledgedAt: row.acknowledged_at || '',
    lastSeenAt: row.last_seen_at || '',
    sourcePresent: normaliseBooleanCell(row.source_present),
    summary: row.summary || '',
    detail: row.detail || '',
    recommendedAction: row.recommended_action || '',
    systemsAffected: row.systems_affected || '',
    resolutionNote: row.resolution_note || '',
  }));

  return dedupeIssueQueueRows(rows);
}

export async function getShowcaseTaskStateRows(workflowKey = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: SHOWCASE_TASK_STATE_SHEET,
    requiredHeaders: SHOWCASE_TASK_STATE_HEADERS,
  });

  const values = await getSheetValues(SHOWCASE_TASK_STATE_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    workflowKey: row.workflow_key || '',
    season: row.season || '',
    year: row.year || '',
    groupId: row.group_id || '',
    taskId: row.task_id || '',
    taskLabel: row.task_label || '',
    completed: row.completed || '',
    completedAt: row.completed_at || '',
    updatedAt: row.updated_at || '',
  })).filter((row) => (!workflowKey || row.workflowKey === workflowKey));
}

function buildShowcaseTaskStateSheetRow(row) {
  return {
    workflow_key: row.workflowKey || '',
    season: row.season || '',
    year: row.year || '',
    group_id: row.groupId || '',
    task_id: row.taskId || '',
    task_label: row.taskLabel || '',
    completed: row.completed || '',
    completed_at: row.completedAt || '',
    updated_at: row.updatedAt || '',
  };
}

export async function upsertShowcaseTaskStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildShowcaseTaskStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: SHOWCASE_TASK_STATE_SHEET,
    requiredHeaders: SHOWCASE_TASK_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => (
      `${entry[headers.indexOf('workflow_key')] || ''}`.trim() === row.workflowKey
      && `${entry[headers.indexOf('task_id')] || ''}`.trim() === row.taskId
    ),
  });
}

export async function getWaitingListStateRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: WAITING_LIST_STATE_SHEET,
    requiredHeaders: WAITING_LIST_STATE_HEADERS,
  });

  const values = await getSheetValues(WAITING_LIST_STATE_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    mmsId: row.mms_id || '',
    status: row.status || '',
    note: row.note || '',
    parentName: row.parent_name || '',
    parentEmail: row.parent_email || '',
    dateStarted: row.date_started || '',
    updatedAt: row.updated_at || '',
  }));
}

export async function getScheduleContextRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: SCHEDULE_CONTEXT_SHEET,
    requiredHeaders: SCHEDULE_CONTEXT_HEADERS,
  });

  const values = await getSheetValues(SCHEDULE_CONTEXT_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    mmsId: row.mms_id || '',
    studentName: row.student_name || '',
    status: row.status || '',
    nextLessonAt: row.next_lesson_at || '',
    usualWeekday: row.usual_weekday || '',
    usualTime: row.usual_time || '',
    durationMinutes: row.duration_minutes || '',
    teacherId: row.teacher_id || '',
    teacherName: row.teacher_name || '',
    eventCategory: row.event_category || '',
    seriesId: row.series_id || '',
    source: row.source || '',
    confidence: row.confidence || '',
    warnings: row.warnings ? row.warnings.split(' | ').map((warning) => warning.trim()).filter(Boolean) : [],
    checkedAt: row.checked_at || '',
  }));
}

export async function getParentUnderstandingStateRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PARENT_UNDERSTANDING_STATE_SHEET,
    requiredHeaders: PARENT_UNDERSTANDING_STATE_HEADERS,
  });

  const values = await getSheetValues(PARENT_UNDERSTANDING_STATE_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    recordId: row.record_id || '',
    studentMmsId: row.student_mms_id || '',
    studentName: row.student_name || '',
    parentName: row.parent_name || '',
    workflowStatus: row.workflow_status || '',
    loopStatus: row.loop_status || '',
    callAttemptCount: row.call_attempt_count || '',
    lastContactedAt: row.last_contacted_at || '',
    understandingScore: row.understanding_score || '',
    understandingLabel: row.understanding_label || '',
    riskSignals: row.risk_signals ? row.risk_signals.split(' | ').map((signal) => signal.trim()).filter(Boolean) : [],
    whatsappUnderstanding: row.whatsapp_understanding || row.preferred_contact_method || '',
    bestContactTime: row.best_contact_time || '',
    communityGroupStatus: row.community_group_status || '',
    feedbackSummary: row.feedback_summary || '',
    tutorRelevance: row.tutor_relevance || '',
    adminFollowUpNote: row.admin_follow_up_note || '',
    summary: row.summary || '',
    detailsJson: row.details_json || '',
    updatedAt: row.updated_at || '',
    updatedBy: row.updated_by || '',
  }));
}

function buildScheduleContextSheetRow(row) {
  return {
    mms_id: row.mmsId || '',
    student_name: row.studentName || '',
    status: row.status || '',
    next_lesson_at: row.nextLessonAt || '',
    usual_weekday: row.usualWeekday || '',
    usual_time: row.usualTime || '',
    duration_minutes: row.durationMinutes || '',
    teacher_id: row.teacherId || '',
    teacher_name: row.teacherName || '',
    event_category: row.eventCategory || '',
    series_id: row.seriesId || '',
    source: row.source || '',
    confidence: row.confidence || '',
    warnings: Array.isArray(row.warnings) ? row.warnings.join(' | ') : row.warnings || '',
    checked_at: row.checkedAt || '',
  };
}

export async function upsertScheduleContextRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildScheduleContextSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: SCHEDULE_CONTEXT_SHEET,
    requiredHeaders: SCHEDULE_CONTEXT_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('mms_id')] || ''}`.trim() === row.mmsId,
  });
}

function buildParentUnderstandingStateSheetRow(row) {
  return {
    record_id: row.recordId || '',
    student_mms_id: row.studentMmsId || '',
    student_name: row.studentName || '',
    parent_name: row.parentName || '',
    workflow_status: row.workflowStatus || '',
    loop_status: row.loopStatus || '',
    call_attempt_count: row.callAttemptCount || '',
    last_contacted_at: row.lastContactedAt || '',
    understanding_score: row.understandingScore || '',
    understanding_label: row.understandingLabel || '',
    risk_signals: Array.isArray(row.riskSignals) ? row.riskSignals.join(' | ') : row.riskSignals || '',
    whatsapp_understanding: row.whatsappUnderstanding || '',
    best_contact_time: row.bestContactTime || '',
    community_group_status: row.communityGroupStatus || '',
    feedback_summary: row.feedbackSummary || '',
    tutor_relevance: row.tutorRelevance || '',
    admin_follow_up_note: row.adminFollowUpNote || '',
    summary: row.summary || '',
    details_json: row.detailsJson || '',
    updated_at: row.updatedAt || '',
    updated_by: row.updatedBy || '',
  };
}

export async function upsertParentUnderstandingStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildParentUnderstandingStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: PARENT_UNDERSTANDING_STATE_SHEET,
    requiredHeaders: PARENT_UNDERSTANDING_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => (
      `${entry[headers.indexOf('student_mms_id')] || ''}`.trim() === row.studentMmsId
    ),
  });
}

export async function getHolidayWorkflowStateRows(workflowKey = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: HOLIDAY_WORKFLOW_STATE_SHEET,
    requiredHeaders: HOLIDAY_WORKFLOW_STATE_HEADERS,
  });

  const values = await getSheetValues(HOLIDAY_WORKFLOW_STATE_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    workflowKey: row.workflow_key || '',
    season: row.season || '',
    year: row.year || '',
    groupId: row.group_id || '',
    taskId: row.task_id || '',
    taskLabel: row.task_label || '',
    completed: row.completed || '',
    completedAt: row.completed_at || '',
    updatedAt: row.updated_at || '',
  })).filter((row) => (!workflowKey || row.workflowKey === workflowKey));
}

function buildHolidayWorkflowStateSheetRow(row) {
  return {
    workflow_key: row.workflowKey || '',
    season: row.season || '',
    year: row.year || '',
    group_id: row.groupId || '',
    task_id: row.taskId || '',
    task_label: row.taskLabel || '',
    completed: row.completed || '',
    completed_at: row.completedAt || '',
    updated_at: row.updatedAt || '',
  };
}

export async function upsertHolidayWorkflowStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildHolidayWorkflowStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: HOLIDAY_WORKFLOW_STATE_SHEET,
    requiredHeaders: HOLIDAY_WORKFLOW_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => (
      `${entry[headers.indexOf('workflow_key')] || ''}`.trim() === row.workflowKey
      && `${entry[headers.indexOf('task_id')] || ''}`.trim() === row.taskId
    ),
  });
}

export async function getTutorAbsenceStateRows(absenceId = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: TUTOR_ABSENCE_STATE_SHEET,
    requiredHeaders: TUTOR_ABSENCE_STATE_HEADERS,
  });

  const values = await getSheetValues(TUTOR_ABSENCE_STATE_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    absenceId: row.absence_id || '',
    tutorShortName: row.tutor_short_name || '',
    tutorName: row.tutor_name || '',
    absenceDate: row.absence_date || '',
    status: row.status || '',
    decision: row.decision || '',
    coverTutorShortName: row.cover_tutor_short_name || '',
    coverTutorName: row.cover_tutor_name || '',
    affectedLessonsJson: row.affected_lessons_json || '',
    messageStateJson: row.message_state_json || '',
    note: row.note || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    resolvedAt: row.resolved_at || '',
    updatedBy: row.updated_by || '',
  })).filter((row) => (!absenceId || row.absenceId === absenceId));
}

function buildTutorAbsenceStateSheetRow(row) {
  return {
    absence_id: row.absenceId || '',
    tutor_short_name: row.tutorShortName || '',
    tutor_name: row.tutorName || '',
    absence_date: row.absenceDate || '',
    status: row.status || '',
    decision: row.decision || '',
    cover_tutor_short_name: row.coverTutorShortName || '',
    cover_tutor_name: row.coverTutorName || '',
    affected_lessons_json: row.affectedLessonsJson || '',
    message_state_json: row.messageStateJson || '',
    note: row.note || '',
    created_at: row.createdAt || '',
    updated_at: row.updatedAt || '',
    resolved_at: row.resolvedAt || '',
    updated_by: row.updatedBy || '',
  };
}

export async function upsertTutorAbsenceStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildTutorAbsenceStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: TUTOR_ABSENCE_STATE_SHEET,
    requiredHeaders: TUTOR_ABSENCE_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('absence_id')] || ''}`.trim() === row.absenceId,
  });
}

export async function deleteTutorAbsenceStateRow(absenceId = '') {
  const targetAbsenceId = `${absenceId || ''}`.trim();
  if (!targetAbsenceId) {
    throw new Error('absenceId is required');
  }

  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: TUTOR_ABSENCE_STATE_SHEET,
    requiredHeaders: TUTOR_ABSENCE_STATE_HEADERS,
  });

  const rows = await getTutorAbsenceStateRows(targetAbsenceId);
  const rowNumber = rows[0]?.rowNumber;

  if (!rowNumber) {
    return { deleted: false, absenceId: targetAbsenceId };
  }

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [TUTOR_ABSENCE_STATE_SHEET],
    includeGridData: false,
  });
  const sheet = metadata.data.sheets?.find((entry) => entry.properties?.title === TUTOR_ABSENCE_STATE_SHEET);
  const sheetId = sheet?.properties?.sheetId;

  if (typeof sheetId !== 'number') {
    throw new Error('Could not resolve Tutor_Absence_State sheet metadata');
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });

  invalidateSheetReadCache(TUTOR_ABSENCE_STATE_SHEET);

  return { deleted: true, absenceId: targetAbsenceId, rowNumber };
}

export async function getPlanningItemRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PLANNING_ITEMS_SHEET,
    requiredHeaders: PLANNING_ITEMS_HEADERS,
  });

  const values = await getSheetValues(PLANNING_ITEMS_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    planningId: row.planning_id || '',
    title: row.title || '',
    notes: row.notes || '',
    itemType: row.item_type || '',
    owner: row.owner || '',
    status: row.status || '',
    area: row.area || '',
    linkedWorkflowId: row.linked_workflow_id || '',
    linkedStudentId: row.linked_student_id || '',
    linkedTutorId: row.linked_tutor_id || '',
    parentPlanningId: row.parent_planning_id || '',
    outcome: row.outcome || '',
    nextAction: row.next_action || '',
    targetDate: row.target_date || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    createdBy: row.created_by || '',
    lastUpdatedBy: row.last_updated_by || '',
  }));
}

export async function getPlanningProgressLogRows(planningId = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PLANNING_PROGRESS_LOG_SHEET,
    requiredHeaders: PLANNING_PROGRESS_LOG_HEADERS,
  });

  const values = await getSheetValues(PLANNING_PROGRESS_LOG_SHEET);

  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    progressId: row.progress_id || '',
    planningId: row.planning_id || '',
    progressNote: row.progress_note || '',
    progressType: row.progress_type || '',
    createdAt: row.created_at || '',
    createdBy: row.created_by || '',
  })).filter((row) => (!planningId || row.planningId === planningId));
}

export async function getPracticeNoteLogRows(studentMmsId = '') {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PRACTICE_NOTES_LOG_SHEET,
    requiredHeaders: PRACTICE_NOTES_LOG_HEADERS,
  });

  const values = await getSheetValues(PRACTICE_NOTES_LOG_SHEET);
  return mapRowsToObjectsWithRowNumbers(values)
    .map((row) => ({
      rowNumber: row.__rowNumber,
      ...normalisePracticeNoteLogRow(row),
    }))
    .filter((row) => (!studentMmsId || row.studentMmsId === studentMmsId))
    .sort((a, b) => {
      const aTime = new Date(a.emailSentAt || a.createdAt || a.lessonDate || '').getTime();
      const bTime = new Date(b.emailSentAt || b.createdAt || b.lessonDate || '').getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    });
}

function buildPlanningItemSheetRow(row) {
  return {
    planning_id: row.planningId || '',
    title: row.title || '',
    notes: row.notes || '',
    item_type: row.itemType || '',
    owner: row.owner || '',
    status: row.status || '',
    area: row.area || '',
    linked_workflow_id: row.linkedWorkflowId || '',
    linked_student_id: row.linkedStudentId || '',
    linked_tutor_id: row.linkedTutorId || '',
    parent_planning_id: row.parentPlanningId || '',
    outcome: row.outcome || '',
    next_action: row.nextAction || '',
    target_date: row.targetDate || '',
    created_at: row.createdAt || '',
    updated_at: row.updatedAt || '',
    created_by: row.createdBy || '',
    last_updated_by: row.lastUpdatedBy || '',
  };
}

export async function upsertPlanningItemRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildPlanningItemSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: PLANNING_ITEMS_SHEET,
    requiredHeaders: PLANNING_ITEMS_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('planning_id')] || ''}`.trim() === row.planningId,
  });
}

function buildPlanningProgressLogSheetRow(row) {
  return {
    progress_id: row.progressId || '',
    planning_id: row.planningId || '',
    progress_note: row.progressNote || '',
    progress_type: row.progressType || '',
    created_at: row.createdAt || '',
    created_by: row.createdBy || '',
  };
}

export async function appendPlanningProgressLogRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PLANNING_PROGRESS_LOG_SHEET,
    requiredHeaders: PLANNING_PROGRESS_LOG_HEADERS,
  });
  const valuesByHeader = buildPlanningProgressLogSheetRow(row);
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(PLANNING_PROGRESS_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(PLANNING_PROGRESS_LOG_SHEET);
}

// --- Financial layer (read-only revenue/cost) -----------------------------------
// Tutor_Pay and Expenses are manually-curated config tabs (sensitive: salaries live
// here, never in the repo). Finance_Snapshot is an append-only time series.

async function getManagedSheetObjects(sheetName, requiredHeaders) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) return [];
  await ensureManagedSheet({ sheets, spreadsheetId, sheetName, requiredHeaders });
  const values = await getSheetValues(sheetName);
  return mapRowsToObjects(values);
}

export async function getTutorPayRows() {
  return getManagedSheetObjects(TUTOR_PAY_SHEET, TUTOR_PAY_HEADERS);
}

export async function getExpenseRows() {
  return getManagedSheetObjects(EXPENSES_SHEET, EXPENSES_HEADERS);
}

export async function getExpenseLogRows() {
  return getManagedSheetObjects(EXPENSE_LOG_SHEET, EXPENSE_LOG_HEADERS);
}

export async function getFinanceSnapshotRows() {
  return getManagedSheetObjects(FINANCE_SNAPSHOT_SHEET, FINANCE_SNAPSHOT_HEADERS);
}

export async function appendFinanceSnapshotRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }
  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: FINANCE_SNAPSHOT_SHEET,
    requiredHeaders: FINANCE_SNAPSHOT_HEADERS,
  });
  const nextRow = headers.map((header) => row[header] ?? '');
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(FINANCE_SNAPSHOT_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(FINANCE_SNAPSHOT_SHEET);
}

export async function deleteFinanceSnapshotRow(snapshotId) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }
  const idKey = `${snapshotId || ''}`.trim();
  if (!idKey) return { deleted: false };
  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: FINANCE_SNAPSHOT_SHEET,
    requiredHeaders: FINANCE_SNAPSHOT_HEADERS,
  });
  const values = await getSheetValues(FINANCE_SNAPSHOT_SHEET);
  const [, ...rows] = values;
  const idIdx = headers.indexOf('snapshot_id');
  const rowIndex = rows.findIndex((entry) => `${entry[idIdx] || ''}`.trim() === idKey);
  if (rowIndex === -1) return { deleted: false };

  const metadata = await sheets.spreadsheets.get({ spreadsheetId, ranges: [FINANCE_SNAPSHOT_SHEET], includeGridData: false });
  const sheet = metadata.data.sheets?.find((entry) => entry.properties?.title === FINANCE_SNAPSHOT_SHEET);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId !== 'number') {
    throw new Error('Could not resolve Finance_Snapshot sheet metadata');
  }

  const targetRowNumber = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: targetRowNumber - 1, endIndex: targetRowNumber },
          },
        },
      ],
    },
  });
  invalidateSheetReadCache(FINANCE_SNAPSHOT_SHEET);
  return { deleted: true, rowNumber: targetRowNumber };
}

export async function upsertTutorPayRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }
  const tutorKey = `${row.tutor || ''}`.trim().toLowerCase();
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: TUTOR_PAY_SHEET,
    requiredHeaders: TUTOR_PAY_HEADERS,
    valuesByHeader: {
      tutor: `${row.tutor || ''}`.trim(),
      pay_model: `${row.pay_model || 'hourly'}`.trim(),
      hourly_rate: row.hourly_rate ?? '',
      monthly_salary: row.monthly_salary ?? '',
      notes: row.notes ?? '',
    },
    matchesRow: (entry, headers) => `${entry[headers.indexOf('tutor')] || ''}`.trim().toLowerCase() === tutorKey,
  });
}

export async function upsertExpenseRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }
  const nameKey = `${row.name || ''}`.trim().toLowerCase();
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: EXPENSES_SHEET,
    requiredHeaders: EXPENSES_HEADERS,
    valuesByHeader: {
      name: `${row.name || ''}`.trim(),
      amount: row.amount ?? '',
      period: `${row.period || 'monthly'}`.trim(),
      category: `${row.category || ''}`.trim(),
      notes: row.notes ?? '',
    },
    matchesRow: (entry, headers) => `${entry[headers.indexOf('name')] || ''}`.trim().toLowerCase() === nameKey,
  });
}

export async function deleteExpenseRow(name) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }
  const nameKey = `${name || ''}`.trim().toLowerCase();
  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: EXPENSES_SHEET,
    requiredHeaders: EXPENSES_HEADERS,
  });
  const values = await getSheetValues(EXPENSES_SHEET);
  const [, ...rows] = values;
  const nameIdx = headers.indexOf('name');
  const rowIndex = rows.findIndex((entry) => `${entry[nameIdx] || ''}`.trim().toLowerCase() === nameKey);
  if (rowIndex === -1) {
    return { deleted: false };
  }

  const metadata = await sheets.spreadsheets.get({ spreadsheetId, ranges: [EXPENSES_SHEET], includeGridData: false });
  const sheet = metadata.data.sheets?.find((entry) => entry.properties?.title === EXPENSES_SHEET);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId !== 'number') {
    throw new Error('Could not resolve Expenses sheet metadata');
  }

  const targetRowNumber = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: targetRowNumber - 1, endIndex: targetRowNumber },
          },
        },
      ],
    },
  });
  invalidateSheetReadCache(EXPENSES_SHEET);
  return { deleted: true, rowNumber: targetRowNumber };
}

export async function appendExpenseLogRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }
  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: EXPENSE_LOG_SHEET,
    requiredHeaders: EXPENSE_LOG_HEADERS,
  });
  const nextRow = headers.map((header) => row[header] ?? '');
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(EXPENSE_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(EXPENSE_LOG_SHEET);
}

export async function deleteExpenseLogRow(expenseId) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }
  const idKey = `${expenseId || ''}`.trim();
  if (!idKey) return { deleted: false };
  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: EXPENSE_LOG_SHEET,
    requiredHeaders: EXPENSE_LOG_HEADERS,
  });
  const values = await getSheetValues(EXPENSE_LOG_SHEET);
  const [, ...rows] = values;
  const idIdx = headers.indexOf('expense_id');
  const rowIndex = rows.findIndex((entry) => `${entry[idIdx] || ''}`.trim() === idKey);
  if (rowIndex === -1) return { deleted: false };

  const metadata = await sheets.spreadsheets.get({ spreadsheetId, ranges: [EXPENSE_LOG_SHEET], includeGridData: false });
  const sheet = metadata.data.sheets?.find((entry) => entry.properties?.title === EXPENSE_LOG_SHEET);
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId !== 'number') {
    throw new Error('Could not resolve Expense_Log sheet metadata');
  }

  const targetRowNumber = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: 'ROWS', startIndex: targetRowNumber - 1, endIndex: targetRowNumber },
          },
        },
      ],
    },
  });
  invalidateSheetReadCache(EXPENSE_LOG_SHEET);
  return { deleted: true, rowNumber: targetRowNumber };
}

export async function getCommunicationLogRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: COMMUNICATION_LOG_SHEET,
    requiredHeaders: COMMUNICATION_LOG_HEADERS,
  });

  const values = await getSheetValues(COMMUNICATION_LOG_SHEET);
  return mapRowsToObjectsWithRowNumbers(values).map((row) => ({
    rowNumber: row.__rowNumber,
    messageId: row.message_id || '',
    loggedAt: row.logged_at || '',
    category: row.category || '',
    channel: row.channel || '',
    mmsId: row.mms_id || '',
    studentName: row.student_name || '',
    body: row.body || '',
    source: row.source || '',
    actorEmail: row.actor_email || '',
  }));
}

function buildCommunicationLogSheetRow(entry) {
  return {
    message_id: entry.messageId || '',
    logged_at: entry.loggedAt || '',
    category: entry.category || '',
    channel: entry.channel || '',
    mms_id: entry.mmsId || '',
    student_name: entry.studentName || '',
    body: entry.body || '',
    source: entry.source || '',
    actor_email: entry.actorEmail || '',
  };
}

export async function appendCommunicationLogRow(entry) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: COMMUNICATION_LOG_SHEET,
    requiredHeaders: COMMUNICATION_LOG_HEADERS,
  });
  const valuesByHeader = buildCommunicationLogSheetRow(entry);
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(COMMUNICATION_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(COMMUNICATION_LOG_SHEET);
}

export async function appendPracticeNoteLogRow(note) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: PRACTICE_NOTES_LOG_SHEET,
    requiredHeaders: PRACTICE_NOTES_LOG_HEADERS,
  });
  const valuesByHeader = buildPracticeNoteLogSheetRow(note);

  if (valuesByHeader.note_id) {
    const values = await getSheetValues(PRACTICE_NOTES_LOG_SHEET);
    const existingHeaders = values[0] || [];
    const noteIdIndex = existingHeaders.indexOf('note_id');
    if (noteIdIndex >= 0) {
      const duplicate = values.slice(1).some((row) => row[noteIdIndex] === valuesByHeader.note_id);
      if (duplicate) {
        return {
          skipped: true,
          reason: 'duplicate_note_id',
          noteId: valuesByHeader.note_id,
        };
      }
    }
  }

  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(PRACTICE_NOTES_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(PRACTICE_NOTES_LOG_SHEET);
  return {
    skipped: false,
    noteId: valuesByHeader.note_id,
  };
}

export async function upsertPracticeNoteLogRow(note) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildPracticeNoteLogSheetRow(note);
  const deliveryKey = `${valuesByHeader.delivery_key || ''}`.trim();

  if (!deliveryKey) {
    return appendPracticeNoteLogRow(note);
  }

  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: PRACTICE_NOTES_LOG_SHEET,
    requiredHeaders: PRACTICE_NOTES_LOG_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('delivery_key')] || ''}`.trim() === deliveryKey,
  });

  return {
    skipped: false,
    upserted: true,
    noteId: valuesByHeader.note_id,
    deliveryKey,
  };
}

function buildWaitingListStateSheetRow(row) {
  return {
    mms_id: row.mmsId || '',
    status: row.status || '',
    note: row.note || '',
    parent_name: row.parentName || '',
    parent_email: row.parentEmail || '',
    date_started: row.dateStarted || '',
    updated_at: row.updatedAt || '',
  };
}

export async function upsertWaitingListStateRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildWaitingListStateSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: WAITING_LIST_STATE_SHEET,
    requiredHeaders: WAITING_LIST_STATE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('mms_id')] || ''}`.trim() === row.mmsId,
  });
}

function buildIssueQueueSheetRow(row) {
  return {
    issue_id: row.issueId || '',
    source: row.source || '',
    issue_type: row.issueType || '',
    mms_id: row.mmsId || '',
    context_key: row.contextKey || '',
    student_name: row.studentName || '',
    severity: row.severity || '',
    status: row.status || '',
    owner: row.owner || '',
    created_at: row.createdAt || '',
    updated_at: row.updatedAt || '',
    resolved_at: row.resolvedAt || '',
    ignored_at: row.ignoredAt || '',
    acknowledged_at: row.acknowledgedAt || '',
    last_seen_at: row.lastSeenAt || '',
    source_present: row.sourcePresent || '',
    summary: row.summary || '',
    detail: row.detail || '',
    recommended_action: row.recommendedAction || '',
    systems_affected: row.systemsAffected || '',
    resolution_note: row.resolutionNote || '',
  };
}

function normaliseBooleanCell(value) {
  return `${value || ''}`.trim().toLowerCase() === 'true' ? 'true' : 'false';
}

function dedupeIssueQueueRows(rows = []) {
  const byIssueId = new Map();
  const passthroughRows = [];

  for (const row of rows) {
    if (!row.issueId) {
      passthroughRows.push(row);
      continue;
    }

    const existing = byIssueId.get(row.issueId);
    if (!existing || Number(row.rowNumber || 0) >= Number(existing.rowNumber || 0)) {
      byIssueId.set(row.issueId, row);
    }
  }

  return [
    ...passthroughRows,
    ...byIssueId.values(),
  ].sort((a, b) => Number(a.rowNumber || 0) - Number(b.rowNumber || 0));
}

export async function upsertIssueQueueRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const valuesByHeader = buildIssueQueueSheetRow(row);
  await upsertManagedSheetRow({
    sheets,
    spreadsheetId,
    sheetName: ISSUE_QUEUE_SHEET,
    requiredHeaders: ISSUE_QUEUE_HEADERS,
    valuesByHeader,
    matchesRow: (entry, headers) => `${entry[headers.indexOf('issue_id')] || ''}`.trim() === row.issueId,
  });
}

export async function upsertIssueQueueRows(rowsToSync = []) {
  if (!rowsToSync.length) {
    return;
  }

  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: ISSUE_QUEUE_SHEET,
    requiredHeaders: ISSUE_QUEUE_HEADERS,
  });

  const values = await getSheetValues(ISSUE_QUEUE_SHEET);
  const [, ...existingRows] = values;
  const issueIdIndex = headers.findIndex((header) => header === 'issue_id');
  const existingRowMap = new Map(
    existingRows.map((row, index) => [`${row[issueIdIndex] || ''}`.trim(), index + 2]),
  );
  const endColumn = columnNumberToLetter(headers.length);
  const updates = [];
  const appends = [];

  for (const row of rowsToSync) {
    const valuesByHeader = buildIssueQueueSheetRow(row);
    const nextRow = headers.map((header) => valuesByHeader[header] ?? '');
    const existingRowNumber = existingRowMap.get(row.issueId);

    if (existingRowNumber) {
      updates.push({
        range: buildSheetRange(ISSUE_QUEUE_SHEET, `A${existingRowNumber}:${endColumn}${existingRowNumber}`),
        values: [nextRow],
      });
    } else {
      appends.push(nextRow);
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates,
      },
    });
  }

  if (appends.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: buildSheetRange(ISSUE_QUEUE_SHEET, 'A:A'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: appends,
      },
    });
  }

  invalidateSheetReadCache(ISSUE_QUEUE_SHEET);
}

export async function updateIssueQueueRow(issueId, updates) {
  const rows = await getIssueQueueRows();
  const existingRow = rows.find((row) => row.issueId === issueId);

  if (!existingRow) {
    throw new Error(`Issue queue row ${issueId} was not found`);
  }

  await upsertIssueQueueRow({
    ...existingRow,
    ...updates,
    issueId,
  });
}

function buildEventLogSheetRow(row) {
  return {
    event_id: row.eventId || '',
    occurred_at: row.occurredAt || '',
    actor_email: row.actorEmail || '',
    entity_type: row.entityType || '',
    entity_id: row.entityId || '',
    event_type: row.eventType || '',
    mms_id: row.mmsId || '',
    student_name: row.studentName || '',
    issue_id: row.issueId || '',
    payload_json: row.payloadJson || '',
  };
}

export async function appendEventLogRow(row) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: EVENT_LOG_SHEET,
    requiredHeaders: EVENT_LOG_HEADERS,
  });
  const valuesByHeader = buildEventLogSheetRow(row);
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(EVENT_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(EVENT_LOG_SHEET);
}

export async function appendEventLogRows(rows = []) {
  if (!rows.length) {
    return;
  }

  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: EVENT_LOG_SHEET,
    requiredHeaders: EVENT_LOG_HEADERS,
  });
  const values = rows.map((row) => {
    const valuesByHeader = buildEventLogSheetRow(row);
    return headers.map((header) => valuesByHeader[header] ?? '');
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(EVENT_LOG_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values,
    },
  });
  invalidateSheetReadCache(EVENT_LOG_SHEET);
}

export async function updateStudentSheetRow(mmsId, updates) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const values = await getSheetValues('Students');
  if (!values.length) {
    throw new Error('Students sheet is empty or unavailable');
  }

  let [headers, ...rows] = values;
  const missingHeaders = Object.keys(updates).filter((header) => !headers.includes(header));
  headers = await ensureSheetHeaders({
    sheets,
    spreadsheetId,
    sheetName: 'Students',
    headers,
    missingHeaders,
  });

  const mmsColumnIndex = headers.findIndex((header) => ['mms_id', 'MMS ID', 'MMS Id', 'Student ID'].includes(header));

  if (mmsColumnIndex === -1) {
    throw new Error('Could not find MMS ID column in Students sheet');
  }

  const rowIndex = rows.findIndex((row) => (row[mmsColumnIndex] || '').trim() === mmsId);
  if (rowIndex === -1) {
    throw new Error(`Student ${mmsId} was not found in Students sheet`);
  }

  const targetRowNumber = rowIndex + 2;
  const nextRow = [...rows[rowIndex]];
  nextRow.length = headers.length;

  headers.forEach((header, index) => {
    if (Object.prototype.hasOwnProperty.call(updates, header)) {
      nextRow[index] = updates[header] ?? '';
    } else if (typeof nextRow[index] === 'undefined') {
      nextRow[index] = '';
    }
  });

  const endColumn = columnNumberToLetter(headers.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Students!A${targetRowNumber}:${endColumn}${targetRowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [nextRow],
    },
  });

  invalidateSheetReadCache('Students');

  return { rowNumber: targetRowNumber };
}

export async function archiveAndDeleteStudentSheetRow({ mmsId, archivedAt, archivedBy = '', archiveNote = '' }) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const values = await getSheetValues('Students');
  if (!values.length) {
    throw new Error('Students sheet is empty or unavailable');
  }

  const [headers, ...rows] = values;
  const mmsColumnIndex = headers.findIndex((header) => ['mms_id', 'MMS ID', 'MMS Id', 'Student ID'].includes(header));

  if (mmsColumnIndex === -1) {
    throw new Error('Could not find MMS ID column in Students sheet');
  }

  const rowIndex = rows.findIndex((row) => (row[mmsColumnIndex] || '').trim() === mmsId);
  if (rowIndex === -1) {
    throw new Error(`Student ${mmsId} was not found in Students sheet`);
  }

  const archiveHeaders = buildStudentsArchiveHeaders(headers);
  const managedArchiveHeaders = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: STUDENTS_ARCHIVE_SHEET,
    requiredHeaders: archiveHeaders,
  });
  const rowByHeader = headers.reduce((acc, header, index) => {
    acc[header] = rows[rowIndex][index] ?? '';
    return acc;
  }, {
    archived_at: archivedAt,
    archived_by: archivedBy,
    archive_note: archiveNote,
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(STUDENTS_ARCHIVE_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [managedArchiveHeaders.map((header) => rowByHeader[header] ?? '')],
    },
  });

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: ['Students'],
    includeGridData: false,
  });
  const sheet = metadata.data.sheets?.find((entry) => entry.properties?.title === 'Students');
  const sheetId = sheet?.properties?.sheetId;

  if (typeof sheetId !== 'number') {
    throw new Error('Could not resolve Students sheet metadata');
  }

  const targetRowNumber = rowIndex + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: targetRowNumber - 1,
              endIndex: targetRowNumber,
            },
          },
        },
      ],
    },
  });

  invalidateSheetReadCache('Students');
  invalidateSheetReadCache(STUDENTS_ARCHIVE_SHEET);

  return {
    archived: true,
    deleted: true,
    rowNumber: targetRowNumber,
  };
}

export async function addStudentSheetRow(valuesByHeader) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const values = await getSheetValues('Students');
  if (!values.length) {
    throw new Error('Students sheet is empty or unavailable');
  }

  let [headers, ...rows] = values;
  const missingHeaders = Object.keys(valuesByHeader).filter((header) => !headers.includes(header));
  headers = await ensureSheetHeaders({
    sheets,
    spreadsheetId,
    sheetName: 'Students',
    headers,
    missingHeaders,
  });
  const tutorIndex = headers.findIndex((header) => header === 'Tutor');
  const targetTutor = valuesByHeader.Tutor || '';

  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');
  const insertAt = findTutorInsertRow(rows, tutorIndex, targetTutor);

  if (insertAt <= rows.length + 1) {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: ['Students'],
      includeGridData: false,
    });

    const sheet = metadata.data.sheets?.find((entry) => entry.properties?.title === 'Students');
    const sheetId = sheet?.properties?.sheetId;

    if (typeof sheetId !== 'number') {
      throw new Error('Could not resolve Students sheet metadata');
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: insertAt - 1,
                endIndex: insertAt,
              },
              inheritFromBefore: true,
            },
          },
        ],
      },
    });

    const endColumn = columnNumberToLetter(headers.length);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Students!A${insertAt}:${endColumn}${insertAt}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [nextRow],
      },
    });

    invalidateSheetReadCache('Students');

    return { insertedAt: insertAt };
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Students!A:A',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [nextRow],
    },
  });

  invalidateSheetReadCache('Students');

  return { insertedAt: insertAt };
}
