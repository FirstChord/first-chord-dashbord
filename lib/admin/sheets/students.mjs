/** @fileoverview Sheets adapter for the Students tab: field updates, payment-expectation batches, row creation, and archive-on-delete. */
import {
  buildStudentFieldUpdateBatch,
  buildStudentPaymentExpectationBatch,
  columnNumberToLetter,
  findTutorInsertRow,
} from '../sheets-helpers.mjs';
import {
  buildSheetRange,
  buildStudentsArchiveHeaders,
  ensureManagedSheet,
  ensureSheetHeaders,
  getSheetObjects,
  getSheetValues,
  getSheetsClient,
  getSheetsEnv,
  invalidateSheetReadCache,
  mapRowsToObjects,
  STUDENTS_ARCHIVE_SHEET,
  withSheetsRetry,
} from './core.mjs';

export async function getStudentsSheetRows() {
  return getSheetObjects('Students');
}

export async function updateStudentSheetRow(mmsId, updates) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const values = await getSheetValues('Students', { force: true });
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

  const batch = buildStudentFieldUpdateBatch({
    headers,
    rows,
    mmsId,
    updates,
  });

  if (batch.data.length) {
    await withSheetsRetry(() => sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batch.data,
      },
    }));
    invalidateSheetReadCache('Students');
  }

  return {
    rowNumber: batch.rowNumber,
    changedCellCount: batch.changedCellCount,
  };
}

export async function updateStudentPaymentExpectationRows(changes = []) {
  if (!changes.length) {
    return {
      requestedStudentCount: 0,
      changedRowCount: 0,
      targets: [],
    };
  }

  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const values = await getSheetValues('Students', { force: true });
  if (!values.length) {
    throw new Error('Students sheet is empty or unavailable');
  }

  let [headers, ...rows] = values;
  headers = await ensureSheetHeaders({
    sheets,
    spreadsheetId,
    sheetName: 'Students',
    headers,
    missingHeaders: headers.includes('payment_expectation') ? [] : ['payment_expectation'],
  });

  const batch = buildStudentPaymentExpectationBatch({
    headers,
    rows,
    changes,
  });

  if (batch.data.length) {
    await withSheetsRetry(() => sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batch.data,
      },
    }));
    invalidateSheetReadCache('Students');
  }

  return {
    requestedStudentCount: batch.requestedStudentCount,
    changedRowCount: batch.changedRowCount,
    targets: batch.targets,
  };
}

export async function archiveAndDeleteStudentSheetRow({ mmsId, archivedAt, archivedBy = '', archiveNote = '', dateLeft = '' }) {
  const { spreadsheetId } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!sheets || !spreadsheetId) {
    throw new Error('Google Sheets admin credentials are not configured');
  }

  const values = await getSheetValues('Students', { force: true });
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

  await withSheetsRetry(() => sheets.spreadsheets.values.append({
    spreadsheetId,
    range: buildSheetRange(STUDENTS_ARCHIVE_SHEET, 'A:A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [managedArchiveHeaders.map((header) => rowByHeader[header] ?? '')],
    },
  }));

  // The archive append and row deletion cannot be one Sheets transaction. Re-read
  // after the append so a concurrent insert/delete cannot make the original row
  // number point at a different student.
  const latestValues = await getSheetValues('Students', { force: true });
  const [latestHeaders, ...latestRows] = latestValues;
  const latestMmsColumnIndex = latestHeaders.findIndex((header) => (
    ['mms_id', 'MMS ID', 'MMS Id', 'Student ID'].includes(header)
  ));
  const latestRowIndex = latestRows.findIndex((row) => (
    `${row[latestMmsColumnIndex] || ''}`.trim() === mmsId
  ));

  if (latestMmsColumnIndex === -1 || latestRowIndex === -1) {
    throw new Error(`Student ${mmsId} moved or disappeared after being archived; no Students row was deleted`);
  }

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

  const targetRowNumber = latestRowIndex + 2;
  await withSheetsRetry(() => sheets.spreadsheets.batchUpdate({
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
  }));

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

  const values = await getSheetValues('Students', { force: true });
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
