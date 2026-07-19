// Contract guards for the state-tab layer. Each of these pins a seam where
// truth lives in two places and drift used to be silent:
//  1. managed tabs ↔ the backup list (the 2026-07-19 restore-drill finding:
//     five non-rebuildable tabs were created but never backed up)
//  2. sheet header constants ↔ the row builders that write them
//  3. header hygiene (no duplicates, no accidental camelCase)
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildManagedStateSheetDefinitions,
  SONG_ASSIGNMENTS_HEADERS,
  SONG_OUTCOMES_HEADERS,
  SONG_REQUESTS_HEADERS,
  SONG_STATUS_LOG_HEADERS,
} from '../../lib/admin/sheets/core.mjs';
import {
  buildSongAssignmentSheetRow,
  buildSongOutcomeSheetRow,
  buildSongRequestSheetRow,
  buildSongStatusLogSheetRow,
} from '../../lib/admin/sheets/song-assignments.mjs';
import { BACKUP_TABS, NON_BACKED_UP_TABS } from '../../lib/admin/backup-tabs.mjs';

// Students headers are external truth, so the definitions accept them as a
// parameter; any placeholder works for tab-name enumeration.
const managedDefinitions = buildManagedStateSheetDefinitions(['placeholder']);

test('every managed tab is backed up or has a written exclusion reason', () => {
  const unaccounted = managedDefinitions
    .map((definition) => definition.sheetName)
    .filter((sheetName) => !BACKUP_TABS.includes(sheetName) && !NON_BACKED_UP_TABS.has(sheetName));

  assert.deepEqual(
    unaccounted,
    [],
    `Managed tabs missing from BACKUP_TABS (add them there, or to NON_BACKED_UP_TABS with a reason): ${unaccounted.join(', ')}`
  );
});

test('backup list and exclusions stay consistent with the managed set', () => {
  const managedNames = new Set(managedDefinitions.map((definition) => definition.sheetName));

  // A tab in both lists would make the exclusion reason a lie.
  const contradictions = BACKUP_TABS.filter((tab) => NON_BACKED_UP_TABS.has(tab));
  assert.deepEqual(contradictions, []);

  // An exclusion for a tab that is no longer managed is stale documentation.
  const staleExclusions = [...NON_BACKED_UP_TABS.keys()].filter((tab) => !managedNames.has(tab));
  assert.deepEqual(staleExclusions, []);

  // Backed-up tabs beyond the managed set must be the known externally-owned
  // ones: Students (external school truth) and Tutor_Phones (human-maintained,
  // deliberately unmanaged so its header wording stays flexible).
  const EXTERNALLY_OWNED_BACKED_UP = new Set(['Students', 'Tutor_Phones']);
  const unknownExtras = BACKUP_TABS.filter(
    (tab) => !managedNames.has(tab) && !EXTERNALLY_OWNED_BACKED_UP.has(tab)
  );
  assert.deepEqual(unknownExtras, []);
});

test('managed sheet headers are unique and snake_case', () => {
  for (const { sheetName, requiredHeaders } of managedDefinitions) {
    if (sheetName === 'Students_Archive') continue; // inherits external Students headers
    assert.equal(
      new Set(requiredHeaders).size,
      requiredHeaders.length,
      `${sheetName} has duplicate headers`
    );
    for (const header of requiredHeaders) {
      assert.match(
        header,
        /^[a-z0-9_]+$/,
        `${sheetName} header "${header}" is not snake_case`
      );
    }
  }
});

// Header constants and row builders live a few lines apart but nothing joins
// them at runtime: a header added without a builder key writes a permanently
// blank column; a builder key without a header silently never lands.
const BUILDER_CONTRACTS = [
  ['Song_Assignments', SONG_ASSIGNMENTS_HEADERS, buildSongAssignmentSheetRow],
  ['Song_Status_Log', SONG_STATUS_LOG_HEADERS, buildSongStatusLogSheetRow],
  ['Song_Outcomes', SONG_OUTCOMES_HEADERS, buildSongOutcomeSheetRow],
  ['Song_Requests', SONG_REQUESTS_HEADERS, buildSongRequestSheetRow],
];

test('row builders emit exactly their sheet headers', () => {
  for (const [name, headers, builder] of BUILDER_CONTRACTS) {
    assert.deepEqual(
      Object.keys(builder({})).sort(),
      [...headers].sort(),
      `${name}: builder keys and headers disagree`
    );
  }
});
