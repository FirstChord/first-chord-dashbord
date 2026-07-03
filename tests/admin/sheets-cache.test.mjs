import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearSheetReadCacheForTests,
  getCachedSheetValues,
  getStaleCachedSheetValues,
  setCachedSheetValues,
} from '../../lib/admin/sheets/core.mjs';

function withMockedNow(now, fn) {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    return fn();
  } finally {
    Date.now = originalNow;
  }
}

test('sheet read cache returns fresh values inside the TTL', () => {
  clearSheetReadCacheForTests();

  withMockedNow(1_000, () => {
    setCachedSheetValues({
      spreadsheetId: 'sheet',
      range: 'Students',
      values: [['Name'], ['Ariana']],
    });
  });

  withMockedNow(30_000, () => {
    assert.deepEqual(getCachedSheetValues({ spreadsheetId: 'sheet', range: 'Students' }), [
      ['Name'],
      ['Ariana'],
    ]);
    assert.equal(getStaleCachedSheetValues({ spreadsheetId: 'sheet', range: 'Students' })?.isFresh, true);
  });
});

test('sheet read cache exposes bounded stale values for background refresh', () => {
  clearSheetReadCacheForTests();

  withMockedNow(1_000, () => {
    setCachedSheetValues({
      spreadsheetId: 'sheet',
      range: 'Planning_Items',
      values: [['title'], ['Pay pause task']],
    });
  });

  withMockedNow(90_000, () => {
    assert.equal(getCachedSheetValues({ spreadsheetId: 'sheet', range: 'Planning_Items' }), null);
    const stale = getStaleCachedSheetValues({ spreadsheetId: 'sheet', range: 'Planning_Items' });
    assert.equal(stale.isFresh, false);
    assert.deepEqual(stale.values, [['title'], ['Pay pause task']]);
  });
});

test('sheet read cache drops entries older than the hard max age', () => {
  clearSheetReadCacheForTests();

  withMockedNow(1_000, () => {
    setCachedSheetValues({
      spreadsheetId: 'sheet',
      range: 'Issue_Queue',
      values: [['issue_id'], ['issue_1']],
    });
  });

  withMockedNow(700_000, () => {
    assert.equal(getStaleCachedSheetValues({ spreadsheetId: 'sheet', range: 'Issue_Queue' }), null);
  });
});
