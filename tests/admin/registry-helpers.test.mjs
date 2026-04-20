import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRegistry, updateEntryBlock } from '../../lib/admin/registry-helpers.mjs';

test('parseRegistry handles entry endings with inline comments', () => {
  const source = `
export const studentsRegistry = {
  'sdt_abc123': {
    firstName: 'Test',
    lastName: 'Studenty',
    friendlyUrl: 'test-s',
    tutor: 'Arion',
  }, // Test Studenty
};
`;

  const entries = parseRegistry(source);
  assert.deepEqual(entries, [
    {
      mmsId: 'sdt_abc123',
      firstName: 'Test',
      lastName: 'Studenty',
      friendlyUrl: 'test-s',
      tutor: 'Arion',
    },
  ]);
});

test('updateEntryBlock only updates targeted quoted keys', () => {
  const block = `'sdt_abc123': {
    firstName: 'Test',
    thetaUsername: 'oldtheta',
    soundsliceUrl: 'https://www.soundslice.com/courses/123/',
  },`;

  const updated = updateEntryBlock(block, {
    thetaUsername: 'newtheta',
    soundsliceUrl: "https://www.soundslice.com/courses/456/'weird",
  });

  assert.match(updated, /thetaUsername:\s*'newtheta'/);
  assert.match(updated, /soundsliceUrl:\s*'https:\/\/www\.soundslice\.com\/courses\/456\/\\'weird'/);
  assert.match(updated, /firstName:\s*'Test'/);
});

