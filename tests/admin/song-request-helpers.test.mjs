import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSongRequestRow, REQUEST_QUERY_MAX_LENGTH } from '../../lib/songs/request-helpers.mjs';

const NOW = new Date('2026-07-18T10:00:00.000Z');
const makeId = () => 'fixed';

test('builds a new request row from a search miss', () => {
  const { row, error } = buildSongRequestRow({
    mmsId: 'sdt_abc',
    queryText: '  Vienna  ',
    instrument: 'Piano',
    requestedBy: 'Finn',
    now: NOW,
    makeId,
  });

  assert.equal(error, undefined);
  assert.deepEqual(row, {
    requestId: 'sr_fixed',
    requestedAt: NOW.toISOString(),
    requestedBy: 'Finn',
    mmsId: 'sdt_abc',
    instrument: 'Piano',
    queryText: 'Vienna',
    status: 'new',
    songId: '',
    resolutionNote: '',
    resolvedAt: '',
    updatedAt: NOW.toISOString(),
  });
});

test('rejects bad student ids and empty queries; caps query length', () => {
  assert.equal(
    buildSongRequestRow({ mmsId: 'nope', queryText: 'Vienna' }).error,
    'invalid_student_id'
  );
  assert.equal(
    buildSongRequestRow({ mmsId: 'sdt_abc', queryText: '   ' }).error,
    'empty_query'
  );

  const long = buildSongRequestRow({
    mmsId: 'sdt_abc',
    queryText: 'x'.repeat(REQUEST_QUERY_MAX_LENGTH + 40),
    now: NOW,
    makeId,
  });
  assert.equal(long.row.queryText.length, REQUEST_QUERY_MAX_LENGTH);
});
