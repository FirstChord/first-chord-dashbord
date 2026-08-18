/** @fileoverview Pure retry and commit orchestration for GitHub-backed registry mutations, plus the write-access check. */
export function shouldRetryGithubRegistryUpdate({ status, errorBody = '' }) {
  return status === 409 || /sha/i.test(errorBody);
}

export async function commitGithubRegistryMutation({
  readCurrent,
  writeCurrent,
  buildContent,
  maxAttempts = 2,
} = {}) {
  if (typeof readCurrent !== 'function' || typeof writeCurrent !== 'function' || typeof buildContent !== 'function') {
    throw new TypeError('Registry mutation requires readCurrent, writeCurrent, and buildContent functions');
  }

  let lastFailure = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const current = await readCurrent();
    const content = await buildContent(current.content);

    if (typeof content !== 'string') {
      throw new TypeError('Registry mutation must return file contents as a string');
    }

    const outcome = await writeCurrent({ content, sha: current.sha });
    if (outcome.ok) {
      return {
        content,
        result: outcome.result,
        attempts: attempt,
      };
    }

    lastFailure = outcome;
    if (
      attempt === maxAttempts
      || !shouldRetryGithubRegistryUpdate({ status: outcome.status, errorBody: outcome.errorBody })
    ) {
      break;
    }
  }

  throw new Error(
    `GitHub registry update failed: ${lastFailure?.status || 'unknown'} ${lastFailure?.errorBody || ''}`.trim(),
  );
}

export function hasGithubRegistryWriteAccess(permissions = {}) {
  return Boolean(
    permissions.push
    || permissions.admin
    || permissions.maintain,
  );
}
