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

