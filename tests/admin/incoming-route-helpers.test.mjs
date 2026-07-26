import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBridgeMutationResponse } from '../../lib/admin/incoming-route-helpers.mjs';

test('bridge capture acknowledgements never include admin inbox data', () => {
  assert.deepEqual(buildBridgeMutationResponse({ mode: 'capture' }), {
    success: true,
  });
});

test('bridge group sync receives only its non-sensitive summary', () => {
  const groupSyncSummary = {
    totalGroups: 10,
    kept: 8,
    matched: 7,
  };

  assert.deepEqual(buildBridgeMutationResponse({
    mode: 'sync_groups',
    groupSyncSummary,
  }), {
    success: true,
    groupSyncSummary,
  });
});

test('non-sync bridge responses ignore an accidentally supplied summary', () => {
  assert.deepEqual(buildBridgeMutationResponse({
    mode: 'capture',
    groupSyncSummary: { matched: 100 },
  }), {
    success: true,
  });
});
