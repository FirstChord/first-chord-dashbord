import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildStudentFieldUpdateBatch,
  buildStudentPaymentExpectationBatch,
  columnNumberToLetter,
  findTutorInsertRow,
} from '../../lib/admin/sheets-helpers.mjs';

test('buildStudentFieldUpdateBatch writes only named changed cells from a freshly located row', () => {
  const batch = buildStudentFieldUpdateBatch({
    headers: ['Student forename', 'mms_id', 'payment_expectation', 'Tutor'],
    rows: [
      ['Ada', 'sdt_ada', 'stripe_active_expected', 'Arion'],
      ['Sam', 'sdt_sam', 'stripe_active_expected', 'Dean'],
    ],
    mmsId: 'sdt_sam',
    updates: {
      payment_expectation: 'stripe_paused_expected',
      Tutor: 'Dean',
    },
  });

  assert.deepEqual(batch, {
    rowNumber: 3,
    changedCellCount: 1,
    data: [{
      range: 'Students!C3',
      values: [['stripe_paused_expected']],
    }],
  });
});

test('buildStudentFieldUpdateBatch rejects a stale target instead of guessing a row', () => {
  assert.throws(
    () => buildStudentFieldUpdateBatch({
      headers: ['mms_id', 'Tutor'],
      rows: [['sdt_ada', 'Arion']],
      mmsId: 'sdt_missing',
      updates: { Tutor: 'Dean' },
    }),
    /was not found/,
  );
});

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

test('buildStudentPaymentExpectationBatch updates every matching row in one batch payload', () => {
  const batch = buildStudentPaymentExpectationBatch({
    headers: ['Student forename', 'mms_id', 'payment_expectation'],
    rows: [
      ['Ada', 'sdt_ada', 'stripe_active_expected'],
      ['Ada', 'sdt_ada', 'stripe_paused_expected'],
      ['Sam', 'sdt_sam', 'stripe_active_expected'],
    ],
    changes: [
      { mmsId: 'sdt_ada', nextPaymentExpectation: 'stripe_paused_expected' },
      { mmsId: 'sdt_sam', nextPaymentExpectation: 'stripe_paused_expected' },
    ],
  });

  assert.equal(batch.requestedStudentCount, 2);
  assert.equal(batch.changedRowCount, 2);
  assert.deepEqual(batch.data, [
    {
      range: 'Students!C2',
      values: [['stripe_paused_expected']],
    },
    {
      range: 'Students!C4',
      values: [['stripe_paused_expected']],
    },
  ]);
  assert.deepEqual(batch.targets[0].changedRowNumbers, [2]);
  assert.equal(batch.targets[0].matchedRowCount, 2);
});

test('buildStudentPaymentExpectationBatch rejects missing students and conflicting duplicate changes', () => {
  const input = {
    headers: ['mms_id', 'payment_expectation'],
    rows: [['sdt_ada', 'stripe_active_expected']],
  };

  assert.throws(
    () => buildStudentPaymentExpectationBatch({
      ...input,
      changes: [{ mmsId: 'sdt_missing', nextPaymentExpectation: 'stripe_paused_expected' }],
    }),
    /was not found/,
  );
  assert.throws(
    () => buildStudentPaymentExpectationBatch({
      ...input,
      changes: [
        { mmsId: 'sdt_ada', nextPaymentExpectation: 'stripe_paused_expected' },
        { mmsId: 'sdt_ada', nextPaymentExpectation: 'stripe_active_expected' },
      ],
    }),
    /Conflicting payment expectation changes/,
  );
});
