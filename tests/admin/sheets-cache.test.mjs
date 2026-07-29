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
