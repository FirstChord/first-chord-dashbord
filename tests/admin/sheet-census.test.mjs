import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CENSUS_WATCH_TABS,
  buildSheetCensus,
  formatCensusSummary,
} from '../../lib/admin/sheet-census.mjs';

const currentManifest = {
  completedAt: '2026-07-07T10:00:00Z',
  tabs: [
    { tabName: 'Students', rowCount: 170 },
    { tabName: 'Incoming_Message_Inbox', rowCount: 240 },
    { tabName: 'Event_Log', rowCount: 900 },
    { tabName: 'Tutor_Pay', rowCount: 12 },
  ],
};

const previousManifest = {
  completedAt: '2026-06-23T10:00:00Z',
  tabs: [
    { tabName: 'Students', rowCount: 168 },
    { tabName: 'Incoming_Message_Inbox', rowCount: 90 },
    { tabName: 'Event_Log', rowCount: 850 },
    { tabName: 'Tutor_Pay', rowCount: 12 },
  ],
};

test('buildSheetCensus computes per-tab deltas against the previous manifest', () => {
  const census = buildSheetCensus({ currentManifest, previousManifest });
  const inbox = census.tabs.find((tab) => tab.tabName === 'Incoming_Message_Inbox');

  assert.equal(inbox.rowCount, 240);
  assert.equal(inbox.previousRowCount, 90);
  assert.equal(inbox.delta, 150);
  assert.equal(inbox.watched, true);
  assert.equal(census.totalRows, 170 + 240 + 900 + 12);
  assert.equal(census.totalDelta, (170 + 240 + 900 + 12) - (168 + 90 + 850 + 12));
});

test('buildSheetCensus ranks watched tabs by growth, ignoring human-paced config tabs', () => {
  const census = buildSheetCensus({ currentManifest, previousManifest });

  // Incoming inbox (+150) grows faster than Event_Log (+50); Students (+2) is
  // not a watched tab even though it changed.
  assert.deepEqual(
    census.fastestGrowing.map((tab) => tab.tabName),
    ['Incoming_Message_Inbox', 'Event_Log'],
  );
  assert.ok(!census.fastestGrowing.some((tab) => tab.tabName === 'Students'));
});

test('buildSheetCensus reports null deltas on the first run with no prior manifest', () => {
  const census = buildSheetCensus({ currentManifest, previousManifest: null });

  assert.equal(census.totalDelta, null);
  assert.equal(census.previousTotalRows, null);
  assert.equal(census.fastestGrowing.length, 0);
  for (const tab of census.tabs) {
    assert.equal(tab.delta, null);
    assert.equal(tab.previousRowCount, null);
  }
});

test('formatCensusSummary surfaces the total, delta, and watched growth', () => {
  const summary = formatCensusSummary(buildSheetCensus({ currentManifest, previousManifest }));

  assert.match(summary, /1322 rows across 4 tabs/);
  assert.match(summary, /\+202 since last backup/);
  assert.match(summary, /Incoming_Message_Inbox \+150/);
});

test('formatCensusSummary states no watched growth when a prior reading exists but nothing grew', () => {
  const flat = buildSheetCensus({ currentManifest: previousManifest, previousManifest });
  assert.match(formatCensusSummary(flat), /Watched growth: none\./);
});

test('the watched set stays scoped to event-heavy machine lanes', () => {
  assert.ok(CENSUS_WATCH_TABS.includes('Incoming_Message_Inbox'));
  assert.ok(!CENSUS_WATCH_TABS.includes('Tutor_Pay'));
  assert.ok(!CENSUS_WATCH_TABS.includes('Students'));
});
