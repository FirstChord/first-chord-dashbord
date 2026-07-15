import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { parseStrictManagedRows } from '../../lib/admin/assistant-context-readers.mjs';

test('strict managed reads refuse missing headers instead of repairing them', () => {
  const result = parseStrictManagedRows([
    ['mms_id', 'status'],
    ['sdt_1', 'active'],
  ], ['mms_id', 'status', 'updated_at']);

  assert.equal(result.available, false);
  assert.equal(result.reason, 'schema_mismatch');
  assert.deepEqual(result.missingHeaders, ['updated_at']);
  assert.deepEqual(result.rows, []);
});

test('strict managed reads map compatible rows without mutating input', () => {
  const values = [
    ['mms_id', 'status'],
    ['sdt_1', 'active'],
  ];
  const snapshot = structuredClone(values);
  const result = parseStrictManagedRows(values, ['mms_id', 'status'], (row) => ({
    mmsId: row.mms_id,
    status: row.status,
  }));

  assert.equal(result.available, true);
  assert.deepEqual(result.rows, [{ mmsId: 'sdt_1', status: 'active' }]);
  assert.deepEqual(values, snapshot);
});

test('assistant readers cannot ensure tabs or import write-capable issue orchestration', async () => {
  const source = await readFile(
    new URL('../../lib/admin/assistant-context-readers.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /ensureManagedSheet|getAdminIssues|upsert[A-Z]|append[A-Z]|update[A-Z]|getLiveStripe/u,
  );
  assert.match(source, /getAssistantStudentsSheetRows/u);
  assert.match(source, /getAssistantReviewFlagRows/u);
  assert.match(source, /getAssistantPauseHistoryRows/u);
});
