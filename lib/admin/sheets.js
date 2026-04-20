import { google } from 'googleapis';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { columnNumberToLetter, findTutorInsertRow } from './sheets-helpers.mjs';

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const LOCAL_TOKEN_PATH = path.join(homedir(), 'token_musiclessons.json');

function getSheetsEnv() {
  return {
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
    refreshToken: process.env.SHEETS_REFRESH_TOKEN || '',
    clientId: process.env.SHEETS_CLIENT_ID || '',
    clientSecret: process.env.SHEETS_CLIENT_SECRET || '',
  };
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

async function getSheetsClient() {
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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values || [];
}

export async function getStudentsSheetRows() {
  return getSheetObjects('Students');
}

export async function getReviewFlagsRows() {
  return getSheetObjects('Review_Flags');
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

  const [headers, ...rows] = values;
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

  const [headers, ...rows] = values;
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

  return { insertedAt: insertAt };
}
