import { google } from 'googleapis';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { columnNumberToLetter, findTutorInsertRow } from './sheets-helpers.mjs';

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const LOCAL_TOKEN_PATH = path.join(homedir(), 'token_musiclessons.json');
const managedSheetHeadersCache = new Map();
const sheetReadCache = new Map();
const SHEETS_READ_TTL_MS = 15_000;
const ISSUE_QUEUE_SHEET = 'Issue_Queue';
const EVENT_LOG_SHEET = 'Event_Log';
const SHOWCASE_TASK_STATE_SHEET = 'Showcase_Task_State';
const HOLIDAY_WORKFLOW_STATE_SHEET = 'Holiday_Workflow_State';
const WAITING_LIST_STATE_SHEET = 'Waiting_List_State';
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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: buildSheetRange(sheetName, '1:1'),
  });

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

export async function getSheetObjects(range) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    return [];
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const values = response.data.values || [];
  setCachedSheetValues({ spreadsheetId, range, values });
  return cloneSheetValues(values);
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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: buildSheetRange(ISSUE_QUEUE_SHEET),
  });

  return mapRowsToObjectsWithRowNumbers(response.data.values || []).map((row) => ({
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
    sourcePresent: row.source_present || '',
    summary: row.summary || '',
    detail: row.detail || '',
    recommendedAction: row.recommended_action || '',
    systemsAffected: row.systems_affected || '',
    resolutionNote: row.resolution_note || '',
  }));
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

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: SHOWCASE_TASK_STATE_SHEET,
    requiredHeaders: SHOWCASE_TASK_STATE_HEADERS,
  });

  const values = await getSheetValues(SHOWCASE_TASK_STATE_SHEET);
  const [, ...rows] = values;
  const workflowKeyIndex = headers.findIndex((header) => header === 'workflow_key');
  const taskIdIndex = headers.findIndex((header) => header === 'task_id');
  const targetRowIndex = rows.findIndex((entry) => (
    `${entry[workflowKeyIndex] || ''}`.trim() === row.workflowKey
    && `${entry[taskIdIndex] || ''}`.trim() === row.taskId
  ));
  const valuesByHeader = buildShowcaseTaskStateSheetRow(row);
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');
  const endColumn = columnNumberToLetter(headers.length);

  if (targetRowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: buildSheetRange(SHOWCASE_TASK_STATE_SHEET, 'A:A'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [nextRow],
      },
    });
    invalidateSheetReadCache(SHOWCASE_TASK_STATE_SHEET);
    return;
  }

  const rowNumber = targetRowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: buildSheetRange(SHOWCASE_TASK_STATE_SHEET, `A${rowNumber}:${endColumn}${rowNumber}`),
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(SHOWCASE_TASK_STATE_SHEET);
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

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: HOLIDAY_WORKFLOW_STATE_SHEET,
    requiredHeaders: HOLIDAY_WORKFLOW_STATE_HEADERS,
  });

  const values = await getSheetValues(HOLIDAY_WORKFLOW_STATE_SHEET);
  const [, ...rows] = values;
  const workflowKeyIndex = headers.findIndex((header) => header === 'workflow_key');
  const taskIdIndex = headers.findIndex((header) => header === 'task_id');
  const targetRowIndex = rows.findIndex((entry) => (
    `${entry[workflowKeyIndex] || ''}`.trim() === row.workflowKey
    && `${entry[taskIdIndex] || ''}`.trim() === row.taskId
  ));
  const valuesByHeader = buildHolidayWorkflowStateSheetRow(row);
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');
  const endColumn = columnNumberToLetter(headers.length);

  if (targetRowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: buildSheetRange(HOLIDAY_WORKFLOW_STATE_SHEET, 'A:A'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [nextRow],
      },
    });
    invalidateSheetReadCache(HOLIDAY_WORKFLOW_STATE_SHEET);
    return;
  }

  const rowNumber = targetRowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: buildSheetRange(HOLIDAY_WORKFLOW_STATE_SHEET, `A${rowNumber}:${endColumn}${rowNumber}`),
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(HOLIDAY_WORKFLOW_STATE_SHEET);
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

  const headers = await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: WAITING_LIST_STATE_SHEET,
    requiredHeaders: WAITING_LIST_STATE_HEADERS,
  });

  const values = await getSheetValues(WAITING_LIST_STATE_SHEET);
  const [, ...rows] = values;
  const mmsIdIndex = headers.findIndex((header) => header === 'mms_id');
  const targetRowIndex = rows.findIndex((entry) => `${entry[mmsIdIndex] || ''}`.trim() === row.mmsId);
  const valuesByHeader = buildWaitingListStateSheetRow(row);
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');
  const endColumn = columnNumberToLetter(headers.length);

  if (targetRowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: buildSheetRange(WAITING_LIST_STATE_SHEET, 'A:A'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [nextRow],
      },
    });
    invalidateSheetReadCache(WAITING_LIST_STATE_SHEET);
    return;
  }

  const rowNumber = targetRowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: buildSheetRange(WAITING_LIST_STATE_SHEET, `A${rowNumber}:${endColumn}${rowNumber}`),
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(WAITING_LIST_STATE_SHEET);
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

export async function upsertIssueQueueRow(row) {
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
  const [, ...rows] = values;
  const issueIdIndex = headers.findIndex((header) => header === 'issue_id');
  const targetRowIndex = rows.findIndex((entry) => `${entry[issueIdIndex] || ''}`.trim() === row.issueId);
  const valuesByHeader = buildIssueQueueSheetRow(row);
  const nextRow = headers.map((header) => valuesByHeader[header] ?? '');
  const endColumn = columnNumberToLetter(headers.length);

  if (targetRowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: buildSheetRange(ISSUE_QUEUE_SHEET, 'A:A'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [nextRow],
      },
    });
    invalidateSheetReadCache(ISSUE_QUEUE_SHEET);
    return;
  }

  const rowNumber = targetRowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: buildSheetRange(ISSUE_QUEUE_SHEET, `A${rowNumber}:${endColumn}${rowNumber}`),
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [nextRow],
    },
  });
  invalidateSheetReadCache(ISSUE_QUEUE_SHEET);
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
