import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRetryGithubRegistryUpdate } from '../../lib/admin/github-helpers.mjs';

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
