import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearSheetReadCacheForTests,
  getCachedSheetValues,
  getSheetObjects,
  getSheetsReadBudget,
  getSpreadsheetMetadata,
  getStaleCachedSheetValues,
  prefetchSheetValues,
  resetSheetsReadBudgetForTests,
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

// The Sheets client is where the request timeout lives: gaxios accepts it as a
// client-level option, so one argument covers every call site. Without it a
// stalled Google connection hangs the render forever — no error, no log, just a
// spinner. Asserted on the constructed client rather than by reading source, so
// this stays a behaviour check and not a lint rule.
test('the Sheets client is built with a request timeout', async () => {
  const saved = {
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    refreshToken: process.env.SHEETS_REFRESH_TOKEN,
    clientId: process.env.SHEETS_CLIENT_ID,
    clientSecret: process.env.SHEETS_CLIENT_SECRET,
    client: globalThis.__firstChordSheetsClientPromise,
  };
  process.env.GOOGLE_SPREADSHEET_ID = 'sheet-id';
  process.env.SHEETS_REFRESH_TOKEN = 'refresh';
  process.env.SHEETS_CLIENT_ID = 'client';
  process.env.SHEETS_CLIENT_SECRET = 'secret';
  delete globalThis.__firstChordSheetsClientPromise;

  try {
    const { getSheetsClient } = await import('../../lib/admin/sheets/core.mjs');
    const client = await getSheetsClient();
    assert.ok(client, 'expected a client with credentials present');
    const timeout = client.context?._options?.timeout;
    assert.equal(typeof timeout, 'number', 'the client must carry a request timeout');
    assert.ok(timeout > 0 && timeout <= 60_000, `timeout should be a sane ceiling, got ${timeout}`);
  } finally {
    delete globalThis.__firstChordSheetsClientPromise;
    globalThis.__firstChordSheetsClientPromise = saved.client;
    for (const [key, value] of [
      ['GOOGLE_SPREADSHEET_ID', saved.spreadsheetId],
      ['SHEETS_REFRESH_TOKEN', saved.refreshToken],
      ['SHEETS_CLIENT_ID', saved.clientId],
      ['SHEETS_CLIENT_SECRET', saved.clientSecret],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

// --- read budget ---------------------------------------------------------
// Google allows 60 Sheets reads per minute per user and one service account
// serves the whole app, so an uncached reader is a production outage waiting for
// a busy minute. getSheetObjects used to read straight through to the API, which
// cost three requests per student-context load. See
// docs/architecture/data/sheets-reads.md.

function withFakeSheets({ values, onRead, onBatch }, fn) {
  const saved = {
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    client: globalThis.__firstChordSheetsClientPromise,
  };
  process.env.GOOGLE_SPREADSHEET_ID = `read-budget-${Math.random().toString(36).slice(2)}`;
  clearSheetReadCacheForTests();
  resetSheetsReadBudgetForTests();

  globalThis.__firstChordSheetsClientPromise = Promise.resolve({
    spreadsheets: {
      values: {
        get: async () => {
          onRead?.();
          return { data: { values } };
        },
        batchGet: async ({ ranges = [] }) => {
          onBatch?.(ranges);
          return { data: { valueRanges: ranges.map((range) => ({ range, values })) } };
        },
      },
    },
  });

  return Promise.resolve(fn()).finally(() => {
    if (saved.spreadsheetId === undefined) delete process.env.GOOGLE_SPREADSHEET_ID;
    else process.env.GOOGLE_SPREADSHEET_ID = saved.spreadsheetId;
    if (saved.client === undefined) delete globalThis.__firstChordSheetsClientPromise;
    else globalThis.__firstChordSheetsClientPromise = saved.client;
    clearSheetReadCacheForTests();
    resetSheetsReadBudgetForTests();
  });
}

test('getSheetObjects serves repeat calls from the read cache', async () => {
  let reads = 0;
  await withFakeSheets({
    values: [['mms_id', 'Student forename'], ['sdt_1', 'Ada']],
    onRead: () => { reads += 1; },
  }, async () => {
    const first = await getSheetObjects('Students');
    const second = await getSheetObjects('Students');

    assert.deepEqual(first, [{ mms_id: 'sdt_1', 'Student forename': 'Ada' }]);
    assert.deepEqual(second, first);
    assert.equal(reads, 1, 'a second read of the same tab must not spend quota');
  });
});

test('the read budget counts real API reads, not cache hits', async () => {
  await withFakeSheets({ values: [['mms_id'], ['sdt_1']] }, async () => {
    assert.equal(getSheetsReadBudget().reads, 0);

    await getSheetObjects('Students');
    assert.equal(getSheetsReadBudget().reads, 1, 'a cache miss spends quota');

    await getSheetObjects('Students');
    assert.equal(getSheetsReadBudget().reads, 1, 'a cache hit does not');
  });
});

// --- batched prefetch ----------------------------------------------------
// The quota cannot be raised, so reading less is the only lever. A batchGet of
// N tabs costs one request where N gets cost N.

test('a prefetched tab set costs one request, not one per tab', async () => {
  let gets = 0;
  let batches = 0;
  await withFakeSheets({
    values: [['mms_id'], ['sdt_1']],
    onRead: () => { gets += 1; },
    onBatch: () => { batches += 1; },
  }, async () => {
    await prefetchSheetValues(['Students', 'Review_Flags', 'Waiting_List_State']);

    // Every reader underneath now finds its tab already cached.
    await getSheetObjects('Students');
    await getSheetObjects('Review_Flags');
    await getSheetObjects('Waiting_List_State');

    assert.equal(batches, 1, 'three tabs must be fetched in one batch request');
    assert.equal(gets, 0, 'a prefetched tab must not be read again individually');
    assert.equal(getSheetsReadBudget().reads, 1, 'a batchGet spends one unit of quota');
  });
});

test('prefetch returns the same values a direct read would', async () => {
  await withFakeSheets({ values: [['mms_id', 'name'], ['sdt_1', 'Ada']] }, async () => {
    await prefetchSheetValues(['Students', 'Review_Flags']);
    assert.deepEqual(await getSheetObjects('Students'), [{ mms_id: 'sdt_1', name: 'Ada' }]);
  });
});

test('a single range is left to the normal read path', async () => {
  let batches = 0;
  await withFakeSheets({
    values: [['mms_id'], ['sdt_1']],
    onBatch: () => { batches += 1; },
  }, async () => {
    await prefetchSheetValues(['Students']);
    assert.equal(batches, 0, 'batching one range would be pure overhead');
  });
});

test('already-cached tabs are not re-fetched by a prefetch', async () => {
  let batches = 0;
  await withFakeSheets({
    values: [['mms_id'], ['sdt_1']],
    onBatch: (ranges) => { batches += 1; assert.deepEqual(ranges, ['Review_Flags', 'Waiting_List_State']); },
  }, async () => {
    await getSheetObjects('Students'); // warms one tab the normal way
    await prefetchSheetValues(['Students', 'Review_Flags', 'Waiting_List_State']);
    assert.equal(batches, 1);
  });
});

test('a failed batch leaves readers able to fetch for themselves', async () => {
  await withFakeSheets({
    values: [['mms_id'], ['sdt_1']],
    onBatch: () => { throw new Error('batchGet exploded'); },
  }, async () => {
    await prefetchSheetValues(['Students', 'Review_Flags']);
    // The prefetch is an optimisation, never a dependency.
    assert.deepEqual(await getSheetObjects('Students'), [{ mms_id: 'sdt_1' }]);
  });
});

test('parallel callers share one spreadsheet metadata request', async () => {
  // A page touching four managed tabs calls ensureManagedSheet four times at
  // once. With only a completed-result cache, all four missed and all four
  // fetched — four requests for one answer, on every cold start.
  let metadataCalls = 0;
  const saved = {
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    client: globalThis.__firstChordSheetsClientPromise,
  };
  process.env.GOOGLE_SPREADSHEET_ID = `metadata-${Math.random().toString(36).slice(2)}`;
  const sheets = {
    spreadsheets: {
      get: async () => {
        metadataCalls += 1;
        await new Promise((resolve) => { setTimeout(resolve, 5); });
        return { data: { sheets: [{ properties: { title: 'Students', sheetId: 1 } }] } };
      },
    },
  };

  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => getSpreadsheetMetadata({ sheets, spreadsheetId })),
    );
    assert.equal(metadataCalls, 1, 'four parallel callers must share one request');
    for (const result of results) {
      assert.equal(result[0].properties.title, 'Students', 'every caller gets the answer');
    }
  } finally {
    if (saved.spreadsheetId === undefined) delete process.env.GOOGLE_SPREADSHEET_ID;
    else process.env.GOOGLE_SPREADSHEET_ID = saved.spreadsheetId;
    globalThis.__firstChordSheetsClientPromise = saved.client;
  }
});

test('the read budget warns below the quota, not after it is spent', () => {
  const { warnAt, quota } = getSheetsReadBudget();
  assert.equal(quota, 60, 'Google allows 60 reads per minute per user');
  assert.ok(warnAt < quota, 'the warning must arrive with headroom left to act on');
});
