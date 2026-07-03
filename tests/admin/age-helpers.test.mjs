import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAgeChip } from '../../lib/admin/age-helpers.mjs';

const NOW = new Date('2026-07-04T12:00:00.000Z');

test('returns null for fresh, missing, or invalid dates', () => {
  assert.equal(formatAgeChip('', NOW), null);
  assert.equal(formatAgeChip(undefined, NOW), null);
  assert.equal(formatAgeChip('not-a-date', NOW), null);
  assert.equal(formatAgeChip('2026-07-04T09:00:00.000Z', NOW), null); // today
  assert.equal(formatAgeChip('2026-07-03T09:00:00.000Z', NOW), null); // 1 day
});

test('formats days, weeks, and months at the right thresholds', () => {
  assert.equal(formatAgeChip('2026-07-02T12:00:00.000Z', NOW), '2d');
  assert.equal(formatAgeChip('2026-06-22T12:00:00.000Z', NOW), '12d');
  assert.equal(formatAgeChip('2026-06-20T12:00:00.000Z', NOW), '2w'); // 14 days
  assert.equal(formatAgeChip('2026-05-30T12:00:00.000Z', NOW), '5w');
  assert.equal(formatAgeChip('2026-05-05T12:00:00.000Z', NOW), '2mo'); // 60 days
  assert.equal(formatAgeChip('2026-01-04T12:00:00.000Z', NOW), '6mo');
});

test('future dates do not render a chip', () => {
  assert.equal(formatAgeChip('2026-07-10T12:00:00.000Z', NOW), null);
});
