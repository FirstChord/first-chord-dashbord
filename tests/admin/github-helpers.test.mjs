import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasGithubRegistryWriteAccess,
  shouldRetryGithubRegistryUpdate,
} from '../../lib/admin/github-helpers.mjs';

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
