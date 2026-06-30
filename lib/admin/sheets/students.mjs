import { columnNumberToLetter, findTutorInsertRow } from '../sheets-helpers.mjs';
import { buildSheetRange, buildStudentsArchiveHeaders, ensureManagedSheet, ensureSheetHeaders, getSheetObjects, getSheetValues, getSheetsClient, getSheetsEnv, invalidateSheetReadCache, STUDENTS_ARCHIVE_SHEET } from './core.mjs';

export async function getStudentsSheetRows() {
  return getSheetObjects('Students');
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

export async function archiveAndDeleteStudentSheetRow({ mmsId, archivedAt, archivedBy = '', archiveNote = '', dateLeft = '' }) {
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
    date_left: dateLeft,
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

export async function getStudentsArchiveRows() {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) return [];
  const studentsValues = await getSheetValues('Students');
  await ensureManagedSheet({
    sheets,
    spreadsheetId,
    sheetName: STUDENTS_ARCHIVE_SHEET,
    requiredHeaders: buildStudentsArchiveHeaders(studentsValues[0] || []),
  });
  const values = await getSheetValues(STUDENTS_ARCHIVE_SHEET);
  return mapRowsToObjects(values);
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
