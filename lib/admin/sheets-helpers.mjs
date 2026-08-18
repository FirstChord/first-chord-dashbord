/** @fileoverview Pure column-letter arithmetic and batch builders for student field and payment-expectation writes. */
export function columnNumberToLetter(columnNumber) {
  let dividend = columnNumber;
  let columnName = '';

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}

export function findTutorInsertRow(rows, tutorIndex, targetTutor) {
  if (tutorIndex === -1 || !targetTutor) {
    return rows.length + 2;
  }

  const normalisedTutor = targetTutor.trim().toLowerCase();
  let firstMatchIndex = -1;

  for (let index = 0; index < rows.length; index += 1) {
    const cell = (rows[index]?.[tutorIndex] || '').trim().toLowerCase();
    if (cell === normalisedTutor) {
      firstMatchIndex = index;
      break;
    }
  }

  if (firstMatchIndex === -1) {
    return rows.length + 2;
  }

  let lastContiguousIndex = firstMatchIndex;
  for (let index = firstMatchIndex + 1; index < rows.length; index += 1) {
    const cell = (rows[index]?.[tutorIndex] || '').trim().toLowerCase();
    if (cell !== normalisedTutor) {
      break;
    }
    lastContiguousIndex = index;
  }

  return lastContiguousIndex + 3;
}

export function buildStudentFieldUpdateBatch({
  headers = [],
  rows = [],
  mmsId = '',
  updates = {},
} = {}) {
  const mmsColumnIndex = headers.findIndex((header) => (
    ['mms_id', 'MMS ID', 'MMS Id', 'Student ID'].includes(header)
  ));

  if (mmsColumnIndex === -1) {
    throw new Error('Could not find MMS ID column in Students sheet');
  }

  const rowIndex = rows.findIndex((row) => `${row[mmsColumnIndex] || ''}`.trim() === mmsId);
  if (rowIndex === -1) {
    throw new Error(`Student ${mmsId} was not found in Students sheet`);
  }

  const rowNumber = rowIndex + 2;
  const data = [];

  for (const [header, rawValue] of Object.entries(updates)) {
    const columnIndex = headers.indexOf(header);
    if (columnIndex === -1) {
      throw new Error(`Could not find ${header} column in Students sheet`);
    }

    const nextValue = rawValue ?? '';
    if ((rows[rowIndex]?.[columnIndex] ?? '') === nextValue) {
      continue;
    }

    data.push({
      range: `Students!${columnNumberToLetter(columnIndex + 1)}${rowNumber}`,
      values: [[nextValue]],
    });
  }

  return {
    rowNumber,
    changedCellCount: data.length,
    data,
  };
}

export function buildStudentPaymentExpectationBatch({
  headers = [],
  rows = [],
  changes = [],
} = {}) {
  const mmsColumnIndex = headers.findIndex((header) => (
    ['mms_id', 'MMS ID', 'MMS Id', 'Student ID'].includes(header)
  ));
  const paymentExpectationIndex = headers.indexOf('payment_expectation');

  if (mmsColumnIndex === -1) {
    throw new Error('Could not find MMS ID column in Students sheet');
  }
  if (paymentExpectationIndex === -1) {
    throw new Error('Could not find payment_expectation column in Students sheet');
  }

  const changeByMmsId = new Map();
  for (const change of changes) {
    const mmsId = `${change?.mmsId || ''}`.trim();
    const nextPaymentExpectation = `${change?.nextPaymentExpectation || ''}`.trim();
    if (!mmsId || !nextPaymentExpectation) {
      throw new Error('Every payment expectation batch change requires an MMS ID and next value');
    }

    const existing = changeByMmsId.get(mmsId);
    if (existing && existing !== nextPaymentExpectation) {
      throw new Error(`Conflicting payment expectation changes were requested for ${mmsId}`);
    }
    changeByMmsId.set(mmsId, nextPaymentExpectation);
  }

  const paymentColumn = columnNumberToLetter(paymentExpectationIndex + 1);
  const data = [];
  const targets = [];

  for (const [mmsId, nextPaymentExpectation] of changeByMmsId.entries()) {
    const matchingRows = rows
      .map((row, index) => ({ row, rowNumber: index + 2 }))
      .filter(({ row }) => `${row[mmsColumnIndex] || ''}`.trim() === mmsId);

    if (!matchingRows.length) {
      throw new Error(`Student ${mmsId} was not found in Students sheet`);
    }

    const changedRowNumbers = [];
    for (const { row, rowNumber } of matchingRows) {
      if (`${row[paymentExpectationIndex] || ''}`.trim() === nextPaymentExpectation) {
        continue;
      }
      changedRowNumbers.push(rowNumber);
      data.push({
        range: `Students!${paymentColumn}${rowNumber}`,
        values: [[nextPaymentExpectation]],
      });
    }

    targets.push({
      mmsId,
      nextPaymentExpectation,
      matchedRowCount: matchingRows.length,
      changedRowNumbers,
    });
  }

  return {
    data,
    targets,
    requestedStudentCount: changeByMmsId.size,
    changedRowCount: data.length,
  };
}
