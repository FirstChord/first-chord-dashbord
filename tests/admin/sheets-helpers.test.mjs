import test from 'node:test';
import assert from 'node:assert/strict';

import { columnNumberToLetter, findTutorInsertRow } from '../../lib/admin/sheets-helpers.mjs';

test('columnNumberToLetter converts spreadsheet columns correctly', () => {
  assert.equal(columnNumberToLetter(1), 'A');
  assert.equal(columnNumberToLetter(12), 'L');
  assert.equal(columnNumberToLetter(26), 'Z');
  assert.equal(columnNumberToLetter(27), 'AA');
});

test('findTutorInsertRow inserts after the first contiguous tutor block only', () => {
  const rows = [
    ['ARION XENOS', '', ''],
    ['', '', ''],
    ['Norman', 'Indy', 'Arion Xenos'],
    ['Norman', 'Roar', 'Arion Xenos'],
    ['CALUM STEEL', '', ''],
    ['', '', ''],
    ['Studenty', 'Test', 'Arion Xenos'],
    ['', '', ''],
    ['Lyall', 'Dylan', 'Fennella McCallum'],
  ];

  const insertRow = findTutorInsertRow(rows, 2, 'Arion Xenos');
  assert.equal(insertRow, 6);
});

test('findTutorInsertRow falls back to append when tutor block is missing', () => {
  const rows = [
    ['Header tutor'],
    ['Finn Le Marinel'],
    ['Fennella McCallum'],
  ];

  assert.equal(findTutorInsertRow(rows, 0, 'Arion Xenos'), rows.length + 2);
});
