import test from 'node:test';
import assert from 'node:assert/strict';

import {
  commitGithubRegistryMutation,
  hasGithubRegistryWriteAccess,
  shouldRetryGithubRegistryUpdate,
} from '../../lib/admin/github-helpers.mjs';

test('commitGithubRegistryMutation reapplies intent to the latest file after a conflict', async () => {
  const versions = [
    { sha: 'sha-1', content: 'student-a\n' },
    { sha: 'sha-2', content: 'student-a\nconcurrent-student\n' },
  ];
  const writes = [];

  const committed = await commitGithubRegistryMutation({
    readCurrent: async () => versions.shift(),
    buildContent: (content) => `${content}requested-student\n`,
    writeCurrent: async (write) => {
      writes.push(write);
      if (writes.length === 1) {
        return { ok: false, status: 409, errorBody: 'sha does not match' };
      }
      return { ok: true, result: { commit: 'new-commit' } };
    },
  });

  assert.equal(committed.attempts, 2);
  assert.equal(committed.content, 'student-a\nconcurrent-student\nrequested-student\n');
  assert.deepEqual(writes, [
    { sha: 'sha-1', content: 'student-a\nrequested-student\n' },
    { sha: 'sha-2', content: 'student-a\nconcurrent-student\nrequested-student\n' },
  ]);
});

test('commitGithubRegistryMutation does not retry unrelated write failures', async () => {
  let reads = 0;
  await assert.rejects(
    commitGithubRegistryMutation({
      readCurrent: async () => {
        reads += 1;
        return { sha: 'sha-1', content: 'current' };
      },
      buildContent: (content) => `${content}-next`,
      writeCurrent: async () => ({ ok: false, status: 403, errorBody: 'forbidden' }),
    }),
    /403 forbidden/,
  );
  assert.equal(reads, 1);
});

test('shouldRetryGithubRegistryUpdate retries on explicit 409 conflicts', () => {
  assert.equal(
    shouldRetryGithubRegistryUpdate({ status: 409, errorBody: '' }),
    true,
  );
});

test('shouldRetryGithubRegistryUpdate retries when GitHub error body mentions sha mismatch', () => {
  assert.equal(
    shouldRetryGithubRegistryUpdate({ status: 422, errorBody: 'sha does not match the current blob' }),
    true,
  );
});

test('shouldRetryGithubRegistryUpdate does not retry for unrelated failures', () => {
  assert.equal(
    shouldRetryGithubRegistryUpdate({ status: 500, errorBody: 'internal error' }),
    false,
  );
});

test('hasGithubRegistryWriteAccess accepts GitHub write-capable repository permissions', () => {
  assert.equal(hasGithubRegistryWriteAccess({ push: true }), true);
  assert.equal(hasGithubRegistryWriteAccess({ maintain: true }), true);
  assert.equal(hasGithubRegistryWriteAccess({ admin: true }), true);
});

test('hasGithubRegistryWriteAccess rejects read-only or missing repository permissions', () => {
  assert.equal(hasGithubRegistryWriteAccess({ pull: true, push: false }), false);
  assert.equal(hasGithubRegistryWriteAccess(), false);
});
