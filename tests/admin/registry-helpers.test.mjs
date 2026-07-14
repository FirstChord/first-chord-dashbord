import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  escapeRegistryValue,
  extractValue,
  parseRegistry,
  updateEntryBlock,
} from '../../lib/admin/registry-helpers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

test('parseRegistry handles entry endings with inline comments', () => {
  const source = `
export const studentsRegistry = {
  'sdt_abc123': {
    firstName: 'Test',
    lastName: 'Studenty',
    friendlyUrl: 'test-s',
    tutor: 'Arion',
    isTestStudent: 'true',
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
      isTestStudent: 'true',
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

test('a value survives a write/read round-trip unchanged', () => {
  // Escaping on write without unescaping on read grows a backslash per save.
  for (const value of ["O'Neil", 'D\'Angelo', 'plain', 'back\\slash', "both'\\mixed"]) {
    const line = `    lastName: '${escapeRegistryValue(value)}',`;
    assert.equal(extractValue(line), value, `round-trip failed for ${value}`);
    // Twice, because the real bug only showed on the second save.
    const again = `    lastName: '${escapeRegistryValue(extractValue(line))}',`;
    assert.equal(extractValue(again), value, `second round-trip failed for ${value}`);
  }
});

// Every consumer of the registry (generate-configs, the admin editor, the name-leak
// test) reads it as TEXT and regexes it. Nothing parses it as JavaScript, so the file
// can silently stop being valid JavaScript — an unescaped apostrophe in a surname
// (O'Neil) sat in the canonical registry from April to July 2026 doing exactly that.
// These two tests are the guard: the file must import, and the regex parser must agree
// with the real parser. An unescaped quote fails both — it truncates 'O'Neil' to 'O'.
test('the registry is valid JavaScript, not merely regex-shaped text', async () => {
  const { STUDENTS_REGISTRY } = await import('../../lib/config/students-registry.js');
  assert.ok(Object.keys(STUDENTS_REGISTRY).length > 100, 'registry should import with entries');
});

test('the text parser and the JavaScript parser agree on every student', async () => {
  const { STUDENTS_REGISTRY } = await import('../../lib/config/students-registry.js');
  const source = await readFile(
    path.join(here, '../../lib/config/students-registry.js'),
    'utf8'
  );

  const parsed = parseRegistry(source);
  assert.equal(parsed.length, Object.keys(STUDENTS_REGISTRY).length, 'same number of students');

  for (const entry of parsed) {
    const real = STUDENTS_REGISTRY[entry.mmsId];
    assert.ok(real, `${entry.mmsId} parsed from text but is absent from the module`);
    // A value truncated at an unescaped quote shows up here and nowhere else.
    assert.equal(entry.firstName, real.firstName, `${entry.mmsId}: firstName disagrees`);
    assert.equal(entry.lastName, real.lastName, `${entry.mmsId}: lastName disagrees`);
  }
});
